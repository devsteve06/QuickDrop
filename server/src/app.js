import express from "express";
import cors from "cors";
import { db } from "./db.js";

const MAX_ITEMS = 50;
const MAX_QTY = 99;

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function requiredString(value, field, maxLength) {
  if (typeof value !== "string") {
    throw new HttpError(400, `${field} is required`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new HttpError(400, `${field} is required`);
  }
  if (trimmed.length > maxLength) {
    throw new HttpError(400, `${field} must be at most ${maxLength} characters`);
  }
  return trimmed;
}

function optionalPhone(value) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") {
    throw new HttpError(400, "phone must be a string");
  }
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!/^[+()\d\s.-]{6,20}$/.test(trimmed)) {
    throw new HttpError(400, "phone must be 6-20 characters (digits, spaces, + ( ) - .)");
  }
  return trimmed;
}

function parseId(value, field) {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (!Number.isInteger(n) || n < 1) {
    throw new HttpError(400, `${field} must be a positive integer`);
  }
  return n;
}

function parseItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpError(400, "items must be a non-empty array");
  }
  if (items.length > MAX_ITEMS) {
    throw new HttpError(400, `items must contain at most ${MAX_ITEMS} entries`);
  }

  const seen = new Set();
  return items.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new HttpError(400, `items[${index}] must be an object`);
    }
    const id = parseId(entry.id, `items[${index}].id`);
    if (seen.has(id)) {
      throw new HttpError(400, `items contains duplicate id ${id}`);
    }
    seen.add(id);

    if (!Number.isInteger(entry.qty) || entry.qty < 1 || entry.qty > MAX_QTY) {
      throw new HttpError(400, `items[${index}].qty must be an integer between 1 and ${MAX_QTY}`);
    }
    return { id, qty: entry.qty };
  });
}

export function createApp({ corsOrigin = process.env.CORS_ORIGIN || "*" } = {}) {
  const app = express();

  app.use(cors({ origin: corsOrigin === "*" ? "*" : corsOrigin.split(",").map((s) => s.trim()) }));
  app.use(express.json({ limit: "32kb" }));

  // ---- Health ----

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "quickdrop-api" });
  });

  // ---- Restaurants ----

  app.get("/api/restaurants", (_req, res) => {
    const restaurants = db
      .prepare("SELECT * FROM restaurants ORDER BY rating DESC")
      .all();
    res.json(restaurants);
  });

  app.get("/api/restaurants/:id", (req, res) => {
    const id = parseId(req.params.id, "id");
    const restaurant = db.prepare("SELECT * FROM restaurants WHERE id = ?").get(id);
    if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });

    const menu = db
      .prepare("SELECT * FROM menu_items WHERE restaurant_id = ? ORDER BY id")
      .all(id);

    res.json({ ...restaurant, menu });
  });

  // ---- Orders ----

  app.post("/api/orders", (req, res) => {
    const body = req.body ?? {};
    const restaurantId = parseId(body.restaurantId, "restaurantId");
    const customerName = requiredString(body.customerName, "customerName", 80);
    const address = requiredString(body.address, "address", 200);
    const phone = optionalPhone(body.phone);
    const items = parseItems(body.items);

    const restaurant = db
      .prepare("SELECT * FROM restaurants WHERE id = ?")
      .get(restaurantId);
    if (!restaurant) throw new HttpError(404, "Restaurant not found");

    // Prices are always computed server-side from the database.
    const menuById = new Map(
      db
        .prepare("SELECT * FROM menu_items WHERE restaurant_id = ?")
        .all(restaurantId)
        .map((item) => [item.id, item])
    );

    let subtotal = 0;
    const lines = items.map(({ id, qty }) => {
      const item = menuById.get(id);
      if (!item) {
        throw new HttpError(400, `Menu item ${id} not found for this restaurant`);
      }
      subtotal += item.price * qty;
      return { id: item.id, name: item.name, price: item.price, qty };
    });

    subtotal = round2(subtotal);
    const deliveryFee = round2(restaurant.delivery_fee);
    const total = round2(subtotal + deliveryFee);

    let orderId;
    db.exec("BEGIN");
    try {
      const { lastInsertRowid } = db
        .prepare(
          `INSERT INTO orders (restaurant_id, customer_name, address, phone, subtotal, delivery_fee, total, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_payment')`
        )
        .run(restaurantId, customerName, address, phone, subtotal, deliveryFee, total);
      orderId = lastInsertRowid;

      const insertLine = db.prepare(
        "INSERT INTO order_items (order_id, menu_item_id, name, price, qty) VALUES (?, ?, ?, ?, ?)"
      );
      for (const line of lines) {
        insertLine.run(orderId, line.id, line.name, line.price, line.qty);
      }
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }

    res.status(201).json({
      orderId,
      status: "pending_payment",
      subtotal,
      deliveryFee,
      total,
    });
  });

  // Simulated payment: no real gateway, just flips the status.
  app.post("/api/orders/:id/pay", (req, res) => {
    const id = parseId(req.params.id, "id");
    const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const { changes } = db
      .prepare("UPDATE orders SET status = 'preparing' WHERE id = ? AND status = 'pending_payment'")
      .run(id);
    if (changes === 0) {
      return res.status(409).json({ error: `Order is already ${order.status}` });
    }

    const restaurant = db
      .prepare("SELECT delivery_minutes FROM restaurants WHERE id = ?")
      .get(order.restaurant_id);

    res.json({
      orderId: order.id,
      status: "preparing",
      etaMinutes: restaurant.delivery_minutes,
      paid: round2(order.total),
    });
  });

  app.get("/api/orders/:id", (req, res) => {
    const id = parseId(req.params.id, "id");
    const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const items = db
      .prepare("SELECT name, price, qty FROM order_items WHERE order_id = ?")
      .all(order.id);
    const restaurant = db
      .prepare("SELECT name, emoji, delivery_minutes FROM restaurants WHERE id = ?")
      .get(order.restaurant_id);

    res.json({ ...order, items, restaurant });
  });

  // JSON 404 for anything unrouted (so clients never get an HTML error page).
  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // JSON error handler (so clients never get an HTML error page).
  app.use((err, _req, res, _next) => {
    if (res.headersSent) return;

    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    if (err?.type === "entity.parse.failed") {
      return res.status(400).json({ error: "Invalid JSON body" });
    }
    if (err?.type === "entity.too.large") {
      return res.status(413).json({ error: "Request body too large" });
    }

    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
