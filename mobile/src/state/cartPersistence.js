import { emptyCart, normalizeCart } from "./cartReducer.js";

// Bump the version when the persisted shape changes. A cart written by an older
// build is discarded instead of being coerced, so a stale payload can never
// produce nonsense prices.
export const CART_STORAGE_KEY = "quickdrop.cart.v1";
export const CART_SCHEMA_VERSION = 1;

export function serializeCart(cart) {
  return JSON.stringify({
    version: CART_SCHEMA_VERSION,
    cart: {
      restaurantId: cart.restaurantId,
      restaurantName: cart.restaurantName,
      restaurantEmoji: cart.restaurantEmoji,
      deliveryFee: cart.deliveryFee,
      items: cart.items,
    },
  });
}

/**
 * Returns a usable cart, or null when there is nothing worth restoring.
 * Never throws: corrupt JSON, a wrong version, or a missing payload all
 * degrade to null.
 */
export function parseStoredCart(raw) {
  if (typeof raw !== "string" || raw.trim() === "") return null;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  if (parsed.version !== CART_SCHEMA_VERSION) return null;

  const cart = normalizeCart(parsed.cart);
  return cart.items.length > 0 ? cart : null;
}

export { emptyCart };
