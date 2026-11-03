import assert from "node:assert/strict";
import test from "node:test";
import { formatMoney, formatOrderTime, pluralize, round2 } from "../src/lib/format.js";

test("formatMoney always shows two decimals", () => {
  assert.equal(formatMoney(0), "$0.00");
  assert.equal(formatMoney(12.4), "$12.40");
  assert.equal(formatMoney(12.456), "$12.46");
  assert.equal(formatMoney("3.1"), "$3.10");
});

test("formatMoney falls back instead of printing NaN", () => {
  assert.equal(formatMoney(undefined), "$0.00");
  assert.equal(formatMoney("not a number"), "$0.00");
});

test("round2 handles float noise both ways", () => {
  assert.equal(round2(0.1 + 0.2), 0.3);
  assert.equal(round2(1.005), 1.01);
  assert.equal(round2(2.675), 2.68);
});

test("pluralize picks the right form", () => {
  assert.equal(pluralize(1, "item"), "1 item");
  assert.equal(pluralize(2, "item"), "2 items");
  assert.equal(pluralize(0, "line item"), "0 line items");
});

test("formatOrderTime parses SQLite's UTC timestamp", () => {
  const formatted = formatOrderTime("2026-11-03 14:02:00");

  assert.equal(typeof formatted, "string");
  assert.notEqual(formatted, "");
  assert.ok(!formatted.includes("Invalid"), `unexpected output: ${formatted}`);
});

test("formatOrderTime degrades to an empty string, never a crash", () => {
  assert.equal(formatOrderTime(undefined), "");
  assert.equal(formatOrderTime(""), "");
  assert.equal(formatOrderTime("not a date"), "");
});
