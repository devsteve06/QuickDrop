import { round2 } from "../lib/format.js";

export const MAX_QTY = 99;

export const emptyCart = {
  restaurantId: null,
  restaurantName: "",
  restaurantEmoji: "",
  deliveryFee: 0,
  items: [],
};

const clampQty = (qty) => Math.min(Math.max(qty, 1), MAX_QTY);

const isPositiveInt = (value) => Number.isInteger(value) && value > 0;

function normalizeLine(line) {
  if (!line || typeof line !== "object") return null;

  const id = Number(line.id);
  const price = Number(line.price);
  const qty = Number(line.qty);

  if (!isPositiveInt(id)) return null;
  if (typeof line.name !== "string" || !line.name.trim()) return null;
  if (!Number.isFinite(price) || price < 0) return null;
  if (!isPositiveInt(qty)) return null;

  return { id, name: line.name, price: round2(price), qty: clampQty(qty) };
}

/**
 * Turns untrusted data (a persisted cart from an older build, a hand-edited
 * AsyncStorage value) into a cart this app can render. Anything unrecognisable
 * collapses to an empty cart rather than throwing.
 */
export function normalizeCart(value) {
  if (!value || typeof value !== "object") return emptyCart;

  const restaurantId = Number(value.restaurantId);
  if (!isPositiveInt(restaurantId)) return emptyCart;

  const seen = new Set();
  const items = [];
  for (const line of Array.isArray(value.items) ? value.items : []) {
    const clean = normalizeLine(line);
    if (!clean || seen.has(clean.id)) continue;
    seen.add(clean.id);
    items.push(clean);
  }
  if (items.length === 0) return emptyCart;

  const fee = Number(value.deliveryFee);
  return {
    restaurantId,
    restaurantName: typeof value.restaurantName === "string" ? value.restaurantName : "",
    restaurantEmoji: typeof value.restaurantEmoji === "string" ? value.restaurantEmoji : "",
    deliveryFee: Number.isFinite(fee) && fee >= 0 ? round2(fee) : 0,
    items,
  };
}

/**
 * Pure cart reducer. The single-restaurant invariant lives here, not in the UI:
 * ADD refuses items from a different restaurant. The UI asks the user first, then
 * dispatches REPLACE_RESTAURANT.
 */
export function cartReducer(state, action) {
  switch (action.type) {
    case "ADD": {
      const { restaurant, item } = action;
      if (!restaurant || !item) return state;
      if (state.restaurantId !== null && state.restaurantId !== restaurant.id) {
        return state;
      }

      const existing = state.items.find((line) => line.id === item.id);
      const items = existing
        ? state.items.map((line) =>
            line.id === item.id ? { ...line, qty: clampQty(line.qty + 1) } : line
          )
        : [...state.items, { id: item.id, name: item.name, price: item.price, qty: 1 }];

      return {
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        restaurantEmoji: restaurant.emoji ?? "",
        deliveryFee: Number(restaurant.deliveryFee) || 0,
        items,
      };
    }

    case "INC": {
      return {
        ...state,
        items: state.items.map((line) =>
          line.id === action.id ? { ...line, qty: clampQty(line.qty + 1) } : line
        ),
      };
    }

    case "DEC": {
      return {
        ...state,
        items: state.items.map((line) =>
          line.id === action.id ? { ...line, qty: clampQty(line.qty - 1) } : line
        ),
      };
    }

    case "REMOVE": {
      const items = state.items.filter((line) => line.id !== action.id);
      return items.length === 0 ? emptyCart : { ...state, items };
    }

    case "CLEAR":
      return emptyCart;

    // Restores a persisted cart after launch. Ignored if the user already added
    // something while storage was still loading, so a slow disk read can never
    // clobber fresh input.
    case "HYDRATE": {
      if (state.items.length > 0) return state;
      return normalizeCart(action.cart);
    }

    case "REPLACE_RESTAURANT": {
      const { restaurant, item } = action;
      if (!restaurant || !item) return state;
      return {
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        restaurantEmoji: restaurant.emoji ?? "",
        deliveryFee: Number(restaurant.deliveryFee) || 0,
        items: [{ id: item.id, name: item.name, price: item.price, qty: 1 }],
      };
    }

    default:
      return state;
  }
}

export const selectItemCount = (state) =>
  state.items.reduce((count, line) => count + line.qty, 0);

export const selectSubtotal = (state) =>
  round2(state.items.reduce((sum, line) => sum + line.price * line.qty, 0));

export const selectTotal = (state) =>
  round2(selectSubtotal(state) + (state.items.length > 0 ? Number(state.deliveryFee) || 0 : 0));
