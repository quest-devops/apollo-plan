/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { CircleDot, XCircle } from "lucide-react";
import { DuplicatePropertyIcon, RelatedIcon, CloseIcon } from "@plane/propel/icons";
import type { ISearchIssueResponse, TIssueRelationTypes } from "@plane/types";
import { CustomMenu } from "@plane/ui";
// components
import { ExistingIssuesListModal } from "@/components/core/modals/existing-issues-list-modal";
// hooks
import { useIssueModal } from "@/hooks/context/use-issue-modal";

/*
 * Relações já na criação do item (Apollo).
 *
 * POR QUE EXISTE: o vínculo pai/filho do Plane só aceita itens do MESMO projeto,
 * mas na Apollo cada setor é um projeto — uma demanda que atravessa setores
 * precisa ligar itens de projetos diferentes. A RELAÇÃO (relacionado, bloqueia...)
 * atravessa projetos, só que o upstream só deixa criá-la depois, na tela do item.
 * Aqui ela é escolhida no próprio modal e gravada logo após o item ser criado
 * (ver handleCreateIssue em ../base.tsx). Enquanto o item não existe, as escolhas
 * ficam no contexto do modal (pendingRelations).
 */

export const RELATION_LABELS: Record<TIssueRelationTypes, string> = {
  relates_to: "Relacionado a",
  blocked_by: "Bloqueado por",
  blocking: "Bloqueia",
  duplicate: "Duplicado de",
};

const RELATION_ICONS: Record<TIssueRelationTypes, (size: number) => React.ReactNode> = {
  relates_to: (size) => <RelatedIcon height={size} width={size} />,
  blocked_by: (size) => <CircleDot size={size} />,
  blocking: (size) => <XCircle size={size} />,
  duplicate: (size) => <DuplicatePropertyIcon height={size} width={size} />,
};

const RELATION_ORDER: TIssueRelationTypes[] = ["relates_to", "blocked_by", "blocking", "duplicate"];

type Props = {
  workspaceSlug: string;
  projectId: string | null;
  tabIndex?: number;
};

export const IssueModalRelationsSelect = observer(function IssueModalRelationsSelect(props: Props) {
  const { workspaceSlug, projectId, tabIndex } = props;
  const { pendingRelations, setPendingRelations } = useIssueModal();
  // tipo escolhido no menu; com valor, o modal de busca fica aberto
  const [activeType, setActiveType] = useState<TIssueRelationTypes | null>(null);

  const handleSubmit = async (issues: ISearchIssueResponse[]) => {
    if (!activeType) return;
    setPendingRelations((prev) => {
      // o mesmo item só pode ter uma relação com o novo item: a escolha mais recente vale
      const novos = issues.map((issue) => issue.id);
      const mantidos = prev.filter((p) => !novos.includes(p.issue.id));
      return [...mantidos, ...issues.map((issue) => ({ relationType: activeType, issue }))];
    });
    setActiveType(null);
  };

  const removePending = (issueId: string) => setPendingRelations((prev) => prev.filter((p) => p.issue.id !== issueId));

  return (
    <>
      <div className="h-7">
        <CustomMenu
          customButton={
            <span className="flex h-full cursor-pointer items-center gap-1 rounded-sm border-[0.5px] border-strong px-2 py-0.5 text-caption-sm-regular hover:bg-layer-1">
              <RelatedIcon className="h-3 w-3 flex-shrink-0" />
              <span className="whitespace-nowrap">Adicionar relação</span>
            </span>
          }
          placement="bottom-start"
          className="h-full"
          customButtonClassName="h-full"
          tabIndex={tabIndex}
        >
          {RELATION_ORDER.map((type) => (
            <CustomMenu.MenuItem key={type} className="flex items-center gap-2 !p-1" onClick={() => setActiveType(type)}>
              {RELATION_ICONS[type](12)}
              {RELATION_LABELS[type]}…
            </CustomMenu.MenuItem>
          ))}
        </CustomMenu>
      </div>

      {pendingRelations.length > 0 && (
        <div className="flex w-full flex-wrap items-center gap-1.5">
          {pendingRelations.map(({ relationType, issue }) => (
            <span
              key={issue.id}
              className="flex items-center gap-1 rounded-sm border-[0.5px] border-strong px-1.5 py-0.5 text-caption-sm-regular"
              title={issue.name}
            >
              {RELATION_ICONS[relationType](11)}
              <span className="text-tertiary">{RELATION_LABELS[relationType]}</span>
              <span className="font-medium">
                {issue.project__identifier}-{issue.sequence_id}
              </span>
              <button
                type="button"
                className="grid place-items-center"
                onClick={() => removePending(issue.id)}
                aria-label="Remover relação"
              >
                <CloseIcon className="h-2.5 w-2.5 text-tertiary hover:text-danger-primary" />
              </button>
            </span>
          ))}
        </div>
      )}

      <ExistingIssuesListModal
        workspaceSlug={workspaceSlug}
        projectId={projectId ?? undefined}
        isOpen={activeType !== null}
        handleClose={() => setActiveType(null)}
        searchParams={{ issue_relation: true }}
        handleOnSubmit={handleSubmit}
        workspaceLevelToggle
        // a razão de ser deste recurso é ligar itens de OUTROS projetos (setores):
        // a busca já abre no workspace inteiro
        defaultWorkspaceLevel
      />
    </>
  );
});
