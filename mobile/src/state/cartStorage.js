import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  CART_STORAGE_KEY,
  parseStoredCart,
  serializeCart,
} from "./cartPersistence.js";

/**
 * Storage is best-effort: a denied/limit-hit/quota-exceeded write must never
 * break the shopping flow, and the cart simply does not survive the reload.
 *
 * Writes are chained instead of fired in parallel. Two rapid cart edits produce
 * two `setItem` calls that can resolve out of order, which would leave an older
 * cart on disk than the one on screen.
 */
let queue = Promise.resolve();

function enqueue(task) {
  const next = queue.then(task, task);
  // Keep the chain alive even if one task rejects.
  queue = next.then(
    () => {},
    () => {}
  );
  return next;
}

export function loadStoredCart() {
  return enqueue(async () => {
    try {
      return parseStoredCart(await AsyncStorage.getItem(CART_STORAGE_KEY));
    } catch {
      return null;
    }
  });
}

export function saveStoredCart(cart) {
  return enqueue(async () => {
    try {
      if (!cart || cart.items.length === 0) {
        await AsyncStorage.removeItem(CART_STORAGE_KEY);
        return;
      }
      await AsyncStorage.setItem(CART_STORAGE_KEY, serializeCart(cart));
    } catch {
      // Ignored on purpose: persistence is an optimisation, not an invariant.
    }
  });
}

export function clearStoredCart() {
  return enqueue(async () => {
    try {
      await AsyncStorage.removeItem(CART_STORAGE_KEY);
    } catch {
      // See above.
    }
  });
}
