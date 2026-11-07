import test from "node:test";
import assert from "node:assert/strict";
import { deadlineConfigForArea, estimateBusinessMinutes, formatDeadlineDuration, isBusinessDay } from "../src/lib/deadline.js";

test("prazo é independente para revelação e polaroide e formata horas/minutos", () => {
  const settings = { deadline_revelacao_value: 90, deadline_revelacao_unit: "minutes", deadline_polaroid_value: 2, deadline_polaroid_unit: "hours" };
  assert.deepEqual(deadlineConfigForArea(settings, "revelacao"), { value: 90, unit: "minutes" });
  assert.equal(formatDeadlineDuration(settings, "revelacao"), "90 minutos");
  assert.equal(formatDeadlineDuration(settings, "polaroid"), "2 horas");
});

test("prazo em horas respeita expediente, fim de semana e feriado", () => {
  const result = estimateBusinessMinutes({
    minutes: 120, opens_at: "09:00", closes_at: "18:00", holidays: ["2026-11-09"],
    from: new Date("2026-11-06T20:00:00.000Z"),
  });
  assert.equal(result.toISOString(), "2026-11-10T13:00:00.000Z");
  assert.equal(isBusinessDay(new Date("2026-11-09T15:00:00.000Z"), [{ date: "2026-11-09", name: "Feriado importado" }]), false);
});
