import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CalendarSearch, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import GithubUpdatePanel from "@/components/admin/GithubUpdatePanel";
import BackupRestorePanel from "@/components/admin/BackupRestorePanel";
import OrderAlertSettings from "@/components/admin/OrderAlertSettings";
import { searchNationalHolidays } from "@/lib/holidays-fns";
import { useSettings } from "@/lib/store";

export const Route = createFileRoute("/admin/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Paracolor" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { settings, isLoading } = useSettings();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [holidayDraft, setHolidayDraft] = useState("");
  const [holidayYear, setHolidayYear] = useState(new Date().getFullYear());
  const searchHolidays = useServerFn(searchNationalHolidays);
  const holidaySearch = useMutation({
    mutationFn: () => searchHolidays({ data: { year: Number(holidayYear) } }),
    onSuccess: ({ holidays }) => {
      setForm((current) => {
        const byDate = new Map((current?.holidays ?? []).map((holiday) => [holiday.date, holiday]));
        holidays.forEach((holiday) => {
          const currentHoliday = byDate.get(holiday.date);
          byDate.set(holiday.date, currentHoliday?.name ? currentHoliday : holiday);
        });
        return { ...current, holidays: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)) };
      });
      toast.success("Feriados nacionais adicionados. Revise a lista e salve as configurações.");
    },
    onError: (error) => toast.error(error.message || "Não foi possível consultar os feriados."),
  });

  useEffect(() => {
    if (settings && !form) {
      setForm({
        store_name: settings.store_name || "Paracolor",
        dark_mode_enabled: settings.dark_mode_enabled !== false,
        whatsapp: settings.whatsapp || "",
        phone: settings.phone || "",
        email: settings.email || "",
        instagram: settings.instagram || "",
        google_review_url: settings.google_review_url || "",
        hours: settings.hours || "",
        address: settings.address || "",
        pickup_info: settings.pickup_info || "",
        production_days: settings.production_days ?? 3,
        days_revelacao: settings.days_revelacao ?? settings.production_days ?? 3,
        days_polaroid: settings.days_polaroid ?? settings.production_days ?? 3,
        deadline_revelacao_value: settings.deadline_revelacao_value ?? settings.days_revelacao ?? settings.production_days ?? 3,
        deadline_revelacao_unit: settings.deadline_revelacao_unit ?? "days",
        deadline_polaroid_value: settings.deadline_polaroid_value ?? settings.days_polaroid ?? settings.production_days ?? 3,
        deadline_polaroid_unit: settings.deadline_polaroid_unit ?? "days",
        days_banner: settings.days_banner ?? settings.production_days ?? 3,
        days_personalizado: settings.days_personalizado ?? settings.production_days ?? 3,
        cutoff_hour: settings.cutoff_hour ?? 17,
        production_opens_at: settings.production_opens_at ?? "09:00",
        production_closes_at: settings.production_closes_at ?? "18:00",
        holidays: (settings.holidays ?? []).map((holiday) => typeof holiday === "string" ? { date: holiday, name: "Feriado" } : holiday).filter((holiday) => holiday?.date),
        shipping_enabled: Boolean(settings.shipping_enabled),
        shipping_flat: settings.shipping_flat ?? 0,
      });
    }
  }, [settings, form]);

  function addHoliday() {
    if (!holidayDraft || form.holidays.some((holiday) => holiday.date === holidayDraft)) return;
    setForm({ ...form, holidays: [...form.holidays, { date: holidayDraft, name: "Feriado manual" }].sort((a, b) => a.date.localeCompare(b.date)) });
    setHolidayDraft("");
  }

  function removeHoliday(date) {
    setForm({ ...form, holidays: form.holidays.filter((holiday) => holiday.date !== date) });
  }

  async function save() {
    const opens = Number(form.production_opens_at?.slice(0, 2)) * 60 + Number(form.production_opens_at?.slice(3, 5));
    const closes = Number(form.production_closes_at?.slice(0, 2)) * 60 + Number(form.production_closes_at?.slice(3, 5));
    if (!Number.isFinite(opens) || !Number.isFinite(closes) || closes <= opens) {
      toast.error("O fim do horário de produção precisa ser depois do início.");
      return;
    }
    setSaving(true);
    try {
      await base44.entities.Settings.update(settings.id, form);
      await queryClient.invalidateQueries({ queryKey: ["store-settings"] });
      toast.success("Configurações salvas");
    } catch (error) {
      toast.error(error?.message || "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !form) {
    return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando configurações…</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Loja</p>
        <h1 className="mt-1 text-3xl">Configurações</h1>
      </div>

      <section className="card-glass p-5">
        <h2 className="text-lg">Dados da loja</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[
            { key: "store_name", label: "Nome da loja" },
            { key: "whatsapp", label: "WhatsApp (com DDD)" },
            { key: "phone", label: "Telefone da loja (fixo, com DDD)" },
            { key: "email", label: "E-mail de atendimento" },
            { key: "instagram", label: "Instagram (@perfil ou link completo)" },
            { key: "address", label: "Endereço no rodapé" },
            { key: "production_days", label: "Prazo padrão (dias úteis)", type: "number" },
            { key: "shipping_flat", label: "Frete fixo (R$)", type: "number" },
          ].map((field) => (
            <label key={field.key} className="text-xs text-muted-foreground">
              {field.label}
              <input
                type={field.type || "text"}
                value={form[field.key]}
                onChange={(event) =>
                  setForm({ ...form, [field.key]: field.type === "number" ? Number(event.target.value) : event.target.value })
                }
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
          ))}
        </div>
        <label className="mt-4 block text-xs text-muted-foreground">
          Link de avaliação da loja no Google
          <input
            type="url"
            value={form.google_review_url}
            onChange={(event) => setForm({ ...form, google_review_url: event.target.value })}
            placeholder="https://g.page/r/.../review"
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          <span className="mt-1 block text-[11px]">Cole o link de avaliação criado no Perfil da Empresa do Google. Ele será exibido em Minha conta quando o cliente tiver um pedido concluído.</span>
        </label>
        <label className="mt-4 block text-xs text-muted-foreground">
          Horário de funcionamento (aparece no rodapé e no estúdio; deixe vazio para ocultar)
          <textarea
            value={form.hours}
            onChange={(event) => setForm({ ...form, hours: event.target.value })}
            rows={2}
            placeholder="Ex.: segunda a sexta, das 9h às 18h"
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <label className="mt-4 block text-xs text-muted-foreground">
          Informações de retirada
          <textarea
            value={form.pickup_info}
            onChange={(event) => setForm({ ...form, pickup_info: event.target.value })}
            rows={2}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <div className="mt-4 flex items-center gap-3">
          <Switch checked={form.shipping_enabled} onCheckedChange={(checked) => setForm({ ...form, shipping_enabled: checked })} />
          <span className="text-sm">Permitir entrega com frete fixo</span>
        </div>
      </section>

      <GithubUpdatePanel />
      <OrderAlertSettings />
      <BackupRestorePanel settings={settings} />

      <section className="card-glass p-5">
        <h2 className="text-lg">Prazo, horário e feriados</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Para revelação e polaroides, escolha dias úteis, horas ou minutos. Horas e minutos são contados dentro do horário de produção e pulam fins de semana e feriados cadastrados. As outras áreas continuam usando dias úteis.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[
            { key: "revelacao", label: "Revelação de fotos" },
            { key: "polaroid", label: "Polaroides" },
          ].map((field) => (
            <div key={field.key} className="rounded-lg border border-border p-3">
              <p className="text-xs font-medium text-foreground">{field.label}</p>
              <div className="mt-2 grid grid-cols-[1fr_1fr] gap-2">
                <input
                  aria-label={`Prazo de ${field.label}`}
                  type="number" min="1" max="10000"
                  value={form[`deadline_${field.key}_value`]}
                  onChange={(event) => setForm({ ...form, [`deadline_${field.key}_value`]: Math.max(1, Number(event.target.value) || 1) })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                />
                <select
                  aria-label={`Unidade do prazo de ${field.label}`}
                  value={form[`deadline_${field.key}_unit`]}
                  onChange={(event) => setForm({ ...form, [`deadline_${field.key}_unit`]: event.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="minutes">Minutos</option>
                  <option value="hours">Horas</option>
                  <option value="days">Dias úteis</option>
                </select>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { key: "days_banner", label: "Banners" },
            { key: "days_personalizado", label: "Personalizados" },
          ].map((field) => (
            <label key={field.key} className="text-xs text-muted-foreground">
              {field.label} (dias úteis)
              <input
                type="number"
                min="1"
                value={form[field.key]}
                onChange={(event) =>
                  setForm({ ...form, [field.key]: Math.max(1, Number(event.target.value) || 1) })
                }
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
          ))}
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-xs text-muted-foreground">
            Início do horário de produção
            <input type="time" value={form.production_opens_at} onChange={(event) => setForm({ ...form, production_opens_at: event.target.value })} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground" />
          </label>
          <label className="text-xs text-muted-foreground">
            Fim do horário de produção
            <input type="time" value={form.production_closes_at} onChange={(event) => setForm({ ...form, production_closes_at: event.target.value })} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground" />
          </label>
          <label className="text-xs text-muted-foreground">
            Horário de corte (hora cheia)
            <input
              type="number"
              min="0"
              max="23"
              value={form.cutoff_hour}
              onChange={(event) => setForm({ ...form, cutoff_hour: Math.max(0, Math.min(23, Number(event.target.value))) })}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground">Adicionar feriado</p>
            <div className="mt-1 flex flex-wrap gap-2">
              <input
                type="date"
                value={holidayDraft}
                onChange={(event) => setHolidayDraft(event.target.value)}
                className="min-w-40 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
              <Button type="button" variant="outline" onClick={addHoliday} disabled={!holidayDraft}>Adicionar</Button>
              <input type="number" min="2000" max="2100" aria-label="Ano dos feriados nacionais" value={holidayYear} onChange={(event) => setHolidayYear(Number(event.target.value))} className="w-28 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground" />
              <Button type="button" variant="outline" onClick={() => holidaySearch.mutate()} disabled={holidaySearch.isPending}>
                {holidaySearch.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CalendarSearch className="mr-1.5 h-4 w-4" />}
                Buscar feriados nacionais
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">A busca importa feriados nacionais do Brasil; feriados estaduais e municipais devem ser adicionados manualmente.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {form.holidays.map((holiday) => (
            <span key={holiday.date} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs">
              {new Date(`${holiday.date}T12:00:00`).toLocaleDateString("pt-BR")} · {holiday.name || "Feriado"}
              <button type="button" onClick={() => removeHoliday(holiday.date)} className="text-muted-foreground hover:text-red-600" aria-label={`Remover feriado ${holiday.name || holiday.date}`}>×</button>
            </span>
          ))}
          {!form.holidays.length && <p className="text-[11px] text-muted-foreground">Nenhum feriado cadastrado.</p>}
        </div>
      </section>

      <section className="card-glass p-5">
        <h2 className="text-lg">Aparência do site</h2>
        <div className="mt-4 flex items-center gap-3">
          <Switch
            checked={form.dark_mode_enabled}
            onCheckedChange={(checked) => setForm({ ...form, dark_mode_enabled: checked })}
          />
          <span className="text-sm">Permitir modo escuro no site</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Quando liberado, o cliente alterna entre o tema claro e o escuro com um clique no topo do site. Desativado, o site
          permanece apenas no tema claro.
        </p>
      </section>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar configurações
        </Button>
      </div>

    </div>
  );
}
