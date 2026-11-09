import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/lib/store";
import { savePickupQrBehavior } from "@/lib/pickup-qr-fns";

const BEHAVIORS = [
  { value: "automatico", label: "Marcar como retirado ao escanear" },
  { value: "confirmar", label: "Pedir confirmação antes de marcar" },
  { value: "consultar", label: "Só abrir o pedido, sem alterar status" },
];

export default function PickupQrSettings() {
  const { settings } = useSettings();
  const queryClient = useQueryClient();
  const save = useServerFn(savePickupQrBehavior);
  const savedBehavior = BEHAVIORS.some(({ value }) => value === settings?.pickup_qr_behavior)
    ? settings.pickup_qr_behavior : "automatico";
  const [behavior, setBehavior] = useState(savedBehavior);
  const [saving, setSaving] = useState(false);
  useEffect(() => setBehavior(savedBehavior), [savedBehavior]);

  async function saveBehavior() {
    setSaving(true);
    try {
      await save({ data: { behavior } });
      await queryClient.invalidateQueries({ queryKey: ["store-settings"] });
      toast.success("Comportamento do QR Code salvo.");
    } catch (error) {
      toast.error(error?.message || "Não foi possível salvar a opção.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card-glass p-5">
      <h2 className="flex items-center gap-2 text-lg font-medium"><QrCode className="h-5 w-5" /> Comportamento do QR Code de retirada</h2>
      <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">Defina o que acontece quando a câmera da equipe abre o QR Code apresentado pelo cliente. O padrão marca a retirada automaticamente; essa opção também pode exigir confirmação ou apenas consultar.</p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block min-w-[260px] flex-1 text-xs text-muted-foreground">
          Ao ler o código
          <select value={behavior} onChange={(event) => setBehavior(event.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground">
            {BEHAVIORS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <Button type="button" onClick={saveBehavior} disabled={saving || behavior === savedBehavior} className="gap-1.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Salvar comportamento
        </Button>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">A baixa automática só ocorre para pedidos prontos para retirada e com pagamento confirmado. A equipe pode desfazer a baixa por até 2 minutos após a leitura.</p>
    </section>
  );
}
