import { useEffect, useState } from "react";
import { Download, LoaderCircle, QrCode } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ensurePickupQrToken } from "@/lib/pickup-qr-fns";
import { Button } from "@/components/ui/button";

export default function PickupQrCode({ order }) {
  const issueToken = useServerFn(ensurePickupQrToken);
  const [image, setImage] = useState("");
  const [imageError, setImageError] = useState(false);
  const ready = order.fulfillment === "retirada" && order.status === "pronto";
  const tokenQuery = useQuery({
    queryKey: ["pickup-qr-token", order.id],
    enabled: ready,
    queryFn: () => order.pickup_qr_token
      ? { token: order.pickup_qr_token }
      : issueToken({ data: { order_id: order.id } }),
    staleTime: Infinity,
  });

  useEffect(() => {
    let active = true;
    setImage("");
    setImageError(false);
    if (tokenQuery.data?.token && typeof window !== "undefined") {
      const url = new URL("/admin/retirada", window.location.origin);
      url.searchParams.set("token", tokenQuery.data.token);
      import("qrcode").then(({ default: QRCode }) => QRCode.toDataURL(url.toString(), {
        width: 360, margin: 2, errorCorrectionLevel: "H",
      })).then((dataUrl) => { if (active) setImage(dataUrl); })
        .catch(() => { if (active) setImageError(true); });
    }
    return () => { active = false; };
  }, [tokenQuery.data?.token]);

  if (order.fulfillment !== "retirada") return null;
  return (
    <div className="mt-4 rounded-xl border border-gold/40 bg-gold-soft/20 p-4">
      <p className="flex items-center gap-2 text-sm font-medium"><QrCode className="h-4 w-4" /> QR Code para retirada</p>
      {order.status !== "pronto" ? (
        <p className="mt-1 text-xs text-muted-foreground">Ele ficará disponível aqui quando o pedido estiver pronto para retirada.</p>
      ) : tokenQuery.isError || imageError ? (
        <p role="alert" className="mt-2 text-xs text-destructive">Não foi possível gerar o QR Code agora. Atualize a página para tentar novamente.</p>
      ) : tokenQuery.isPending || !image ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Preparando seu QR Code…</p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <img src={image} alt={`QR Code de retirada do pedido ${order.order_number}`} className="h-36 w-36 rounded-lg bg-white p-2" />
          <div className="max-w-xs">
            <p className="text-xs leading-relaxed text-muted-foreground">Apresente este código à equipe quando vier retirar o pedido. A equipe confirmará a retirada ao ler o código. Se o pedido for pago no balcão, confirmará o recebimento junto com a retirada.</p>
            <Button asChild size="sm" variant="outline" className="mt-3 gap-1.5">
              <a href={image} download={`QR_${order.order_number}.png`}><Download className="h-3.5 w-3.5" /> Salvar QR Code</a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
