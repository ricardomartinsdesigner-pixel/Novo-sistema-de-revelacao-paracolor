import { Clock, MapPin, Store } from "lucide-react";

export default function PickupNotice({ address, hours, pickupInfo }) {
  return (
    <div className="mt-4 rounded-xl border border-gold/50 bg-gold-soft/70 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Store className="h-4 w-4 text-gold-deep" />
        Retirada na loja
      </p>

      {address ? (
        <p className="mt-2 flex gap-2 text-sm">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-deep" />
          <span>{address}</span>
        </p>
      ) : null}

      {hours ? (
        <p className="mt-1.5 flex gap-2 text-sm">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold-deep" />
          <span>{hours}</span>
        </p>
      ) : null}

      {pickupInfo ? <p className="mt-2 text-xs text-muted-foreground">{pickupInfo}</p> : null}

      <p className="mt-2 text-xs text-muted-foreground">
        O prazo é definido pela loja depois de conferir o seu pedido. Acompanhe em <strong className="font-medium text-foreground">Meus pedidos</strong>: assim que o pedido entrar em produção, o andamento e o prazo aparecem por lá.
      </p>
    </div>
  );
}