# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from .. import BaseViewSet
from plane.app.permissions import ROLE, allow_permission
from plane.app.serializers.scheduled_issue import ScheduledIssueSerializer
from plane.db.models import Project, ScheduledIssue


class ScheduledIssueViewSet(BaseViewSet):
    """
    Tarefas agendadas do projeto (Apollo).

    Quem pode criar item (Admin e Membro) pode criar agendamento. Editar,
    pausar e excluir: o admin do projeto ou quem criou o agendamento.
    """

    serializer_class = ScheduledIssueSerializer
    model = ScheduledIssue

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project_id=self.kwargs.get("project_id"))
            .filter(
                project__project_projectmember__member=self.request.user,
                project__project_projectmember__is_active=True,
                project__archived_at__isnull=True,
            )
            .select_related("project", "state", "created_by")
            .distinct()
        )

    def _context(self):
        return {"project_id": self.kwargs.get("project_id")}

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def list(self, request, slug, project_id):
        serializer = ScheduledIssueSerializer(self.get_queryset(), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def create(self, request, slug, project_id):
        project = Project.objects.get(pk=project_id, workspace__slug=slug)
        serializer = ScheduledIssueSerializer(data=request.data, context=self._context())
        if serializer.is_valid():
            serializer.save(project=project)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN], creator=True, model=ScheduledIssue)
    def partial_update(self, request, slug, project_id, pk):
        agendamento = self.get_queryset().filter(pk=pk).first()
        if agendamento is None:
            return Response({"error": "Agendamento não encontrado."}, status=status.HTTP_404_NOT_FOUND)
        serializer = ScheduledIssueSerializer(agendamento, data=request.data, partial=True, context=self._context())
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN], creator=True, model=ScheduledIssue)
    def destroy(self, request, slug, project_id, pk):
        agendamento = self.get_queryset().filter(pk=pk).first()
        if agendamento is None:
            return Response({"error": "Agendamento não encontrado."}, status=status.HTTP_404_NOT_FOUND)
        agendamento.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
