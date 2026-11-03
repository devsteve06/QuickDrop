import assert from "node:assert/strict";
import test from "node:test";
import {
  LIMITS,
  toOrderPayload,
  validateCheckout,
} from "../src/lib/checkoutValidation.js";

test("a complete form passes and is trimmed", () => {
  const result = validateCheckout({
    customerName: "  Alex Rivera ",
    address: "  12 Bridge Street, Flat 3  ",
    phone: " +44 7700 900123 ",
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, {});
  assert.deepEqual(result.values, {
    customerName: "Alex Rivera",
    address: "12 Bridge Street, Flat 3",
    phone: "+44 7700 900123",
  });
});

test("name and address are required", () => {
  const result = validateCheckout({ customerName: "   ", address: "", phone: "" });

  assert.equal(result.valid, false);
  assert.ok(result.errors.customerName);
  assert.ok(result.errors.address);
  assert.equal(result.errors.phone, undefined);
});

test("phone is optional and empty is accepted", () => {
  assert.equal(validateCheckout({ customerName: "A", address: "B" }).valid, true);
  assert.equal(
    validateCheckout({ customerName: "A", address: "B", phone: "   " }).valid,
    true
  );
});

test("name and address respect the server's length limits", () => {
  const longName = validateCheckout({
    customerName: "a".repeat(LIMITS.customerName + 1),
    address: "B",
  });
  const longAddress = validateCheckout({
    customerName: "A",
    address: "b".repeat(LIMITS.address + 1),
  });
  const atLimit = validateCheckout({
    customerName: "a".repeat(LIMITS.customerName),
    address: "b".repeat(LIMITS.address),
  });

  assert.ok(longName.errors.customerName);
  assert.ok(longAddress.errors.address);
  assert.equal(atLimit.valid, true);
});

test("phone accepts the formats the API accepts", () => {
  for (const phone of ["+44 7700 900123", "(555) 123-4567", "555.123.4567", "+1-555-123-4567"]) {
    assert.equal(
      validateCheckout({ customerName: "A", address: "B", phone }).valid,
      true,
      `${phone} should be valid`
    );
  }
});

test("phone rejects letters, too-short, and too-long values", () => {
  for (const phone of ["call me", "12345", "1".repeat(21), "+1 555 CALL NOW"]) {
    const result = validateCheckout({ customerName: "A", address: "B", phone });
    assert.equal(result.valid, false, `${phone} should be rejected`);
    assert.ok(result.errors.phone);
  }
});

test("the order payload never carries money", () => {
  const cart = {
    restaurantId: 7,
    items: [
      { id: 71, name: "Chilli noodles", price: 12.4, qty: 2 },
      { id: 72, name: "Jasmine tea", price: 3.1, qty: 1 },
    ],
  };

  const payload = toOrderPayload(cart, {
    customerName: "Alex",
    address: "12 Bridge Street",
    phone: "",
  });

  assert.deepEqual(payload, {
    restaurantId: 7,
    customerName: "Alex",
    address: "12 Bridge Street",
    phone: "",
    items: [
      { id: 71, qty: 2 },
      { id: 72, qty: 1 },
    ],
  });

  const serialized = JSON.stringify(payload);
  assert.ok(!serialized.includes("price"), "no price field should be sent");
  assert.ok(!serialized.includes("12.4"), "no price value should be sent");
});
