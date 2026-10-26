# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.contrib.postgres.fields import ArrayField
from django.db import models

# Module imports
from .project import ProjectBaseModel


class ScheduledIssue(ProjectBaseModel):
    """
    Tarefa agendada (Apollo): um modelo de item que o Plan cria sozinho numa
    data/hora ou numa repetição (diária, semanal, mensal).

    A CE do Plane não tem itens recorrentes (é recurso pago e o código não
    existe no repo). Quem dispara é a rotina `create_scheduled_issues`
    (bgtasks/scheduled_issue_task.py), que roda a cada minuto e cria os itens
    cujo `next_run_at` venceu. A aritmética de datas mora em
    plane/utils/agendamento.py (puro, com testes).
    """

    FREQUENCY_CHOICES = (
        ("once", "Uma vez"),
        ("daily", "Diária"),
        ("weekly", "Semanal"),
        ("monthly", "Mensal"),
    )

    # --- o item que será criado ---
    name = models.CharField(max_length=255)
    description_html = models.TextField(blank=True, default="<p></p>")
    # SET_NULL: estado apagado não pode apagar o agendamento; na execução cai
    # no estado padrão do projeto
    state = models.ForeignKey(
        "db.State", on_delete=models.SET_NULL, null=True, blank=True, related_name="scheduled_issues"
    )
    priority = models.CharField(max_length=30, default="none")
    # ids e não M2M: na execução são refiltrados (membro que saiu do projeto,
    # etiqueta apagada) — o agendamento sobrevive a essas mudanças
    assignee_ids = ArrayField(models.UUIDField(), default=list, blank=True)
    label_ids = ArrayField(models.UUIDField(), default=list, blank=True)
    # prazo relativo: "vence N dias depois de criado" (vazio = sem prazo)
    due_in_days = models.PositiveSmallIntegerField(null=True, blank=True)

    # --- quando ---
    frequency = models.CharField(max_length=10, choices=FREQUENCY_CHOICES)
    time_of_day = models.TimeField()
    weekdays = ArrayField(models.PositiveSmallIntegerField(), default=list, blank=True)  # 0=seg … 6=dom
    month_day = models.PositiveSmallIntegerField(null=True, blank=True)  # 1–31 (31 = último dia)
    run_on = models.DateField(null=True, blank=True)  # só para "once"
    timezone = models.CharField(max_length=64, default="America/Sao_Paulo")

    # --- estado da execução ---
    is_active = models.BooleanField(default=True)
    next_run_at = models.DateTimeField(null=True, blank=True, db_index=True)
    last_run_at = models.DateTimeField(null=True, blank=True)
    last_issue = models.ForeignKey(
        "db.Issue", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    last_error = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = "Scheduled Issue"
        verbose_name_plural = "Scheduled Issues"
        db_table = "scheduled_issues"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.name} ({self.frequency}) <{self.project_id}>"
