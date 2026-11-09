const TZ = "America/Sao_Paulo";
const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

function brazilParts(date) {
  return Object.fromEntries(partsFormatter.formatToParts(date).map(({ type, value }) => [type, value]));
}

function dateKeyFromParts(parts) {
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function brazilDate(year, month, day, hour = 0, minute = 0) {
  const target = Date.UTC(year, month - 1, day, hour, minute);
  const parts = brazilParts(new Date(target));
  const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  return new Date(target + (target - represented));
}

export function dateKey(date) {
  return dateKeyFromParts(brazilParts(date));
}

export function isBusinessDay(date, holidays = []) {
  const weekday = brazilParts(date).weekday;
  const holidayDates = holidays.map((holiday) => typeof holiday === "string" ? holiday : holiday?.date).filter(Boolean);
  return weekday !== "Sun" && weekday !== "Sat" && !holidayDates.includes(dateKey(date));
}

function nextBusinessStart(date, holidays, startMinutes) {
  const parts = brazilParts(date);
  let day = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + 1, 12));
  for (let tries = 0; tries < 370; tries += 1) {
    const next = brazilParts(day);
    if (isBusinessDay(day, holidays)) {
      return brazilDate(Number(next.year), Number(next.month), Number(next.day), Math.floor(startMinutes / 60), startMinutes % 60);
    }
    day = new Date(Date.UTC(Number(next.year), Number(next.month) - 1, Number(next.day) + 1, 12));
  }
  return date;
}

export function estimateReadyDate({ days = 3, cutoff_hour = 17, holidays = [], from = new Date() } = {}) {
  const cursor = new Date(from);
  const localHour = Number(brazilParts(cursor).hour);
  if (localHour >= Number(cutoff_hour)) cursor.setTime(nextBusinessStart(cursor, holidays, 9 * 60).getTime());
  let remaining = Math.max(1, Math.trunc(Number(days) || 1));
  let guard = 0;
  while (remaining > 0 && guard < 400) {
    if (isBusinessDay(cursor, holidays)) remaining -= 1;
    if (remaining > 0) cursor.setTime(nextBusinessStart(cursor, holidays, 9 * 60).getTime());
    guard += 1;
  }
  while (!isBusinessDay(cursor, holidays) && guard < 500) {
    cursor.setTime(nextBusinessStart(cursor, holidays, 9 * 60).getTime());
    guard += 1;
  }
  return cursor;
}

export function estimateBusinessMinutes({ minutes, holidays = [], opens_at = "09:00", closes_at = "18:00", from = new Date() } = {}) {
  const [openHour, openMinute] = String(opens_at).split(":").map(Number);
  const [closeHour, closeMinute] = String(closes_at).split(":").map(Number);
  const start = Math.max(0, Math.min(1439, (openHour || 0) * 60 + (openMinute || 0)));
  const end = Math.max(start + 1, Math.min(1440, (closeHour || 0) * 60 + (closeMinute || 0)));
  let remaining = Math.max(1, Math.trunc(Number(minutes) || 1));
  let cursor = new Date(from);
  for (let tries = 0; remaining > 0 && tries < 2000; tries += 1) {
    let p = brazilParts(cursor);
    if (!isBusinessDay(cursor, holidays)) {
      cursor = nextBusinessStart(cursor, holidays, start);
      continue;
    }
    let localMinutes = Number(p.hour) * 60 + Number(p.minute);
    if (localMinutes < start) {
      cursor = brazilDate(Number(p.year), Number(p.month), Number(p.day), Math.floor(start / 60), start % 60);
      localMinutes = start;
    }
    if (localMinutes >= end) {
      cursor = nextBusinessStart(cursor, holidays, start);
      continue;
    }
    const available = end - localMinutes;
    if (remaining <= available) {
      cursor = new Date(cursor.getTime() + remaining * 60_000);
      remaining = 0;
    } else {
      remaining -= available;
      cursor = nextBusinessStart(cursor, holidays, start);
    }
  }
  return cursor;
}

export function formatReadyDate(date) {
  return date.toLocaleString("pt-BR", {
    weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: TZ,
  });
}

export const AREA_DAYS_FIELD = {
  revelacao: "days_revelacao", polaroid: "days_polaroid", banner: "days_banner", personalizado: "days_personalizado",
};

export function deadlineConfigForArea(settings, area) {
  if (["revelacao", "polaroid"].includes(area)) {
    const prefix = area === "revelacao" ? "revelacao" : "polaroid";
    return {
      value: Math.max(1, Number(settings?.[`deadline_${prefix}_value`] ?? settings?.[AREA_DAYS_FIELD[area]] ?? settings?.production_days ?? 3)),
      unit: ["minutes", "hours", "days"].includes(settings?.[`deadline_${prefix}_unit`]) ? settings[`deadline_${prefix}_unit`] : "days",
    };
  }
  const field = AREA_DAYS_FIELD[area];
  return { value: Math.max(1, Number(settings?.[field] ?? settings?.production_days ?? 3)), unit: "days" };
}

export function formatDeadlineDuration(settings, area) {
  const { value, unit } = deadlineConfigForArea(settings, area);
  if (unit === "minutes") return `${value} ${value === 1 ? "minuto" : "minutos"}`;
  if (unit === "hours") return `${value} ${value === 1 ? "hora" : "horas"}`;
  return `${value} dia(s) útil(eis)`;
}

export function daysForArea(settings, area) {
  const { value, unit } = deadlineConfigForArea(settings, area);
  if (unit === "days") return value;
  const workdayMinutes = 9 * 60;
  return Math.max(1, Math.ceil((value * (unit === "hours" ? 60 : 1)) / workdayMinutes));
}

export function maxDaysForAreas(settings, areas = []) {
  return areas.reduce((max, area) => Math.max(max, daysForArea(settings, area)), 1);
}

export function deadlineFor(settings, daysOrArea, from = new Date()) {
  if (Array.isArray(daysOrArea)) {
    return daysOrArea.map((area) => deadlineFor(settings, area, from)).reduce((latest, date) => date > latest ? date : latest, new Date(from));
  }
  if (typeof daysOrArea === "string") {
    const { value, unit } = deadlineConfigForArea(settings, daysOrArea);
    const holidays = settings?.holidays ?? [];
    if (unit === "days") return estimateReadyDate({ days: value, cutoff_hour: settings?.cutoff_hour ?? 17, holidays, from });
    return estimateBusinessMinutes({
      minutes: value * (unit === "hours" ? 60 : 1), holidays,
      opens_at: settings?.production_opens_at ?? "09:00", closes_at: settings?.production_closes_at ?? "18:00", from,
    });
  }
  return estimateReadyDate({ days: Number(daysOrArea) || settings?.production_days || 3, cutoff_hour: settings?.cutoff_hour ?? 17, holidays: settings?.holidays ?? [], from });
}

export function revelationOffer(settings, from = new Date()) {
  const { value, unit } = deadlineConfigForArea(settings, "revelacao");
  if (unit !== "days") {
    const ready = deadlineFor(settings, "revelacao", from);
    const durationMs = value * (unit === "hours" ? 3_600_000 : 60_000);
    if (ready.getTime() - from.getTime() > durationMs) {
      return `Previsão para retirada: ${formatReadyDate(ready)}`;
    }
  }
  const duration = unit === "days" ? `${value} ${value === 1 ? "dia útil" : "dias úteis"}` : formatDeadlineDuration(settings, "revelacao");
  return `Revele suas fotos em até ${duration}`;
}
