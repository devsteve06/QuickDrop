import { createContext, useCallback, useContext, useMemo, useReducer } from "react";
import {
  cartReducer,
  emptyCart,
  selectItemCount,
  selectSubtotal,
  selectTotal,
} from "./cartReducer";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cart, dispatch] = useReducer(cartReducer, emptyCart);

  const addItem = useCallback((restaurant, item) => {
    dispatch({ type: "ADD", restaurant, item });
  }, []);
  const increment = useCallback((id) => dispatch({ type: "INC", id }), []);
  const decrement = useCallback((id) => dispatch({ type: "DEC", id }), []);
  const removeItem = useCallback((id) => dispatch({ type: "REMOVE", id }), []);
  const clearCart = useCallback(() => dispatch({ type: "CLEAR" }), []);
  const replaceWithItem = useCallback((restaurant, item) => {
    dispatch({ type: "REPLACE_RESTAURANT", restaurant, item });
  }, []);

  const value = useMemo(
    () => ({
      cart,
      addItem,
      increment,
      decrement,
      removeItem,
      clearCart,
      replaceWithItem,
      itemCount: selectItemCount(cart),
      subtotal: selectSubtotal(cart),
      total: selectTotal(cart),
      qtyFor: (id) => cart.items.find((line) => line.id === id)?.qty ?? 0,
    }),
    [cart, addItem, increment, decrement, removeItem, clearCart, replaceWithItem]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used inside <CartProvider>");
  }
  return context;
}

export { MAX_QTY } from "./cartReducer";
