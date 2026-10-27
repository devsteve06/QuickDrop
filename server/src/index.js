import express from "express";
import cors from "cors";
import { db } from "./db.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

// ---- Restaurants ----

app.get("/api/restaurants", (_req, res) => {
  const restaurants = db
    .prepare("SELECT * FROM restaurants ORDER BY rating DESC")
    .all();
  res.json(restaurants);
});

app.get("/api/restaurants/:id", (req, res) => {
  const restaurant = db
    .prepare("SELECT * FROM restaurants WHERE id = ?")
    .get(req.params.id);
  if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });

  const menu = db
    .prepare("SELECT * FROM menu_items WHERE restaurant_id = ? ORDER BY id")
    .all(req.params.id);

  res.json({ ...restaurant, menu });
});

// ---- Orders ----

app.post("/api/orders", (req, res) => {
  const { restaurantId, customerName, address, phone = "", items } = req.body ?? {};

  if (!restaurantId || !customerName || !address || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      error: "restaurantId, customerName, address and a non-empty items array are required",
    });
  }

  const restaurant = db
    .prepare("SELECT * FROM restaurants WHERE id = ?")
    .get(restaurantId);
  if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });

  // Prices are always computed server-side from the database.
  const subtotal = items.reduce((sum, { id, qty }) => {
    const item = db
      .prepare("SELECT * FROM menu_items WHERE id = ? AND restaurant_id = ?")
      .get(id, restaurantId);
    if (!item) throw new Error(`Menu item ${id} not found for this restaurant`);
    if (!Number.isInteger(qty) || qty < 1) throw new Error(`Invalid qty for item ${id}`);
    return sum + item.price * qty;
  }, 0);

  const { delivery_fee: deliveryFee } = restaurant;
  const total = subtotal + deliveryFee;

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
    for (const { id, qty } of items) {
      const item = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(id);
      insertLine.run(orderId, item.id, item.name, item.price, qty);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  res.status(201).json({
    orderId,
    status: "pending_payment",
    subtotal: Math.round(subtotal * 100) / 100,
    deliveryFee,
    total: Math.round(total * 100) / 100,
  });
});

// JSON error handler (so clients never get an HTML error page)
app.use((err, _req, res, _next) => {
  res.status(400).json({ error: err.message });
});

// Simulated payment: no real gateway, just flips the status.
app.post("/api/orders/:id/pay", (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.status !== "pending_payment") {
    return res.status(409).json({ error: `Order is already ${order.status}` });
  }

  db.prepare("UPDATE orders SET status = 'preparing' WHERE id = ?").run(order.id);

  res.json({
    orderId: order.id,
    status: "preparing",
    etaMinutes: db
      .prepare("SELECT delivery_minutes FROM restaurants WHERE id = ?")
      .get(order.restaurant_id).delivery_minutes,
    paid: Math.round(order.total * 100) / 100,
  });
});

app.get("/api/orders/:id", (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });

  const items = db
    .prepare("SELECT name, price, qty FROM order_items WHERE order_id = ?")
    .all(order.id);
  const restaurant = db
    .prepare("SELECT name, emoji, delivery_minutes FROM restaurants WHERE id = ?")
    .get(order.restaurant_id);

  res.json({ ...order, items, restaurant });
});

app.listen(PORT, () => {
  console.log(`QuickDrop API listening on http://localhost:${PORT}`);
});
