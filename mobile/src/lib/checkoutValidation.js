// Client-side checkout rules. They intentionally mirror the server's validation in
// server/src/app.js so a form that passes here is not rejected there; the server stays
// authoritative and its error is still surfaced inline.
export const LIMITS = {
  customerName: 80,
  address: 200,
};

// Same character class the API accepts, so the two cannot disagree.
const PHONE_PATTERN = /^[+()\d\s.-]{6,20}$/;

export function validateCheckout(fields = {}) {
  const customerName = typeof fields.customerName === "string" ? fields.customerName.trim() : "";
  const address = typeof fields.address === "string" ? fields.address.trim() : "";
  const phone = typeof fields.phone === "string" ? fields.phone.trim() : "";

  const errors = {};

  if (!customerName) {
    errors.customerName = "Add the name to deliver under.";
  } else if (customerName.length > LIMITS.customerName) {
    errors.customerName = `Keep the name to ${LIMITS.customerName} characters or fewer.`;
  }

  if (!address) {
    errors.address = "Add a delivery address.";
  } else if (address.length > LIMITS.address) {
    errors.address = `Keep the address to ${LIMITS.address} characters or fewer.`;
  }

  if (phone && !PHONE_PATTERN.test(phone)) {
    errors.phone = "Use 6–20 characters: digits, spaces, + ( ) - .";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    values: { customerName, address, phone },
  };
}

/**
 * The order body the API expects. Prices are deliberately omitted: the server
 * prices every line from the database, and sending money from the client would
 * hand a tampered cart the final say.
 */
export function toOrderPayload(cart, values) {
  return {
    restaurantId: cart.restaurantId,
    customerName: values.customerName,
    address: values.address,
    phone: values.phone,
    items: cart.items.map((line) => ({ id: line.id, qty: line.qty })),
  };
}
