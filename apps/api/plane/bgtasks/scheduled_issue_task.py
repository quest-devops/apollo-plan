# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Tarefas agendadas (Apollo): cria os itens cujo agendamento venceu.

Roda a cada minuto pelo beat (celery.py). Cada agendamento vencido é tratado
numa transação própria, com a linha travada (`select_for_update(skip_locked)`):
criar o item e avançar o `next_run_at` acontecem juntos — se dois workers
rodarem ao mesmo tempo, um pula a linha que o outro pegou, e uma execução
nunca vira dois itens.

Sem rajada: depois de uma queda, cada agendamento cria UM item (o atrasado) e
pula para a próxima data futura — não recria tudo o que deixou de rodar.
"""

import json
from zoneinfo import ZoneInfo

from celery import shared_task
from crum import impersonate
from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.utils import timezone

from plane.app.serializers import IssueCreateSerializer
from plane.bgtasks.issue_activities_task import issue_activity
from plane.db.models import Label, ProjectMember, ScheduledIssue, State
from plane.utils.agendamento import proxima_execucao, somar_prazo
from plane.utils.exception_logger import log_exception

# por rodada: protege o worker se algo acumular (o resto fica para o minuto seguinte)
LIMITE_POR_RODADA = 200


def calcular_proxima(agendamento: ScheduledIssue, depois_de):
    # "uma vez" que já executou (ou falhou ao executar) não tem próxima,
    # mesmo que a data marcada ainda esteja no futuro
    if agendamento.frequency == "once":
        return None
    return proxima_execucao(
        agendamento.frequency,
        agendamento.time_of_day,
        depois_de,
        fuso=agendamento.timezone,
        dias_semana=agendamento.weekdays,
        dia_mes=agendamento.month_day,
        data_unica=agendamento.run_on,
    )


def _dados_do_item(agendamento: ScheduledIssue) -> dict:
    """Monta o payload do item com os dados VÁLIDOS no momento da execução."""
    project_id = agendamento.project_id
    # responsáveis: só quem continua membro ativo com papel de criar item
    responsaveis = list(
        ProjectMember.objects.filter(
            project_id=project_id,
            member_id__in=agendamento.assignee_ids or [],
            is_active=True,
            role__gte=15,
        ).values_list("member_id", flat=True)
    )
    etiquetas = list(
        Label.objects.filter(project_id=project_id, id__in=agendamento.label_ids or []).values_list("id", flat=True)
    )
    estado = None
    if agendamento.state_id and State.objects.filter(project_id=project_id, id=agendamento.state_id).exists():
        estado = agendamento.state_id  # senão o Issue.save() usa o estado padrão do projeto

    dados = {
        "name": agendamento.name,
        "description_html": agendamento.description_html or "<p></p>",
        "priority": agendamento.priority or "none",
        "assignee_ids": [str(r) for r in responsaveis],
        "label_ids": [str(e) for e in etiquetas],
    }
    if estado:
        dados["state_id"] = str(estado)
    if agendamento.due_amount is not None:
        hoje_local = timezone.now().astimezone(ZoneInfo(agendamento.timezone)).date()
        dados["start_date"] = hoje_local.isoformat()
        dados["target_date"] = somar_prazo(hoje_local, agendamento.due_amount, agendamento.due_unit).isoformat()
    return dados


def executar_agendamento(agendamento_id) -> str | None:
    """Executa um agendamento vencido. Devolve o id do item criado (ou None)."""
    with transaction.atomic():
        agendamento = (
            # of=("self",): trava SÓ a linha do agendamento — o Postgres recusa
            # FOR UPDATE no lado anulável do JOIN (created_by pode ser nulo)
            ScheduledIssue.objects.select_for_update(skip_locked=True, of=("self",))
            .select_related("project", "created_by")
            .filter(
                id=agendamento_id,
                is_active=True,
                next_run_at__lte=timezone.now(),
                project__archived_at__isnull=True,
                project__deleted_at__isnull=True,
                deleted_at__isnull=True,
            )
            .first()
        )
        if agendamento is None:  # outro worker pegou, ou deixou de valer
            return None

        agora = timezone.now()
        project = agendamento.project
        dados = _dados_do_item(agendamento)

        # o item nasce "criado por" quem fez o agendamento (aparece assim no histórico)
        with impersonate(agendamento.created_by):
            serializer = IssueCreateSerializer(
                data=dados,
                context={
                    "project_id": project.id,
                    "workspace_id": project.workspace_id,
                    "default_assignee_id": project.default_assignee_id,
                },
            )
            if not serializer.is_valid():
                agendamento.last_error = json.dumps(serializer.errors, ensure_ascii=False)[:2000]
                # erro de dado não se resolve sozinho: avança para não repetir a cada minuto
                agendamento.next_run_at = calcular_proxima(agendamento, agora)
                agendamento.is_active = agendamento.next_run_at is not None
                agendamento.save(
                    update_fields=["last_error", "next_run_at", "is_active", "updated_at"],
                    disable_auto_set_user=True,
                )
                return None
            issue = serializer.save()

        agendamento.last_run_at = agora
        agendamento.last_issue = issue
        agendamento.last_error = ""
        agendamento.next_run_at = calcular_proxima(agendamento, agora)
        if agendamento.next_run_at is None:  # "uma vez" já rodou
            agendamento.is_active = False
        agendamento.save(
            update_fields=["last_run_at", "last_issue", "last_error", "next_run_at", "is_active", "updated_at"],
            disable_auto_set_user=True,
        )

        # atividade/notificação só DEPOIS do commit: se fosse dentro da
        # transação, o worker poderia procurar o item antes de ele existir
        actor_id = str(agendamento.created_by_id or project.created_by_id)
        transaction.on_commit(
            lambda: issue_activity.delay(
                type="issue.activity.created",
                requested_data=json.dumps({**dados, "scheduled_issue": str(agendamento.id)}, cls=DjangoJSONEncoder),
                actor_id=actor_id,
                issue_id=str(issue.id),
                project_id=str(project.id),
                current_instance=None,
                epoch=int(timezone.now().timestamp()),
                notification=True,
                origin=settings.WEB_URL or settings.APP_BASE_URL,
            )
        )
        return str(issue.id)


@shared_task
def create_scheduled_issues():
    vencidos = list(
        ScheduledIssue.objects.filter(
            is_active=True,
            next_run_at__lte=timezone.now(),
            deleted_at__isnull=True,
        )
        .order_by("next_run_at")
        .values_list("id", flat=True)[:LIMITE_POR_RODADA]
    )
    for agendamento_id in vencidos:
        try:
            executar_agendamento(agendamento_id)
        except Exception as e:
            log_exception(e)
            # registra o erro, avança para a próxima data (senão repetiria a
            # falha a cada minuto) e segue para os outros — um agendamento
            # quebrado não pode travar os demais
            try:
                agendamento = ScheduledIssue.objects.get(id=agendamento_id)
                proxima = calcular_proxima(agendamento, timezone.now())
                ScheduledIssue.objects.filter(id=agendamento_id).update(
                    last_error=str(e)[:2000],
                    next_run_at=proxima,
                    is_active=proxima is not None,
                )
            except Exception as e2:
                log_exception(e2)
