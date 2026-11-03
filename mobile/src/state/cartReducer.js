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
