import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { cartLineTotal, cartPhotoCount, normalizeCartItem } from "@/lib/cart-items";
import { uid } from "@/lib/uid";
import { toast } from "sonner";

const STORAGE_KEY = "paracolor.cart.v1";
const COUPON_STORAGE_KEY = "paracolor.campaign-coupon.v1";
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

export function CartProvider({ children, settings }) {
  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);
  const [checkoutKey, setCheckoutKey] = useState("");
  const [campaignCoupon, setCampaignCoupon] = useState(null);

  useEffect(() => {
    const stored = readStored();
    setItems(stored.items);
    setCheckoutKey(stored.checkoutKey);
    try {
      const selection = JSON.parse(sessionStorage.getItem(COUPON_STORAGE_KEY) || "null");
      if (typeof selection?.code === "string") setCampaignCoupon(selection);
    } catch { /* session storage can be unavailable */ }
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
    if (settings?.page_carrinho === false) {
      toast.error("A loja está temporariamente sem acesso ao carrinho.");
      return false;
    }
    setItems((current) => [...current, ...newItems.map(normalizeCartItem)]);
    setCheckoutKey(uid());
    return true;
  }, [settings?.page_carrinho]);

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

  const chooseCoupon = useCallback((code, owner = "") => {
    const selection = code ? { code, owner } : null;
    setCampaignCoupon(selection);
    try {
      if (selection) sessionStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify(selection));
      else sessionStorage.removeItem(COUPON_STORAGE_KEY);
    } catch { /* keep the in-memory selection */ }
  }, []);

  const clear = useCallback(() => { setItems([]); setCheckoutKey(uid()); chooseCoupon(""); }, [chooseCoupon]);

  const value = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + cartLineTotal(item), 0);
    const photoCount = items.reduce((sum, item) => sum + cartPhotoCount(item), 0);
    return { items, ready, checkoutKey, addItems, removeItem, setQty, clear, subtotal, photoCount, count: items.length, campaignCoupon, chooseCoupon };
  }, [items, ready, checkoutKey, addItems, removeItem, setQty, clear, campaignCoupon, chooseCoupon]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}

export function selectedCoupon(selection, userId) {
  return selection && (!selection.owner || selection.owner === userId) ? selection.code : "";
}
