import assert from "node:assert/strict";
import test from "node:test";
import {
  CART_SCHEMA_VERSION,
  CART_STORAGE_KEY,
  parseStoredCart,
  serializeCart,
} from "../src/state/cartPersistence.js";
import { MAX_QTY, selectTotal } from "../src/state/cartReducer.js";

const cart = {
  restaurantId: 7,
  restaurantName: "Basil & Bean",
  restaurantEmoji: "🍜",
  deliveryFee: 2.5,
  items: [{ id: 71, name: "Chilli noodles", price: 12.4, qty: 2 }],
};

test("the storage key is versioned", () => {
  assert.equal(CART_STORAGE_KEY, "quickdrop.cart.v1");
  assert.equal(CART_SCHEMA_VERSION, 1);
});

test("a cart survives serialize -> parse unchanged", () => {
  const restored = parseStoredCart(serializeCart(cart));

  assert.deepEqual(restored, cart);
  assert.equal(selectTotal(restored), selectTotal(cart));
});

test("the payload carries its schema version", () => {
  assert.equal(JSON.parse(serializeCart(cart)).version, CART_SCHEMA_VERSION);
});

test("nothing stored, or junk stored, restores nothing", () => {
  assert.equal(parseStoredCart(null), null);
  assert.equal(parseStoredCart(""), null);
  assert.equal(parseStoredCart("   "), null);
  assert.equal(parseStoredCart("not json {"), null);
  assert.equal(parseStoredCart("null"), null);
  assert.equal(parseStoredCart("[1,2,3]"), null);
});

test("a payload from a different schema version is discarded", () => {
  const payload = JSON.stringify({ version: 0, cart });

  assert.equal(parseStoredCart(payload), null);
});

test("a payload with an empty cart restores nothing", () => {
  const payload = JSON.stringify({ version: CART_SCHEMA_VERSION, cart: { items: [] } });

  assert.equal(parseStoredCart(payload), null);
});

test("a payload with no cart key restores nothing", () => {
  assert.equal(parseStoredCart(JSON.stringify({ version: CART_SCHEMA_VERSION })), null);
});

test("partially corrupt payloads keep only the usable lines", () => {
  const payload = JSON.stringify({
    version: CART_SCHEMA_VERSION,
    cart: {
      restaurantId: 7,
      restaurantName: "Basil & Bean",
      deliveryFee: 2.5,
      items: [
        { id: 71, name: "Chilli noodles", price: 12.4, qty: 2 },
        { id: 71, name: "Chilli noodles", price: 12.4, qty: 9 },
        { id: "x", name: "junk", price: 1, qty: 1 },
      ],
    },
  });

  const restored = parseStoredCart(payload);

  assert.equal(restored.items.length, 1);
  assert.equal(restored.items[0].qty, 2, "first occurrence wins");
});

test("a tampered quantity is clamped on the way back in", () => {
  const payload = JSON.stringify({
    version: CART_SCHEMA_VERSION,
    cart: {
      restaurantId: 7,
      deliveryFee: 2.5,
      items: [{ id: 71, name: "Chilli noodles", price: 12.4, qty: 100000 }],
    },
  });

  assert.equal(parseStoredCart(payload).items[0].qty, MAX_QTY);
});
