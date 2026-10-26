/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { Button } from "@plane/propel/button";
import type { TIssuePriorities } from "@plane/types";
import { EModalPosition, EModalWidth, Input, ModalCore, TextArea } from "@plane/ui";
import { cn } from "@plane/utils";
// components
import { MemberDropdown } from "@/components/dropdowns/member/dropdown";
import { PriorityDropdown } from "@/components/dropdowns/priority";
import { StateDropdown } from "@/components/dropdowns/state/dropdown";
import { IssueLabelSelect } from "@/components/issues/select";
// services
import type {
  TScheduledIssue,
  TScheduledIssueForm,
  TScheduledIssueFrequency,
} from "@/services/scheduled-issue.service";
// local
import { FREQUENCY_LABELS, WEEKDAYS_SHORT, describeSchedule, hhmm, htmlToText, textToHtml } from "./helpers";

type Props = {
  isOpen: boolean;
  projectId: string;
  data: TScheduledIssue | null; // null = novo
  onClose: () => void;
  onSubmit: (payload: Partial<TScheduledIssueForm>) => Promise<void>;
};

type TFormState = {
  name: string;
  description: string;
  state_id: string | null;
  priority: TIssuePriorities;
  assignee_ids: string[];
  label_ids: string[];
  due_in_days: string; // texto do campo; vazio = sem prazo
  frequency: TScheduledIssueFrequency;
  time: string; // "HH:MM"
  weekdays: number[];
  month_day: string;
  run_on: string;
};

const empty = (): TFormState => ({
  name: "",
  description: "",
  state_id: null,
  priority: "none",
  assignee_ids: [],
  label_ids: [],
  due_in_days: "",
  frequency: "weekly",
  time: "09:00",
  weekdays: [0],
  month_day: "1",
  run_on: "",
});

const fromData = (d: TScheduledIssue): TFormState => ({
  name: d.name,
  description: htmlToText(d.description_html),
  state_id: d.state_id,
  priority: d.priority ?? "none",
  assignee_ids: d.assignee_ids ?? [],
  label_ids: d.label_ids ?? [],
  due_in_days: d.due_in_days === null || d.due_in_days === undefined ? "" : String(d.due_in_days),
  frequency: d.frequency,
  time: hhmm(d.time_of_day),
  weekdays: d.weekdays?.length ? d.weekdays : [0],
  month_day: d.month_day ? String(d.month_day) : "1",
  run_on: d.run_on ?? "",
});

/** Primeira mensagem legível de um erro de validação do DRF. */
const firstError = (error: unknown): string => {
  if (!error || typeof error !== "object") return "Não foi possível salvar o agendamento.";
  for (const value of Object.values(error as Record<string, unknown>)) {
    if (typeof value === "string") return value;
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  }
  return "Não foi possível salvar o agendamento.";
};

const labelClass = "text-body-xs-medium text-secondary";

export const ScheduledIssueFormModal = observer(function ScheduledIssueFormModal(props: Props) {
  const { isOpen, projectId, data, onClose, onSubmit } = props;
  const [form, setForm] = useState<TFormState>(empty());
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(data ? fromData(data) : empty());
    setError(null);
  }, [isOpen, data]);

  const set = <K extends keyof TFormState>(key: K, value: TFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleWeekday = (day: number) =>
    set(
      "weekdays",
      form.weekdays.includes(day) ? form.weekdays.filter((d) => d !== day) : [...form.weekdays, day].sort()
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) return setError("Informe o título da tarefa.");
    if (form.frequency === "weekly" && form.weekdays.length === 0)
      return setError("Escolha ao menos um dia da semana.");
    if (form.frequency === "once" && !form.run_on) return setError("Escolha a data.");

    const payload: Partial<TScheduledIssueForm> = {
      name: form.name.trim(),
      description_html: textToHtml(form.description),
      state_id: form.state_id,
      priority: form.priority,
      assignee_ids: form.assignee_ids,
      label_ids: form.label_ids,
      due_in_days: form.due_in_days === "" ? null : Math.max(0, parseInt(form.due_in_days, 10) || 0),
      frequency: form.frequency,
      time_of_day: form.time,
      weekdays: form.weekdays,
      month_day: parseInt(form.month_day, 10) || 1,
      run_on: form.run_on || null,
    };

    setIsSubmitting(true);
    try {
      await onSubmit(payload);
      onClose();
    } catch (err) {
      setError(firstError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resumo = describeSchedule({
    frequency: form.frequency,
    time_of_day: form.time,
    weekdays: form.weekdays,
    month_day: parseInt(form.month_day, 10) || null,
    run_on: form.run_on || null,
  });

  return (
    <ModalCore isOpen={isOpen} handleClose={onClose} position={EModalPosition.TOP} width={EModalWidth.XXL}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-5">
        <h3 className="text-h5-medium text-primary">{data ? "Editar tarefa agendada" : "Nova tarefa agendada"}</h3>

        {/* ── O que será criado ── */}
        <div className="flex flex-col gap-2">
          <Input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Título da tarefa"
            className="w-full"
            autoFocus
          />
          <TextArea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Descrição (opcional)"
            className="min-h-24 w-full"
          />
          <div className="flex flex-wrap items-center gap-2">
            <div className="h-7">
              <StateDropdown
                value={form.state_id ?? undefined}
                onChange={(stateId) => set("state_id", stateId)}
                projectId={projectId}
                buttonVariant="border-with-text"
              />
            </div>
            <div className="h-7">
              <PriorityDropdown
                value={form.priority}
                onChange={(priority) => set("priority", priority ?? "none")}
                buttonVariant="border-with-text"
              />
            </div>
            <div className="h-7">
              <MemberDropdown
                projectId={projectId}
                value={form.assignee_ids}
                onChange={(ids) => set("assignee_ids", ids)}
                buttonVariant={form.assignee_ids.length > 0 ? "transparent-without-text" : "border-with-text"}
                placeholder="Responsáveis"
                multiple
              />
            </div>
            <div className="h-7">
              <IssueLabelSelect
                value={form.label_ids}
                onChange={(ids) => set("label_ids", ids)}
                projectId={projectId}
                createLabelEnabled={false}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-body-xs-regular text-secondary">
            Prazo: vence
            <input
              type="number"
              min={0}
              max={365}
              value={form.due_in_days}
              onChange={(e) => set("due_in_days", e.target.value)}
              placeholder="—"
              className="w-16 rounded-sm border-[0.5px] border-strong bg-transparent px-2 py-1 text-primary"
            />
            dias depois de criada (vazio = sem prazo)
          </label>
        </div>

        {/* ── Quando ── */}
        <div className="flex flex-col gap-3 border-t border-subtle pt-4">
          <span className={labelClass}>Quando criar</span>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(FREQUENCY_LABELS) as TScheduledIssueFrequency[]).map((freq) => (
              <button
                key={freq}
                type="button"
                onClick={() => set("frequency", freq)}
                className={cn(
                  "rounded-sm border-[0.5px] px-3 py-1 text-body-xs-medium",
                  form.frequency === freq
                    ? "border-accent-strong bg-accent-primary/10 text-accent-primary"
                    : "border-strong text-secondary hover:bg-layer-1"
                )}
              >
                {FREQUENCY_LABELS[freq]}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {form.frequency === "once" && (
              <label className="flex items-center gap-2 text-body-xs-regular text-secondary">
                Data
                <input
                  type="date"
                  value={form.run_on}
                  onChange={(e) => set("run_on", e.target.value)}
                  className="rounded-sm border-[0.5px] border-strong bg-transparent px-2 py-1 text-primary"
                />
              </label>
            )}
            {form.frequency === "weekly" && (
              <div className="flex gap-1">
                {WEEKDAYS_SHORT.map((label, day) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleWeekday(day)}
                    className={cn(
                      "w-11 rounded-sm border-[0.5px] py-1 text-body-xs-medium",
                      form.weekdays.includes(day)
                        ? "border-accent-strong bg-accent-primary/10 text-accent-primary"
                        : "border-strong text-secondary hover:bg-layer-1"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {form.frequency === "monthly" && (
              <label className="flex items-center gap-2 text-body-xs-regular text-secondary">
                Dia do mês
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={form.month_day}
                  onChange={(e) => set("month_day", e.target.value)}
                  className="w-16 rounded-sm border-[0.5px] border-strong bg-transparent px-2 py-1 text-primary"
                />
              </label>
            )}
            <label className="flex items-center gap-2 text-body-xs-regular text-secondary">
              Horário
              <input
                type="time"
                value={form.time}
                onChange={(e) => set("time", e.target.value)}
                className="rounded-sm border-[0.5px] border-strong bg-transparent px-2 py-1 text-primary"
                required
              />
            </label>
          </div>
          <p className="text-body-xs-regular text-tertiary">
            {resumo} (horário de Brasília). A tarefa é criada no projeto, no estado escolhido acima.
          </p>
        </div>

        {error && <p className="text-body-xs-medium text-danger-primary">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-subtle pt-4">
          <Button type="button" variant="secondary" size="lg" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" size="lg" loading={isSubmitting} disabled={isSubmitting}>
            {data ? "Salvar" : "Criar agendamento"}
          </Button>
        </div>
      </form>
    </ModalCore>
  );
});
