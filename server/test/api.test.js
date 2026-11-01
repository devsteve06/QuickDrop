import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

// Point the API at a throwaway database before any module imports it.
const dbPath = path.join(os.tmpdir(), `quickdrop-test-${process.pid}-${Date.now()}.db`);
process.env.QUICKDROP_DB = dbPath;

const { createApp } = await import("../src/app.js");
const { db } = await import("../src/db.js");
const { seedDatabase } = await import("../src/seed.js");
const request = (await import("supertest")).default;

const app = createApp();

const countOrders = () => db.prepare("SELECT COUNT(*) AS c FROM orders").get().c;

async function getRestaurant(id) {
  const res = await request(app).get(`/api/restaurants/${id}`);
  assert.equal(res.status, 200);
  return res.body;
}

async function firstRestaurant() {
  const res = await request(app).get("/api/restaurants");
  assert.equal(res.status, 200);
  return getRestaurant(res.body[0].id);
}

function payload(restaurant, overrides = {}) {
  return {
    restaurantId: restaurant.id,
    customerName: "Test User",
    address: "1 Test Street",
    phone: "+254 700 000000",
    items: [{ id: restaurant.menu[0].id, qty: 2 }],
    ...overrides,
  };
}

before(() => {
  seedDatabase(db);
});

after(() => {
  db.close();
  fs.rmSync(dbPath, { force: true });
});

describe("health", () => {
  it("reports the API as healthy", async () => {
    const res = await request(app).get("/api/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
  });
});

describe("restaurants", () => {
  it("lists restaurants sorted by rating, best first", async () => {
    const res = await request(app).get("/api/restaurants");
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 4);
    const ratings = res.body.map((r) => r.rating);
    assert.deepEqual(ratings, [...ratings].sort((a, b) => b - a));
  });

  it("returns a restaurant with its menu", async () => {
    const restaurant = await firstRestaurant();
    assert.equal(restaurant.menu.length, 4);
    assert.equal(typeof restaurant.menu[0].price, "number");
  });

  it("returns 404 for an unknown restaurant", async () => {
    const res = await request(app).get("/api/restaurants/999999");
    assert.equal(res.status, 404);
    assert.equal(res.body.error, "Restaurant not found");
  });

  it("returns 400 for a non-numeric restaurant id", async () => {
    const res = await request(app).get("/api/restaurants/not-a-number");
    assert.equal(res.status, 400);
  });
});

describe("orders", () => {
  it("creates an order priced from the database", async () => {
    const restaurant = await firstRestaurant();
    const item = restaurant.menu[0];
    const res = await request(app).post("/api/orders").send(payload(restaurant));

    assert.equal(res.status, 201);
    assert.equal(res.body.orderId > 0, true);
    assert.equal(res.body.status, "pending_payment");

    const expectedSubtotal = Math.round(item.price * 2 * 100) / 100;
    const expectedTotal =
      Math.round((expectedSubtotal + restaurant.delivery_fee) * 100) / 100;
    assert.equal(res.body.subtotal, expectedSubtotal);
    assert.equal(res.body.deliveryFee, restaurant.delivery_fee);
    assert.equal(res.body.total, expectedTotal);

    const detail = await request(app).get(`/api/orders/${res.body.orderId}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.status, "pending_payment");
    assert.equal(detail.body.items.length, 1);
    assert.equal(detail.body.items[0].name, item.name);
    assert.equal(detail.body.items[0].qty, 2);
    assert.equal(detail.body.restaurant.name, restaurant.name);
  });

  it("accepts an order without a phone number", async () => {
    const restaurant = await firstRestaurant();
    const res = await request(app)
      .post("/api/orders")
      .send(payload(restaurant, { phone: undefined }));
    assert.equal(res.status, 201);
  });

  it("rejects missing or blank customer details without inserting an order", async () => {
    const restaurant = await firstRestaurant();
    const before = countOrders();

    for (const overrides of [
      { customerName: undefined },
      { customerName: "   " },
      { address: undefined },
      { address: "  " },
      { customerName: "x".repeat(81) },
      { phone: "abc" },
    ]) {
      const res = await request(app).post("/api/orders").send(payload(restaurant, overrides));
      assert.equal(res.status, 400, JSON.stringify(overrides));
    }

    assert.equal(countOrders(), before);
  });

  it("rejects malformed item lists without inserting an order", async () => {
    const restaurant = await firstRestaurant();
    const before = countOrders();

    for (const overrides of [
      { items: [] },
      { items: "nope" },
      { items: [{ id: restaurant.menu[0].id, qty: 0 }] },
      { items: [{ id: restaurant.menu[0].id, qty: 1.5 }] },
      { items: [{ id: restaurant.menu[0].id, qty: "2" }] },
      { items: [{ id: restaurant.menu[0].id, qty: 1 }, { id: restaurant.menu[0].id, qty: 1 }] },
      { items: [{ id: 999999, qty: 1 }] },
    ]) {
      const res = await request(app).post("/api/orders").send(payload(restaurant, overrides));
      assert.equal(res.status, 400, JSON.stringify(overrides));
    }

    assert.equal(countOrders(), before);
  });

  it("rejects a menu item that belongs to another restaurant", async () => {
    const res = await request(app).get("/api/restaurants");
    const first = await getRestaurant(res.body[0].id);
    const second = await getRestaurant(res.body[1].id);
    const before = countOrders();

    const response = await request(app)
      .post("/api/orders")
      .send(payload(first, { items: [{ id: second.menu[0].id, qty: 1 }] }));

    assert.equal(response.status, 400);
    assert.equal(countOrders(), before);
  });

  it("returns 404 when ordering from an unknown restaurant", async () => {
    const restaurant = await firstRestaurant();
    const res = await request(app)
      .post("/api/orders")
      .send(payload(restaurant, { restaurantId: 999999 }));
    assert.equal(res.status, 404);
  });

  it("rejects malformed JSON with a JSON error body", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Content-Type", "application/json")
      .send("{not json");
    assert.equal(res.status, 400);
    assert.equal(res.body.error, "Invalid JSON body");
  });

  it("simulates payment exactly once", async () => {
    const restaurant = await firstRestaurant();
    const created = await request(app).post("/api/orders").send(payload(restaurant));
    assert.equal(created.status, 201);

    const paid = await request(app).post(`/api/orders/${created.body.orderId}/pay`);
    assert.equal(paid.status, 200);
    assert.equal(paid.body.status, "preparing");
    assert.equal(paid.body.etaMinutes, restaurant.delivery_minutes);
    assert.equal(paid.body.paid, created.body.total);

    const again = await request(app).post(`/api/orders/${created.body.orderId}/pay`);
    assert.equal(again.status, 409);

    const detail = await request(app).get(`/api/orders/${created.body.orderId}`);
    assert.equal(detail.body.status, "preparing");
  });

  it("returns 404 when paying or fetching an unknown order", async () => {
    assert.equal((await request(app).post("/api/orders/999999/pay")).status, 404);
    assert.equal((await request(app).get("/api/orders/999999")).status, 404);
  });
});

describe("unknown routes", () => {
  it("returns a JSON 404", async () => {
    const res = await request(app).get("/api/does-not-exist");
    assert.equal(res.status, 404);
    assert.equal(res.body.error, "Not found");
  });
});
