# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.utils import timezone
from rest_framework import serializers

from plane.db.models import Label, ProjectMember, ScheduledIssue, State
from plane.utils.agendamento import proxima_execucao
from plane.utils.content_validator import validate_html_content

from .base import BaseSerializer

PRIORIDADES = ("urgent", "high", "medium", "low", "none")


class ScheduledIssueSerializer(BaseSerializer):
    """
    Tarefas agendadas (Apollo). Tudo que aponta para outro objeto (estado,
    etiquetas, responsáveis) é conferido CONTRA O PROJETO DA URL: a instância é
    compartilhada entre empresas, e um id de fora não pode entrar num
    agendamento. O `next_run_at` é sempre calculado aqui, nunca vem do cliente.
    """

    state_id = serializers.PrimaryKeyRelatedField(
        source="state", queryset=State.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = ScheduledIssue
        fields = [
            "id",
            "project",
            "workspace",
            "name",
            "description_html",
            "state_id",
            "priority",
            "assignee_ids",
            "label_ids",
            "due_in_days",
            "frequency",
            "time_of_day",
            "weekdays",
            "month_day",
            "run_on",
            "timezone",
            "is_active",
            "next_run_at",
            "last_run_at",
            "last_issue",
            "last_error",
            "created_by",
            "created_at",
        ]
        read_only_fields = [
            "project",
            "workspace",
            "timezone",
            "next_run_at",
            "last_run_at",
            "last_issue",
            "last_error",
            "created_by",
            "created_at",
        ]

    def _valor(self, attrs, campo, padrao=None):
        """Valor final do campo (o novo, ou o atual numa edição parcial)."""
        if campo in attrs:
            return attrs[campo]
        if self.instance is not None:
            return getattr(self.instance, campo)
        return padrao

    def validate(self, attrs):
        project_id = self.context["project_id"]

        if "name" in attrs and not (attrs["name"] or "").strip():
            raise serializers.ValidationError({"name": "Informe o título da tarefa."})

        if attrs.get("description_html"):
            is_valid, _, sanitized = validate_html_content(attrs["description_html"])
            if not is_valid:
                raise serializers.ValidationError({"description_html": "Conteúdo inválido."})
            if sanitized is not None:
                attrs["description_html"] = sanitized

        if "priority" in attrs and attrs["priority"] not in PRIORIDADES:
            raise serializers.ValidationError({"priority": "Prioridade inválida."})

        estado = attrs.get("state")
        if estado is not None and (estado.project_id != project_id or estado.is_triage):
            raise serializers.ValidationError({"state_id": "Estado não pertence a este projeto."})

        if "label_ids" in attrs:
            ids = list(dict.fromkeys(attrs["label_ids"] or []))
            validos = set(Label.objects.filter(project_id=project_id, id__in=ids).values_list("id", flat=True))
            if len(validos) != len(ids):
                raise serializers.ValidationError({"label_ids": "Etiqueta não pertence a este projeto."})
            attrs["label_ids"] = ids

        if "assignee_ids" in attrs:
            ids = list(dict.fromkeys(attrs["assignee_ids"] or []))
            validos = set(
                ProjectMember.objects.filter(
                    project_id=project_id, member_id__in=ids, is_active=True, role__gte=15
                ).values_list("member_id", flat=True)
            )
            if len(validos) != len(ids):
                raise serializers.ValidationError({"assignee_ids": "Responsável não é membro deste projeto."})
            attrs["assignee_ids"] = ids

        frequencia = self._valor(attrs, "frequency")
        if frequencia not in dict(ScheduledIssue.FREQUENCY_CHOICES):
            raise serializers.ValidationError({"frequency": "Escolha a repetição."})
        hora = self._valor(attrs, "time_of_day")
        if hora is None:
            raise serializers.ValidationError({"time_of_day": "Informe o horário."})

        # limpa o que não é da frequência escolhida (evita lixo de edições anteriores)
        dias_semana = sorted(set(self._valor(attrs, "weekdays") or [])) if frequencia == "weekly" else []
        dia_mes = self._valor(attrs, "month_day") if frequencia == "monthly" else None
        data_unica = self._valor(attrs, "run_on") if frequencia == "once" else None
        attrs["weekdays"], attrs["month_day"], attrs["run_on"] = dias_semana, dia_mes, data_unica

        if "due_in_days" in attrs and attrs["due_in_days"] is not None and attrs["due_in_days"] > 365:
            raise serializers.ValidationError({"due_in_days": "Prazo de no máximo 365 dias."})

        fuso = self._valor(attrs, "timezone", "America/Sao_Paulo")
        try:
            proxima = proxima_execucao(
                frequencia,
                hora,
                timezone.now(),
                fuso=fuso,
                dias_semana=dias_semana,
                dia_mes=dia_mes,
                data_unica=data_unica,
            )
        except ValueError as e:
            mensagens = {
                "weekly": {"weekdays": "Escolha ao menos um dia da semana."},
                "monthly": {"month_day": "Escolha um dia do mês entre 1 e 31."},
                "once": {"run_on": "Escolha a data."},
            }
            raise serializers.ValidationError(mensagens.get(frequencia, {"frequency": str(e)}))

        ativo = self._valor(attrs, "is_active", True)
        if ativo and proxima is None:
            raise serializers.ValidationError({"run_on": "Essa data e horário já passaram."})
        attrs["next_run_at"] = proxima if ativo else None
        return attrs
