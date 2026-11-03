import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_QTY,
  cartReducer,
  emptyCart,
  normalizeCart,
  selectItemCount,
  selectSubtotal,
  selectTotal,
} from "../src/state/cartReducer.js";

const restaurant = {
  id: 7,
  name: "Basil & Bean",
  emoji: "🍜",
  deliveryFee: 2.5,
};

const otherRestaurant = {
  id: 9,
  name: "Taco Theory",
  emoji: "🌮",
  deliveryFee: 1.5,
};

const noodles = { id: 71, name: "Chilli noodles", price: 12.4 };
const tea = { id: 72, name: "Jasmine tea", price: 3.1 };

const add = (state, item = noodles, from = restaurant) =>
  cartReducer(state, { type: "ADD", restaurant: from, item });

// --- ADD ---------------------------------------------------------------

test("ADD opens a cart with the restaurant details", () => {
  const cart = add(emptyCart);

  assert.equal(cart.restaurantId, restaurant.id);
  assert.equal(cart.restaurantName, restaurant.name);
  assert.equal(cart.restaurantEmoji, restaurant.emoji);
  assert.equal(cart.deliveryFee, restaurant.deliveryFee);
  assert.deepEqual(cart.items, [
    { id: noodles.id, name: noodles.name, price: noodles.price, qty: 1 },
  ]);
});

test("ADD of an item already in the cart increments instead of duplicating", () => {
  const cart = add(add(emptyCart), noodles);

  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0].qty, 2);
});

test("ADD of a second item from the same restaurant appends a line", () => {
  const cart = add(add(emptyCart, noodles), tea);

  assert.equal(cart.items.length, 2);
  assert.deepEqual(
    cart.items.map((line) => line.id),
    [noodles.id, tea.id]
  );
});

test("ADD refuses an item from a different restaurant", () => {
  const start = add(emptyCart);
  const cart = add(start, { id: 91, name: "Al pastor", price: 9 }, otherRestaurant);

  assert.equal(cart, start, "state should be returned untouched");
  assert.equal(cart.restaurantId, restaurant.id);
});

test("ADD with a missing item or restaurant is a no-op", () => {
  assert.equal(cartReducer(emptyCart, { type: "ADD" }), emptyCart);
  assert.equal(
    cartReducer(emptyCart, { type: "ADD", restaurant, item: null }),
    emptyCart
  );
});

// --- INC / DEC ---------------------------------------------------------

test("INC and DEC move quantity by one", () => {
  const one = add(emptyCart);
  assert.equal(cartReducer(one, { type: "INC", id: noodles.id }).items[0].qty, 2);
  assert.equal(
    cartReducer(cartReducer(one, { type: "INC", id: noodles.id }), {
      type: "DEC",
      id: noodles.id,
    }).items[0].qty,
    1
  );
});

test("DEC stops at 1 instead of reaching zero", () => {
  const cart = cartReducer(add(emptyCart), { type: "DEC", id: noodles.id });
  assert.equal(cart.items[0].qty, 1);
});

test("INC stops at MAX_QTY", () => {
  let cart = add(emptyCart);
  for (let i = 0; i < MAX_QTY + 5; i += 1) {
    cart = cartReducer(cart, { type: "INC", id: noodles.id });
  }
  assert.equal(cart.items[0].qty, MAX_QTY);
});

test("INC/DEC ignore unknown item ids", () => {
  const cart = add(emptyCart);
  assert.equal(cartReducer(cart, { type: "INC", id: 999 }).items[0].qty, 1);
  assert.equal(cartReducer(cart, { type: "DEC", id: 999 }).items[0].qty, 1);
});

// --- REMOVE / CLEAR ----------------------------------------------------

test("REMOVE drops one line and keeps the restaurant", () => {
  const cart = cartReducer(add(add(emptyCart, noodles), tea), {
    type: "REMOVE",
    id: noodles.id,
  });

  assert.deepEqual(
    cart.items.map((line) => line.id),
    [tea.id]
  );
  assert.equal(cart.restaurantId, restaurant.id);
});

test("REMOVE of the last line resets the whole cart", () => {
  const cart = cartReducer(add(emptyCart), { type: "REMOVE", id: noodles.id });

  assert.equal(cart.restaurantId, null);
  assert.equal(cart.restaurantName, "");
  assert.deepEqual(cart.items, []);
});

test("CLEAR returns the empty cart", () => {
  const cart = cartReducer(add(emptyCart), { type: "CLEAR" });
  assert.deepEqual(cart, emptyCart);
});

// --- REPLACE_RESTAURANT ------------------------------------------------

test("REPLACE_RESTAURANT swaps restaurant and starts a single-line cart", () => {
  const cart = cartReducer(add(emptyCart), {
    type: "REPLACE_RESTAURANT",
    restaurant: otherRestaurant,
    item: { id: 91, name: "Al pastor", price: 9 },
  });

  assert.equal(cart.restaurantId, otherRestaurant.id);
  assert.equal(cart.deliveryFee, otherRestaurant.deliveryFee);
  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0].id, 91);
  assert.equal(cart.items[0].qty, 1);
});

// --- HYDRATE -----------------------------------------------------------

const storedCart = {
  restaurantId: 7,
  restaurantName: "Basil & Bean",
  restaurantEmoji: "🍜",
  deliveryFee: 2.5,
  items: [{ id: 71, name: "Chilli noodles", price: 12.4, qty: 3 }],
};

test("HYDRATE restores a persisted cart into an empty one", () => {
  const cart = cartReducer(emptyCart, { type: "HYDRATE", cart: storedCart });

  assert.equal(cart.restaurantId, 7);
  assert.equal(cart.items[0].qty, 3);
});

test("HYDRATE never overwrites items the user already added", () => {
  const started = add(emptyCart);
  const cart = cartReducer(started, { type: "HYDRATE", cart: storedCart });

  assert.equal(cart, started);
});

test("HYDRATE of junk leaves the cart empty", () => {
  assert.deepEqual(cartReducer(emptyCart, { type: "HYDRATE", cart: null }), emptyCart);
  assert.deepEqual(
    cartReducer(emptyCart, { type: "HYDRATE", cart: { restaurantId: "x" } }),
    emptyCart
  );
});

// --- normalizeCart -----------------------------------------------------

test("normalizeCart drops malformed lines and keeps the valid ones", () => {
  const cart = normalizeCart({
    restaurantId: 7,
    restaurantName: "Basil & Bean",
    deliveryFee: 2.5,
    items: [
      { id: 71, name: "Chilli noodles", price: 12.4, qty: 2 },
      { id: "nope", name: "Broken id", price: 1, qty: 1 },
      { id: 73, name: "", price: 1, qty: 1 },
      { id: 74, name: "Negative price", price: -1, qty: 1 },
      { id: 75, name: "Zero qty", price: 1, qty: 0 },
      null,
    ],
  });

  assert.deepEqual(
    cart.items.map((line) => line.id),
    [71]
  );
});

test("normalizeCart collapses duplicate ids and clamps quantity", () => {
  const cart = normalizeCart({
    restaurantId: 7,
    items: [
      { id: 71, name: "Chilli noodles", price: 12.4, qty: 500 },
      { id: 71, name: "Chilli noodles", price: 12.4, qty: 2 },
    ],
  });

  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0].qty, MAX_QTY);
});

test("normalizeCart rounds prices and falls back on bad metadata", () => {
  const cart = normalizeCart({
    restaurantId: 7,
    restaurantName: 42,
    restaurantEmoji: null,
    deliveryFee: "free",
    items: [{ id: 71, name: "Chilli noodles", price: 12.345, qty: 1 }],
  });

  assert.equal(cart.restaurantName, "");
  assert.equal(cart.restaurantEmoji, "");
  assert.equal(cart.deliveryFee, 0);
  assert.equal(cart.items[0].price, 12.35);
});

test("normalizeCart of a cart with no usable items is empty", () => {
  assert.deepEqual(normalizeCart(null), emptyCart);
  assert.deepEqual(normalizeCart({ restaurantId: 7, items: [] }), emptyCart);
});

// --- selectors ---------------------------------------------------------

test("selectors count quantities, sum lines, and add the fee", () => {
  const cart = add(add(add(emptyCart, noodles), noodles), tea);

  assert.equal(selectItemCount(cart), 3);
  assert.equal(selectSubtotal(cart), 27.9); // 12.4 * 2 + 3.1
  assert.equal(selectTotal(cart), 30.4); // + 2.5 delivery
});

test("selectors round float noise to the cent", () => {
  const cart = normalizeCart({
    restaurantId: 7,
    deliveryFee: 0.1,
    items: [
      { id: 1, name: "A", price: 0.1, qty: 1 },
      { id: 2, name: "B", price: 0.2, qty: 1 },
    ],
  });

  assert.equal(selectSubtotal(cart), 0.3);
  assert.equal(selectTotal(cart), 0.4);
});

test("an empty cart totals zero even with a stale delivery fee", () => {
  assert.equal(selectItemCount(emptyCart), 0);
  assert.equal(selectSubtotal(emptyCart), 0);
  assert.equal(selectTotal({ ...emptyCart, deliveryFee: 2.5 }), 0);
});
