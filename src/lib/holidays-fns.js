import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";

export const searchNationalHolidays = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .validator(z.object({ year: z.number().int().min(2000).max(2100) }))
  .handler(async ({ data, context }) => {
    if (context.user?.role !== "admin") throw new Error("Apenas administradores podem buscar feriados.");
    const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${data.year}`, {
      headers: { accept: "application/json", "user-agent": "Paracolor-Holidays/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`A consulta de feriados respondeu HTTP ${response.status}. Tente novamente mais tarde.`);
    const payload = await response.json();
    if (!Array.isArray(payload)) throw new Error("A fonte de feriados retornou um formato inesperado.");
    const holidays = payload
      .filter((item) => typeof item?.date === "string" && new RegExp(`^${data.year}-\\d{2}-\\d{2}$`).test(item.date))
      .map((item) => ({ date: item.date, name: String(item.name || "Feriado nacional").slice(0, 120) }))
      .sort((a, b) => a.date.localeCompare(b.date));
    if (!holidays.length) throw new Error("A fonte não retornou feriados nacionais para esse ano.");
    return { holidays };
  });
