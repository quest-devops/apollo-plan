/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { AlertModalCore, Loader, ToggleSwitch } from "@plane/ui";
// components
import { SettingsControlItem } from "@/components/settings/control-item";
// hooks
import { useMember } from "@/hooks/store/use-member";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useUser, useUserPermissions } from "@/hooks/store/user";
// services
import type { TScheduledIssue, TScheduledIssueForm } from "@/services/scheduled-issue.service";
import { ScheduledIssueService } from "@/services/scheduled-issue.service";
// local
import { ScheduledIssueFormModal } from "./form-modal";
import { describeDue, describeSchedule, formatDateTimeBR } from "./helpers";

const service = new ScheduledIssueService();

type Props = {
  workspaceSlug: string;
  projectId: string;
};

/*
 * Tarefas agendadas (Apollo) — o Plan cria o item sozinho numa data/hora ou numa
 * repetição. Qualquer membro que cria itens pode agendar; editar, pausar e
 * excluir é do admin do projeto ou de quem criou o agendamento (o backend
 * aplica a mesma regra).
 */
export const ScheduledIssuesAutomation = observer(function ScheduledIssuesAutomation(props: Props) {
  const { workspaceSlug, projectId } = props;
  const [modal, setModal] = useState<{ open: boolean; data: TScheduledIssue | null }>({ open: false, data: null });
  const [toDelete, setToDelete] = useState<TScheduledIssue | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // store hooks
  const { data: currentUser } = useUser();
  const { allowPermissions } = useUserPermissions();
  const { getStateById, fetchProjectStates } = useProjectState();
  const { getUserDetails } = useMember();

  const isAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT, workspaceSlug, projectId);
  const canCreate = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT,
    workspaceSlug,
    projectId
  );

  // estados do projeto, para mostrar em que estado cada tarefa nasce
  useSWR(`SCHEDULED_ISSUES_STATES_${projectId}`, () => fetchProjectStates(workspaceSlug, projectId), {
    revalidateOnFocus: false,
  });

  const key = `SCHEDULED_ISSUES_${projectId}`;
  const { data: items, isLoading, mutate } = useSWR(key, () => service.list(workspaceSlug, projectId), {
    revalidateOnFocus: false,
  });

  const canManage = (item: TScheduledIssue) => isAdmin || item.created_by === currentUser?.id;

  const handleSubmit = async (payload: Partial<TScheduledIssueForm>) => {
    if (modal.data) await service.update(workspaceSlug, projectId, modal.data.id, payload);
    else await service.create(workspaceSlug, projectId, payload);
    await mutate();
    setToast({
      type: TOAST_TYPE.SUCCESS,
      title: "Pronto",
      message: modal.data ? "Agendamento atualizado." : "Agendamento criado.",
    });
  };

  const handleToggle = async (item: TScheduledIssue) => {
    try {
      await service.update(workspaceSlug, projectId, item.id, { is_active: !item.is_active });
      await mutate();
    } catch (err) {
      const msg = err && typeof err === "object" ? Object.values(err as Record<string, unknown>).flat()[0] : null;
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Não foi possível alterar",
        message: typeof msg === "string" ? msg : "Tente novamente.",
      });
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setIsDeleting(true);
    try {
      await service.remove(workspaceSlug, projectId, toDelete.id);
      await mutate();
      setToDelete(null);
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Erro", message: "Não foi possível excluir o agendamento." });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="w-full">
      <ScheduledIssueFormModal
        isOpen={modal.open}
        projectId={projectId}
        data={modal.data}
        onClose={() => setModal({ open: false, data: null })}
        onSubmit={handleSubmit}
      />
      <AlertModalCore
        isOpen={!!toDelete}
        handleClose={() => setToDelete(null)}
        handleSubmit={handleDelete}
        isSubmitting={isDeleting}
        title="Excluir agendamento"
        content={
          <>
            Excluir <span className="font-medium text-primary">{toDelete?.name}</span>? As tarefas já criadas por ele
            continuam no projeto; só deixam de ser criadas novas.
          </>
        }
      />

      <div className="flex flex-col gap-4 border-b border-subtle py-2">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-sm bg-layer-2">
            <CalendarClock className="size-4 shrink-0 text-primary" />
          </div>
          <SettingsControlItem
            title="Tarefas agendadas"
            description="Crie tarefas automaticamente numa data, ou todo dia, toda semana ou todo mês, já com estado, responsáveis e prazo."
            control={
              canCreate ? (
                <Button
                  variant="primary"
                  size="lg"
                  prependIcon={<Plus className="size-3.5" />}
                  onClick={() => setModal({ open: true, data: null })}
                >
                  Nova
                </Button>
              ) : null
            }
          />
        </div>

        {isLoading ? (
          <Loader className="ml-12">
            <Loader.Item height="48px" />
          </Loader>
        ) : items && items.length > 0 ? (
          <ul className="ml-12 flex flex-col divide-y divide-subtle rounded-md border border-subtle">
            {items.map((item) => {
              const state = getStateById(item.state_id);
              const responsaveis = item.assignee_ids
                .map((id) => getUserDetails(id)?.display_name)
                .filter(Boolean)
                .join(", ");
              const gerenciavel = canManage(item);
              return (
                <li key={item.id} className="flex items-start gap-3 px-3 py-2.5">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className={`truncate text-body-sm-medium ${item.is_active ? "text-primary" : "text-tertiary"}`}>
                      {item.name}
                    </span>
                    <span className="text-body-xs-regular text-secondary">{describeSchedule(item)}</span>
                    <span className="text-body-xs-regular text-tertiary">
                      {state ? `Nasce em "${state.name}"` : "Nasce no estado padrão"}
                      {responsaveis ? ` · para ${responsaveis}` : ""}
                      {item.due_amount !== null ? ` · vencimento ${describeDue(item.due_amount, item.due_unit)}` : ""}
                    </span>
                    <span className="text-body-xs-regular text-tertiary">
                      {item.is_active
                        ? `Próxima: ${formatDateTimeBR(item.next_run_at)}`
                        : item.frequency === "once" && item.last_run_at
                          ? `Executada em ${formatDateTimeBR(item.last_run_at)}`
                          : "Pausada"}
                      {item.last_run_at && item.is_active ? ` · última: ${formatDateTimeBR(item.last_run_at)}` : ""}
                    </span>
                    {item.last_error && (
                      <span className="text-body-xs-regular text-danger-primary">
                        Falhou na última execução: {item.last_error}
                      </span>
                    )}
                  </div>
                  {gerenciavel && (
                    <div className="flex shrink-0 items-center gap-2 pt-0.5">
                      <ToggleSwitch value={item.is_active} onChange={() => handleToggle(item)} size="sm" />
                      <button
                        type="button"
                        className="grid size-6 place-items-center rounded-sm text-secondary hover:bg-layer-1"
                        onClick={() => setModal({ open: true, data: item })}
                        aria-label="Editar agendamento"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        className="grid size-6 place-items-center rounded-sm text-secondary hover:bg-layer-1 hover:text-danger-primary"
                        onClick={() => setToDelete(item)}
                        aria-label="Excluir agendamento"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="ml-12 text-body-xs-regular text-tertiary">Nenhuma tarefa agendada neste projeto.</p>
        )}
      </div>
    </section>
  );
});
