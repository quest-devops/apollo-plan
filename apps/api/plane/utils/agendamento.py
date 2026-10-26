# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Cálculo da próxima execução das tarefas agendadas (Apollo).

Módulo PURO de propósito — sem Django — para ser testado isoladamente
(ver test_agendamento.py ao lado). Toda a aritmética é feita no fuso do
agendamento (padrão America/Sao_Paulo) e o resultado volta em UTC, que é como
o banco guarda.

Regras:
- `once`: executa uma vez na data+hora; se já passou, não há próxima (None).
- `daily`: todo dia no horário.
- `weekly`: nos dias da semana marcados (0 = segunda … 6 = domingo, como
  datetime.weekday()).
- `monthly`: no dia do mês marcado; mês sem esse dia (31 em abril, 30 em
  fevereiro…) executa no ÚLTIMO dia do mês — "todo dia 31" vira "todo fim de mês".
- A próxima execução é sempre ESTRITAMENTE depois de `depois_de`: se o servidor
  ficou fora do ar, não há rajada de tarefas atrasadas, só a próxima no horário.
"""

import calendar
from datetime import date, datetime, time, timedelta, timezone as dt_timezone
from zoneinfo import ZoneInfo

FREQUENCIAS = ("once", "daily", "weekly", "monthly")


def _local(dia: date, hora: time, tz: ZoneInfo) -> datetime:
    return datetime.combine(dia, hora).replace(tzinfo=tz)


def _dia_do_mes(ano: int, mes: int, dia_mes: int) -> date:
    ultimo = calendar.monthrange(ano, mes)[1]
    return date(ano, mes, min(dia_mes, ultimo))


def proxima_execucao(
    frequencia: str,
    hora: time,
    depois_de: datetime,
    fuso: str = "America/Sao_Paulo",
    dias_semana: list[int] | None = None,
    dia_mes: int | None = None,
    data_unica: date | None = None,
) -> datetime | None:
    """Próxima execução (em UTC) estritamente depois de `depois_de` (aware)."""
    if depois_de.tzinfo is None:
        raise ValueError("depois_de precisa ter fuso")
    tz = ZoneInfo(fuso)
    agora = depois_de.astimezone(tz)
    hora = hora.replace(second=0, microsecond=0, tzinfo=None)

    if frequencia == "once":
        if data_unica is None:
            raise ValueError("data_unica é obrigatória para 'once'")
        alvo = _local(data_unica, hora, tz)
        return alvo.astimezone(dt_timezone.utc) if alvo > agora else None

    if frequencia == "daily":
        alvo = _local(agora.date(), hora, tz)
        if alvo <= agora:
            alvo = _local(agora.date() + timedelta(days=1), hora, tz)
        return alvo.astimezone(dt_timezone.utc)

    if frequencia == "weekly":
        dias = sorted(set(dias_semana or []))
        if not dias or any(d < 0 or d > 6 for d in dias):
            raise ValueError("dias_semana precisa de ao menos um dia entre 0 e 6")
        for avanco in range(0, 8):
            dia = agora.date() + timedelta(days=avanco)
            if dia.weekday() in dias:
                alvo = _local(dia, hora, tz)
                if alvo > agora:
                    return alvo.astimezone(dt_timezone.utc)
        raise AssertionError("inalcançável: uma semana sempre contém o dia")

    if frequencia == "monthly":
        if dia_mes is None or not 1 <= dia_mes <= 31:
            raise ValueError("dia_mes precisa estar entre 1 e 31")
        ano, mes = agora.year, agora.month
        for _ in range(0, 3):
            alvo = _local(_dia_do_mes(ano, mes, dia_mes), hora, tz)
            if alvo > agora:
                return alvo.astimezone(dt_timezone.utc)
            ano, mes = (ano + 1, 1) if mes == 12 else (ano, mes + 1)
        raise AssertionError("inalcançável: o mês seguinte sempre serve")

    raise ValueError(f"frequência desconhecida: {frequencia}")
