import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import {
  cartReducer,
  emptyCart,
  selectItemCount,
  selectSubtotal,
  selectTotal,
} from "./cartReducer";
import { loadStoredCart, saveStoredCart } from "./cartStorage";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cart, dispatch] = useReducer(cartReducer, emptyCart);

  // False until the persisted cart has been read (or found to be absent). Screens
  // use it to tell "empty cart" apart from "we do not know yet".
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = await loadStoredCart();
      if (cancelled) return;
      if (stored) dispatch({ type: "HYDRATE", cart: stored });
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Only persist after hydration, otherwise the initial empty cart would wipe
  // the stored one before it is read back.
  useEffect(() => {
    if (!hydrated) return;
    saveStoredCart(cart);
  }, [cart, hydrated]);

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
      hydrated,
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
    [cart, hydrated, addItem, increment, decrement, removeItem, clearCart, replaceWithItem]
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
