import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { createOrder, createPayment, quoteCheckout } from "@/lib/store-fns";
import { checkoutItems } from "@/lib/cart-items";
import { useCart } from "@/lib/cart";

export default function useCheckout(form, coupon, approval) {
  const { items, ready, checkoutKey, clear } = useCart();
  const client = useQueryClient();
  const navigate = useNavigate();
  const save = useServerFn(createOrder);
  const pay = useServerFn(createPayment);
  const quote = useServerFn(quoteCheckout);
  const serialized = JSON.stringify({ items: checkoutItems(items, approval === "sim"), fulfillment: form.fulfillment, coupon_code: coupon, shipping_cep: form.shipping_cep, shipping_service: form.shipping_service });
  const [debounced, setDebounced] = useState(null);
  useEffect(() => { const timer = setTimeout(() => setDebounced(serialized), 400); return () => clearTimeout(timer); }, [serialized]);
  const input = useMemo(() => debounced ? JSON.parse(debounced) : null, [debounced]);
  const estimate = useQuery({ queryKey: ["checkout-quote", input], enabled: ready && Boolean(input?.items.length), queryFn: () => quote({ data: input }), retry: false });
  const purchase = useMutation({
    mutationFn: () => save({ data: { ...form, ...JSON.parse(serialized), checkout_key: checkoutKey } }),
    onSuccess: async (order) => {
      clear();
      await Promise.all([["Order"], ["my-orders"], ["admin-orders"]].map((queryKey) => client.invalidateQueries({ queryKey })));
      if (form.payment_method === "mercadopago") {
        try {
          const payment = await pay({ data: { order_id: order.order_id, origin: window.location.origin } });
          if (payment.init_point) { window.location.assign(payment.init_point); return; }
          toast.warning(payment.message || "Pedido salvo. O pagamento pode ser retomado nos detalhes do pedido.");
        } catch {
          toast.warning("Pedido salvo. Não foi possível abrir o pagamento agora; retome pelos detalhes do pedido.");
        }
      } else toast.success("Pedido registrado. Combine o pagamento com a loja.");
      await navigate({ to: "/pedido/$orderId", params: { orderId: order.order_id } });
    },
  });
  const calculating = serialized !== debounced || estimate.isPending || estimate.isFetching;
  function submit(event) {
    event.preventDefault();
    if (!ready || !items.length || calculating || estimate.error || purchase.isPending) return;
    purchase.mutate();
  }
  return { quote: estimate.data, calculating, error: purchase.error?.message || estimate.error?.message, submitting: purchase.isPending, submit };
}