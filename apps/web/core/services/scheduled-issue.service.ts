/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type { TIssuePriorities } from "@plane/types";
import { APIService } from "@/services/api.service";

// Apollo: tarefas agendadas (backend em apps/api/plane/app/views/scheduled_issue)
export type TScheduledIssueFrequency = "once" | "daily" | "weekly" | "monthly";
export type TScheduledIssueDueUnit = "day" | "week" | "month" | "year";

export type TScheduledIssue = {
  id: string;
  project: string;
  name: string;
  description_html: string;
  state_id: string | null;
  priority: TIssuePriorities;
  assignee_ids: string[];
  label_ids: string[];
  due_amount: number | null; // vazio = sem prazo
  due_unit: TScheduledIssueDueUnit; // mês/ano = de calendário
  frequency: TScheduledIssueFrequency;
  time_of_day: string; // "HH:MM:SS"
  weekdays: number[]; // 0 = segunda … 6 = domingo
  month_day: number | null;
  run_on: string | null; // "YYYY-MM-DD"
  timezone: string;
  is_active: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  last_issue: string | null;
  last_error: string;
  created_by: string | null;
  created_at: string;
};

export type TScheduledIssueForm = Pick<
  TScheduledIssue,
  | "name"
  | "description_html"
  | "state_id"
  | "priority"
  | "assignee_ids"
  | "label_ids"
  | "due_amount"
  | "due_unit"
  | "frequency"
  | "time_of_day"
  | "weekdays"
  | "month_day"
  | "run_on"
  | "is_active"
>;

export class ScheduledIssueService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  private base(workspaceSlug: string, projectId: string) {
    return `/api/workspaces/${workspaceSlug}/projects/${projectId}/scheduled-issues/`;
  }

  async list(workspaceSlug: string, projectId: string): Promise<TScheduledIssue[]> {
    return this.get(this.base(workspaceSlug, projectId))
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async create(workspaceSlug: string, projectId: string, data: Partial<TScheduledIssueForm>): Promise<TScheduledIssue> {
    return this.post(this.base(workspaceSlug, projectId), data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async update(
    workspaceSlug: string,
    projectId: string,
    id: string,
    data: Partial<TScheduledIssueForm>
  ): Promise<TScheduledIssue> {
    return this.patch(`${this.base(workspaceSlug, projectId)}${id}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async remove(workspaceSlug: string, projectId: string, id: string): Promise<void> {
    return this.delete(`${this.base(workspaceSlug, projectId)}${id}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
