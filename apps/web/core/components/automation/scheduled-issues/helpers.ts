/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TScheduledIssue, TScheduledIssueDueUnit } from "@/services/scheduled-issue.service";

// 0 = segunda … 6 = domingo (mesma convenção do backend: datetime.weekday())
export const WEEKDAYS_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const WEEKDAYS_LONG = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];

export const FREQUENCY_LABELS: Record<TScheduledIssue["frequency"], string> = {
  once: "Uma vez",
  daily: "Diária",
  weekly: "Semanal",
  monthly: "Mensal",
};

// ── Prazo (vencimento) ──────────────────────────────────────────────────
export type TDuePreset = "none" | "7d" | "15d" | "30d" | "quarterly" | "semiannual" | "annual" | "custom";

export const DUE_PRESETS: { key: TDuePreset; label: string; amount: number | null; unit: TScheduledIssueDueUnit }[] = [
  { key: "none", label: "Sem prazo", amount: null, unit: "day" },
  { key: "7d", label: "7 dias", amount: 7, unit: "day" },
  { key: "15d", label: "15 dias", amount: 15, unit: "day" },
  { key: "30d", label: "30 dias", amount: 30, unit: "day" },
  { key: "quarterly", label: "Trimestral (3 meses)", amount: 3, unit: "month" },
  { key: "semiannual", label: "Semestral (6 meses)", amount: 6, unit: "month" },
  { key: "annual", label: "Anual (1 ano)", amount: 1, unit: "year" },
  { key: "custom", label: "Personalizado…", amount: null, unit: "day" },
];

export const DUE_UNIT_LABELS: Record<TScheduledIssueDueUnit, [string, string]> = {
  day: ["dia", "dias"],
  week: ["semana", "semanas"],
  month: ["mês", "meses"],
  year: ["ano", "anos"],
};

// teto por unidade (~10 anos) — o mesmo do backend
export const DUE_LIMITS: Record<TScheduledIssueDueUnit, number> = { day: 3650, week: 520, month: 120, year: 10 };

/** Qual opção da lista corresponde a (quantidade, unidade); senão, personalizado. */
export const presetFor = (amount: number | null, unit: TScheduledIssueDueUnit): TDuePreset => {
  if (amount === null || amount === undefined) return "none";
  if (unit === "month" && amount === 12) return "annual";
  const found = DUE_PRESETS.find((p) => p.key !== "custom" && p.amount === amount && p.unit === unit);
  return found ? found.key : "custom";
};

/** "30 dias", "Trimestral", "18 meses"… */
export const describeDue = (amount: number | null, unit: TScheduledIssueDueUnit) => {
  if (amount === null || amount === undefined) return "";
  const preset = presetFor(amount, unit);
  if (preset === "quarterly") return "trimestral";
  if (preset === "semiannual") return "semestral";
  if (preset === "annual") return "anual";
  const [um, varios] = DUE_UNIT_LABELS[unit];
  return `${amount} ${amount === 1 ? um : varios}`;
};

export const hhmm = (time: string | null | undefined) => (time ?? "").slice(0, 5);

const joinPt = (items: string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;

const formatDate = (isoDate: string) => {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
};

/** Resumo em português: "Toda segunda e sexta às 09:00". */
export const describeSchedule = (s: Pick<TScheduledIssue, "frequency" | "time_of_day" | "weekdays" | "month_day" | "run_on">) => {
  const hora = `às ${hhmm(s.time_of_day)}`;
  switch (s.frequency) {
    case "once":
      return s.run_on ? `Uma vez, em ${formatDate(s.run_on)} ${hora}` : `Uma vez ${hora}`;
    case "daily":
      return `Todo dia ${hora}`;
    case "weekly": {
      const dias = [...(s.weekdays ?? [])].sort((a, b) => a - b);
      if (dias.join(",") === "0,1,2,3,4") return `De segunda a sexta ${hora}`;
      if (dias.length === 7) return `Todo dia ${hora}`;
      // "Toda semana (segunda e sábado)": evita a concordância "toda/todo" por dia
      return `Toda semana (${joinPt(dias.map((d) => WEEKDAYS_LONG[d]))}) ${hora}`;
    }
    case "monthly":
      return s.month_day && s.month_day >= 29
        ? `Todo dia ${s.month_day} do mês (ou o último dia, se o mês for menor) ${hora}`
        : `Todo dia ${s.month_day} do mês ${hora}`;
    default:
      return "";
  }
};

/** Data/hora no fuso de Brasília, como o agendamento é configurado. */
export const formatDateTimeBR = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Texto simples do formulário → HTML de descrição (um parágrafo por linha). */
export const textToHtml = (text: string) => {
  const linhas = text.split(/\r?\n/);
  if (!text.trim()) return "<p></p>";
  return linhas.map((l) => `<p>${escapeHtml(l)}</p>`).join("");
};

/** HTML de descrição → texto simples, para editar no formulário. */
export const htmlToText = (html: string | null | undefined) => {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html.replace(/<\/p>\s*<p>/g, "\n"), "text/html");
  return (doc.body.textContent ?? "").trim();
};
