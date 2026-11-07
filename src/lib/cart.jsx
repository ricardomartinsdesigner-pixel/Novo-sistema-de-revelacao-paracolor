import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { cartLineTotal, cartPhotoCount, normalizeCartItem } from "@/lib/cart-items";
import { uid } from "@/lib/uid";

const STORAGE_KEY = "paracolor.cart.v1";
const CartContext = createContext(null);

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const items = Array.isArray(parsed) ? parsed : parsed.items || [];
    return { items: items.map(normalizeCartItem), checkoutKey: parsed.checkoutKey || uid() };
  } catch {
    return { items: [], checkoutKey: uid() };
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);
  const [checkoutKey, setCheckoutKey] = useState("");

  useEffect(() => {
    const stored = readStored();
    setItems(stored.items);
    setCheckoutKey(stored.checkoutKey);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, checkoutKey }));
    } catch {
      /* storage full — keep the in-memory cart working */
    }
  }, [items, ready, checkoutKey]);

  const addItems = useCallback((newItems) => {
    setItems((current) => [...current, ...newItems.map(normalizeCartItem)]);
    setCheckoutKey(uid());
  }, []);

  const removeItem = useCallback((key) => {
    setItems((current) => current.filter((item) => item.key !== key));
    setCheckoutKey(uid());
  }, []);

  const setQty = useCallback((key, qty) => {
    setItems((current) =>
      current.map((item) => item.key === key ? normalizeCartItem({ ...item, qty }) : item)
    );
    setCheckoutKey(uid());
  }, []);

  const clear = useCallback(() => { setItems([]); setCheckoutKey(uid()); }, []);

  const value = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + cartLineTotal(item), 0);
    const photoCount = items.reduce((sum, item) => sum + cartPhotoCount(item), 0);
    return { items, ready, checkoutKey, addItems, removeItem, setQty, clear, subtotal, photoCount, count: items.length };
  }, [items, ready, checkoutKey, addItems, removeItem, setQty, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}