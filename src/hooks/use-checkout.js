import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { createOrder, createPayment, quoteCheckout } from "@/lib/store-fns";
import { checkoutItems } from "@/lib/cart-items";
import { useCart } from "@/lib/cart";
import { isOnlinePayment, PICKUP_PAYMENT } from "@/lib/order-payment";

export default function useCheckout(form, coupon, approval, userId) {
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
  const estimate = useQuery({
    queryKey: ["checkout-quote", userId, input],
    enabled: ready && Boolean(userId && input?.items.length),
    queryFn: () => quote({ data: input }),
    retry: false,
  });
  const purchase = useMutation({
    mutationFn: (paymentMethod) => save({
      data: {
        ...form, ...input, checkout_key: checkoutKey, payment_method: paymentMethod, quoted_total: estimate.data.total,
      },
    }),
    onError: () => estimate.refetch(),
    onSuccess: async (order) => {
      clear();
      await Promise.all([["Order"], ["my-orders"], ["admin-orders"], ["my-coupons"], ["public-campaigns"]].map((queryKey) => client.invalidateQueries({ queryKey })));
      if (order.total === 0) {
        toast.success("Pedido registrado com desconto integral.");
      } else if (isOnlinePayment(order.payment_method)) {
        try {
          const payment = await pay({ data: { order_id: order.order_id } });
          if (payment.init_point) { window.location.assign(payment.init_point); return; }
          if (!payment.code) toast.warning(payment.message || "Pedido salvo. O pagamento pode ser retomado nos detalhes do pedido.");
        } catch {
          toast.warning("Pedido salvo. Não foi possível abrir o pagamento agora; retome pelos detalhes do pedido.");
        }
      } else if (order.payment_method === PICKUP_PAYMENT) {
        toast.success("Pedido registrado. Você paga ao retirar na loja.");
      } else {
        toast.success("Pedido registrado. Combine o pagamento com a loja.");
      }
      await navigate({ to: "/pedido/$orderId", params: { orderId: order.order_id } });
    },
  });
  const calculating = serialized !== debounced || estimate.isPending || estimate.isFetching;
  function submit(event, paymentMethod) {
    event.preventDefault();
    if (!ready || !items.length || calculating || estimate.error || purchase.isPending) return;
    if (!estimate.data?.payment_methods.includes(paymentMethod)) return;
    purchase.mutate(paymentMethod);
  }
  return { quote: estimate.data, calculating, error: purchase.error?.message || estimate.error?.message, submitting: purchase.isPending, submit };
}
