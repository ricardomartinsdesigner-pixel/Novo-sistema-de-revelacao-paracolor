import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { listCampaignOrders, listCampaigns, saveCampaign, setCampaignActive } from "@/lib/campaign-fns";
import { findClients } from "@/lib/account-fns";
import { CAMPAIGN_AREAS, CAMPAIGN_MODES, campaignWindow } from "@/lib/coupon-rules";
import { formatBRL, formatDate } from "@/lib/areas";

const EMPTY = {
  title: "", code: "", campaign_mode: "exclusivo", customer_id: "", area: "", product_id: "",
  type: "percent", value: 10, min_total: 0, min_quantity: 0, max_discount: 0, max_uses: 0,
  per_customer: 0, starts_at: "", ends_at: "", active: true, allow_professional: false,
  allow_product_promo: false, notice: "none", message: "", image_url: "",
};
const fieldClass = "mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function Field({ label, children }) {
  return <label className="block min-w-0 text-sm font-medium">{label}{children}</label>;
}

function ClientPicker({ value, onChange }) {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const { data, isFetching, isError } = useQuery({
    queryKey: ["admin-users", "coupon-picker", term],
    queryFn: () => findClients({ data: { term, offset: 0 } }),
    enabled: term.length >= 2 && !value,
  });
  if (value) {
    return <p className="rounded-md border border-border p-3 text-sm">Cliente selecionado <strong>{value.full_name || value.email}</strong>{" "}
      <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>Trocar cliente</Button>
    </p>;
  }
  return (
    <div>
      <Field label="Buscar cliente por nome, telefone ou e-mail">
        <input className={fieldClass} type="search" value={search} maxLength={160} onChange={(event) => setSearch(event.target.value)} />
      </Field>
      {term.length >= 2 && <div className="mt-2 max-h-40 overflow-auto text-sm" aria-live="polite">
        {isError ? "Não foi possível buscar clientes." : isFetching ? "Buscando…" : (
          data?.items.filter((item) => item.role !== "admin").map((item) => (
            <button key={item.id} className="block w-full rounded-md p-2 text-left hover:bg-secondary" type="button" onClick={() => onChange(item)}>
              <strong>{item.full_name || item.email}</strong><span className="block text-xs text-muted-foreground">{item.email} {item.phone}</span>
            </button>
          ))
        )}
        {!isFetching && !isError && !data?.items.some((item) => item.role !== "admin") && "Nenhum cliente encontrado. Refine a busca."}
      </div>}
    </div>
  );
}

function CampaignEditor({ record, onClose, onSaved }) {
  const [form, setForm] = useState(() => record ? {
    ...EMPTY, ...record, campaign_mode: record.campaign_mode || "publico", title: record.title || record.code,
    ends_at: record.ends_at || (record.expires_at ? record.expires_at.slice(0, 10) + "T23:59" : ""),
    allow_professional: record.allow_professional ?? !record.campaign_mode,
    allow_product_promo: record.allow_product_promo ?? !record.campaign_mode,
  } : { ...EMPTY });
  const [customer, setCustomer] = useState(record?.customer_id ? { id: record.customer_id, full_name: record.customer_name, email: record.customer_email } : null);
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const fixedIdentity = Boolean(record?.campaign_mode);
  const productEntity = CAMPAIGN_AREAS[form.area]?.entity;
  const products = useInfiniteQuery({
    queryKey: ["coupon-products", productEntity], initialPageParam: undefined,
    queryFn: ({ pageParam }) => base44.entities[productEntity].list({ sort: "name", limit: 1000, cursor: pageParam }),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: Boolean(productEntity),
  });
  const items = products.data?.pages.flatMap((page) => page.items) ?? [];
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value, ...(key === "area" ? { product_id: "" } : {}) }));
  const text = (key, props = {}) => <input className={fieldClass} {...props} value={form[key]} onChange={(event) => update(key, event.target.value)} />;
  const number = (key, step = 1, max = undefined) => text(key, { type: "number", min: key === "value" ? 0.01 : 0, step, max, required: key === "value" });
  const choose = (key, options, props = {}) => <select className={fieldClass} value={form[key]} onChange={(event) => update(key, event.target.value)} {...props}>
    {options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
  </select>;
  const toggle = (key, label) => <label className="flex items-center gap-2 text-sm">
    <input type="checkbox" checked={form[key]} onChange={(event) => update(key, event.target.checked)} /> {label}
  </label>;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const amounts = ["value", "min_total", "min_quantity", "max_discount", "max_uses", "per_customer"];
      const numbers = Object.fromEntries(amounts.map((key) => [key, Number(form[key] || 0)]));
      const result = await saveCampaign({ data: { ...form, ...numbers, customer_id: customer?.id || "" } });
      toast.success(form.campaign_mode === "automatico" ? "Promoção salva." : "Cupom salvo · " + result.code);
      onSaved();
    } catch (error) {
      toast.error(error?.message || "Não foi possível salvar a campanha.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageBusy(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      update("image_url", file_url);
    } catch (error) {
      toast.error(error?.message || "Não foi possível enviar a imagem.");
    } finally {
      setImageBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy && !imageBusy) onClose(); }}>
      <DialogContent className="max-h-[90dvh] w-[96vw] max-w-2xl overflow-y-auto rounded-xl">
        <DialogHeader>
          <DialogTitle>{record ? "Editar campanha" : "Nova campanha de desconto"}</DialogTitle>
          <DialogDescription>Defina o público, as regras e o período no horário de Brasília.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome da campanha">{text("title", { required: true, maxLength: 100 })}</Field>
            <Field label="Tipo de campanha">{choose("campaign_mode", Object.entries(CAMPAIGN_MODES), { disabled: fixedIdentity })}</Field>
            {form.campaign_mode !== "automatico" && <Field label="Código do cupom">{text("code", { maxLength: 40, disabled: fixedIdentity, placeholder: "Deixe vazio para gerar" })}</Field>}
          </div>
          {form.campaign_mode === "exclusivo" && (fixedIdentity
            ? <p className="text-sm">Cliente <strong>{record.customer_name || record.customer_email || "Conta vinculada"}</strong></p>
            : <ClientPicker value={customer} onChange={setCustomer} />)}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Forma do desconto">{choose("type", [["percent", "Porcentagem"], ["fixed", "Valor em reais"]])}</Field>
            <Field label={form.type === "percent" ? "Desconto (%)" : "Desconto (R$)"}>{number("value", 0.01, form.type === "percent" ? 100 : 1000000)}</Field>
            <Field label="Início (opcional)">{text("starts_at", { type: "datetime-local" })}</Field>
            <Field label="Fim da validade">{text("ends_at", { type: "datetime-local", required: form.campaign_mode !== "publico" })}</Field>
            <Field label="Área elegível">{choose("area", [["", "Todas as áreas"], ...Object.entries(CAMPAIGN_AREAS).map(([key, area]) => [key, area.label])])}</Field>
            {productEntity && <Field label="Produto ou formato">
              {choose("product_id", [["", "Todos da área"], ...items.map((item) => [item.id, item.name]), ...(form.product_id && !items.some((item) => item.id === form.product_id) ? [[form.product_id, form.product_name || "Produto selecionado"]] : [])])}
              {products.hasNextPage && <Button type="button" variant="ghost" size="sm" onClick={() => products.fetchNextPage()}>Carregar mais produtos</Button>}
            </Field>}
            <Field label="Valor mínimo dos itens (R$)">{number("min_total", 0.01)}</Field>
            <Field label="Quantidade mínima elegível">{number("min_quantity")}</Field>
            <Field label="Teto do desconto (R$)">{number("max_discount", 0.01)}</Field>
            <Field label="Total de usos">{number("max_uses")}</Field>
            <Field label="Usos por cliente">{number("per_customer")}</Field>
          </div>
          <p className="text-xs text-muted-foreground">Use 0 para deixar sem mínimo ou teto. No cupom exclusivo, 0 em usos aplica o padrão de uma utilização.</p>
          <div className="space-y-2 rounded-lg border border-border p-3">
            {toggle("active", "Campanha habilitada")}
            {toggle("allow_professional", "Permitir sobre a tabela de fotógrafos")}
            {toggle("allow_product_promo", "Permitir sobre produtos já em promoção")}
          </div>
          {form.campaign_mode !== "exclusivo" && (
            <div className="space-y-3">
              <Field label="Divulgação na loja">{choose("notice", [["none", "Sem aviso"], ["banner", "Faixa na página inicial"], ["popup", "Pop-up ao abrir a loja"]])}</Field>
              {form.notice !== "none" && <>
                <Field label="Mensagem do aviso">{text("message", { maxLength: 240 })}</Field>
                {form.notice === "popup" && <>
                  <Field label="Imagem (URL opcional)">{text("image_url", { maxLength: 500 })}</Field>
                  <Field label="Enviar imagem"><input type="file" className={fieldClass} accept="image/jpeg,image/png,image/webp,image/avif" onChange={uploadImage} /></Field>
                </>}
              </>}
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy || imageBusy}>Fechar</Button>
            <Button type="submit" disabled={busy || imageBusy || (form.campaign_mode === "exclusivo" && !customer)}>
              {imageBusy ? "Enviando imagem…" : busy ? "Salvando…" : "Salvar campanha"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CampaignOrders({ id }) {
  const list = useInfiniteQuery({
    queryKey: ["admin-campaigns", "paid", id], initialPageParam: 0,
    queryFn: ({ pageParam }) => listCampaignOrders({ data: { id, offset: pageParam } }),
    getNextPageParam: (page) => page.nextOffset ?? undefined,
  });
  const orders = list.data?.pages.flatMap((page) => page.items) ?? [];
  return <div className="mt-3 space-y-2 border-t border-border pt-3 text-sm">
    {list.isPending && <p>Buscando pedidos pagos…</p>}
    {list.isError && <Button variant="outline" size="sm" onClick={() => list.refetch()}>Tentar novamente</Button>}
    {list.isSuccess && !orders.length && <p>Nenhum pedido pago com esta campanha.</p>}
    {orders.map((order) => <p key={order.id} className="flex flex-wrap justify-between gap-2">
      <Link className="underline underline-offset-2" to="/admin/pedidos/$orderId" params={{ orderId: order.id }}>{order.order_number}</Link>
      <span>{formatDate(order.created_date)} · desconto de {formatBRL(order.discount)}</span>
    </p>)}
    {list.hasNextPage && <Button variant="outline" size="sm" disabled={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>Mais pedidos</Button>}
  </div>;
}

export default function CampaignManager() {
  const client = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [ordersId, setOrdersId] = useState(null);
  const [busy, setBusy] = useState(false);
  const list = useInfiniteQuery({
    queryKey: ["admin-campaigns"], initialPageParam: 0,
    queryFn: ({ pageParam }) => listCampaigns({ data: { offset: pageParam } }),
    getNextPageParam: (page) => page.nextOffset ?? undefined,
  });
  const campaigns = list.data?.pages.flatMap((page) => page.items) ?? [];
  function invalidate() {
    return Promise.all([["admin-campaigns"], ["my-coupons"], ["public-campaigns"], ["checkout-quote"], ["cart-campaign"]]
      .map((queryKey) => client.invalidateQueries({ queryKey })));
  }

  async function toggle(campaign) {
    setBusy(true);
    try {
      await setCampaignActive({ data: { id: campaign.id, active: !campaign.active } });
      await invalidate();
    } catch (error) {
      toast.error(error?.message || "Não foi possível alterar a campanha.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(campaign) {
    const { ends } = campaignWindow(campaign);
    const discount = campaign.type === "percent" ? campaign.value + "%" : formatBRL(campaign.value);
    const message = `Olá! Use o cupom ${campaign.code} para ganhar ${discount} de desconto na Paracolor.`
      + (Number.isFinite(ends) ? ` Válido até ${formatDate(ends)}.` : "")
      + (campaign.product_name ? ` Para ${campaign.product_name}.` : campaign.area ? ` Para ${CAMPAIGN_AREAS[campaign.area]?.label}.` : "")
      + (campaign.min_total ? ` Mínimo de ${formatBRL(campaign.min_total)} em itens elegíveis.` : "")
      + (campaign.min_quantity ? ` A partir de ${campaign.min_quantity} unidades elegíveis.` : "")
      + (campaign.max_discount ? ` Desconto de até ${formatBRL(campaign.max_discount)}.` : "")
      + ` ${window.location.origin}/`;
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Mensagem copiada para o WhatsApp.");
    } catch {
      toast.error("Não foi possível copiar. O código aparece no cartão do cupom.");
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl">Cupons e campanhas</h2>
          <p className="mt-1 text-sm text-muted-foreground">Crie descontos por cliente, divulgue cupons e agende ofertas automáticas.</p>
        </div>
        <Button type="button" onClick={() => setEditing({})}>Nova campanha</Button>
      </div>
      {list.isPending && <p className="mt-4 text-sm">Carregando campanhas…</p>}
      {list.isError && <Button className="mt-4" variant="outline" onClick={() => list.refetch()}>Tentar carregar novamente</Button>}
      {!list.isPending && !list.isError && !campaigns.length && <p className="mt-4 text-sm text-muted-foreground">Nenhuma campanha cadastrada.</p>}
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {campaigns.map((campaign) => {
          const { starts, ends } = campaignWindow(campaign);
          const mode = campaign.campaign_mode || "publico";
          return <article key={campaign.id} className="min-w-0 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-medium">{campaign.title || campaign.code}</h3>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs">{campaign.status}</span>
            </div>
            <p className="mt-1 text-sm">{CAMPAIGN_MODES[mode]}{mode !== "automatico" && <> · <strong>{campaign.code}</strong></>}</p>
            {campaign.customer_name && <p className="text-sm">{campaign.customer_name} · {campaign.customer_email}</p>}
            <p className="mt-2 text-sm">{campaign.type === "percent" ? campaign.value + "%" : formatBRL(campaign.value)} · {campaign.product_name || CAMPAIGN_AREAS[campaign.area]?.label || "Todas as áreas"}</p>
            <p className="text-xs text-muted-foreground">{Number.isFinite(starts) ? formatDate(starts) + " até " : "Validade "}{Number.isFinite(ends) ? formatDate(ends) : "sem prazo definido"}</p>
            <p className="mt-2 text-xs text-muted-foreground">{campaign.usage.used}{campaign.max_uses ? ` de ${campaign.max_uses}` : ""} usos ou reservas · {campaign.usage.paid} pedidos pagos · {formatBRL(campaign.usage.discount)} em descontos concedidos</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(campaign)}>Editar</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => toggle(campaign)}>{campaign.active ? "Pausar" : "Reativar"}</Button>
              {mode !== "automatico" && <Button size="sm" variant="outline" onClick={() => copy(campaign)}>Copiar mensagem para WhatsApp</Button>}
              {campaign.usage.paid > 0 && <Button size="sm" variant="outline" aria-expanded={ordersId === campaign.id}
                onClick={() => setOrdersId((current) => current === campaign.id ? null : campaign.id)}>Ver pedidos pagos</Button>}
            </div>
            {ordersId === campaign.id && <CampaignOrders id={campaign.id} />}
          </article>;
        })}
      </div>
      {list.hasNextPage && <Button className="mt-4" variant="outline" disabled={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>Carregar mais campanhas</Button>}
      {editing && <CampaignEditor key={editing.id || "new"} record={editing.id ? editing : null} onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); void invalidate(); }} />}
    </section>
  );
}
