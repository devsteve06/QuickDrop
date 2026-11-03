import assert from "node:assert/strict";
import test from "node:test";
import { payOrdered, placeOrder, wasAlreadyPaid } from "../src/api/orderFlow.js";

const payload = { restaurantId: 7, customerName: "Alex", address: "12 Bridge St", items: [] };

test("placeOrder creates then pays and reports success", async () => {
  const calls = [];
  const createOrder = async (body) => {
    calls.push(["create", body]);
    return { orderId: 12, status: "pending_payment", total: 25.3 };
  };
  const payOrder = async (id) => {
    calls.push(["pay", id]);
    return { orderId: id, status: "preparing", etaMinutes: 25, paid: 25.3 };
  };

  const result = await placeOrder(createOrder, payOrder, payload);

  assert.equal(result.orderId, 12);
  assert.equal(result.paid, true);
  assert.equal(result.error, null);
  assert.equal(result.payment.status, "preparing");
  assert.deepEqual(calls, [
    ["create", payload],
    ["pay", 12],
  ]);
});

test("placeOrder surfaces a create failure and never pays", async () => {
  let paid = false;
  const createOrder = async () => {
    throw new Error("Restaurant not found");
  };
  const payOrder = async () => {
    paid = true;
  };

  await assert.rejects(() => placeOrder(createOrder, payOrder, payload), /Restaurant not found/);
  assert.equal(paid, false, "nothing should be paid when creation failed");
});

test("placeOrder keeps the order id when only payment fails", async () => {
  const createOrder = async () => ({ orderId: 12 });
  const payOrder = async () => {
    throw new Error("Network down");
  };

  const result = await placeOrder(createOrder, payOrder, payload);

  assert.equal(result.orderId, 12);
  assert.equal(result.paid, false);
  assert.match(result.error.message, /Network down/);
});

test("placeOrder rejects a response without an order id", async () => {
  await assert.rejects(
    () => placeOrder(async () => ({}), async () => ({ status: "preparing" }), payload),
    /did not return an order id/
  );
});

test("payOrdered retries payment on an existing order", async () => {
  const result = await payOrdered(12, async (id) => ({ orderId: id, status: "preparing" }));

  assert.equal(result.paid, true);
  assert.equal(result.payment.orderId, 12);
});

test("payOrdered reports a failed retry without losing the id", async () => {
  const result = await payOrdered(12, async () => {
    throw new Error("Order is already preparing");
  });

  assert.equal(result.orderId, 12);
  assert.equal(result.paid, false);
  assert.match(result.error.message, /already preparing/);
});

test("a 409 is treated as already paid, anything else is a real failure", () => {
  const conflict = Object.assign(new Error("Order is already preparing"), { status: 409 });
  const serverError = Object.assign(new Error("Internal server error"), { status: 500 });
  const networkError = new Error("Can't reach the API");

  assert.equal(wasAlreadyPaid(conflict), true);
  assert.equal(wasAlreadyPaid(serverError), false);
  assert.equal(wasAlreadyPaid(networkError), false);
  assert.equal(wasAlreadyPaid(null), false);
});
