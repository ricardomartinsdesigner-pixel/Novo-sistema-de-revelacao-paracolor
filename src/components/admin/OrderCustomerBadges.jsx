import { awaitsPickupPayment } from "@/lib/order-payment";

export default function OrderCustomerBadges({ order, profileProfessional = false }) {
  if (order.customer_professional !== true && !profileProfessional) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      <span
        className="rounded-full bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground"
        title={order.customer_professional === true ? "Perfil registrado no pedido" : "Perfil atual do cadastro do cliente"}
      >
        Fotógrafo profissional
      </span>
      {awaitsPickupPayment(order) && (
        <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-900">Cobrar na retirada</span>
      )}
    </div>
  );
}
