/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { ScheduledIssuesAutomation } from "@/components/automation/scheduled-issues/root";

export type TCustomAutomationsRootProps = {
  projectId: string;
  workspaceSlug: string;
};

// Apollo: tarefas agendadas (a CE não tem automações próprias — o slot fica com o nosso recurso)
export function CustomAutomationsRoot(props: TCustomAutomationsRootProps) {
  return <ScheduledIssuesAutomation workspaceSlug={props.workspaceSlug} projectId={props.projectId} />;
}
