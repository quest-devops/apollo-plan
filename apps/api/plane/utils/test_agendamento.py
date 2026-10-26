# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Testes do cálculo de agendamento (módulo puro — roda sem Django:
`python -m unittest plane.utils.test_agendamento` a partir de apps/api)."""

import unittest
from datetime import date, datetime, time, timezone

from plane.utils.agendamento import proxima_execucao

UTC = timezone.utc



class TestAgendamento(unittest.TestCase):
    def test_once_futuro_e_passado(self):
        agora = datetime(2026, 10, 26, 12, 0, tzinfo=UTC)  # 09:00 em SP
        r = proxima_execucao("once", time(10, 0), agora, data_unica=date(2026, 10, 26))
        self.assertEqual(r, datetime(2026, 10, 26, 13, 0, tzinfo=UTC))
        self.assertIsNone(proxima_execucao("once", time(8, 0), agora, data_unica=date(2026, 10, 26)))

    def test_daily_hoje_ou_amanha(self):
        agora = datetime(2026, 10, 26, 12, 0, tzinfo=UTC)  # 09:00 SP
        self.assertEqual(proxima_execucao("daily", time(9, 30), agora), datetime(2026, 10, 26, 12, 30, tzinfo=UTC))
        self.assertEqual(proxima_execucao("daily", time(8, 0), agora), datetime(2026, 10, 27, 11, 0, tzinfo=UTC))
        # exatamente no horário: a próxima é amanhã (estritamente depois)
        self.assertEqual(proxima_execucao("daily", time(9, 0), agora), datetime(2026, 10, 27, 12, 0, tzinfo=UTC))

    def test_daily_virada_de_dia_utc(self):
        # 22:30 em SP já é dia seguinte em UTC — o "hoje" é o de SP
        agora = datetime(2026, 10, 27, 1, 0, tzinfo=UTC)  # 26/10 22:00 SP
        self.assertEqual(proxima_execucao("daily", time(23, 0), agora), datetime(2026, 10, 27, 2, 0, tzinfo=UTC))

    def test_weekly_varios_dias_e_virada_de_semana(self):
        # 26/10/2026 é segunda-feira
        agora = datetime(2026, 10, 30, 20, 0, tzinfo=UTC)  # sexta 17:00 SP
        # seg e sex às 09:00 → sexta já passou → próxima segunda 02/11
        r = proxima_execucao("weekly", time(9, 0), agora, dias_semana=[0, 4])
        self.assertEqual(r, datetime(2026, 11, 2, 12, 0, tzinfo=UTC))
        # sexta às 18:00 ainda não passou → hoje
        r = proxima_execucao("weekly", time(18, 0), agora, dias_semana=[4])
        self.assertEqual(r, datetime(2026, 10, 30, 21, 0, tzinfo=UTC))
        # só sexta às 09:00, hoje já passou → semana que vem
        r = proxima_execucao("weekly", time(9, 0), agora, dias_semana=[4])
        self.assertEqual(r, datetime(2026, 11, 6, 12, 0, tzinfo=UTC))

    def test_monthly_dia_31_vira_ultimo_dia(self):
        agora = datetime(2026, 2, 1, 12, 0, tzinfo=UTC)
        r = proxima_execucao("monthly", time(9, 0), agora, dia_mes=31)
        self.assertEqual(r, datetime(2026, 2, 28, 12, 0, tzinfo=UTC))
        agora = datetime(2026, 4, 30, 13, 0, tzinfo=UTC)  # 30/04 10:00 SP, após o horário
        r = proxima_execucao("monthly", time(9, 0), agora, dia_mes=31)
        self.assertEqual(r, datetime(2026, 5, 31, 12, 0, tzinfo=UTC))
        # bissexto
        r = proxima_execucao("monthly", time(9, 0), datetime(2028, 2, 10, tzinfo=UTC), dia_mes=30)
        self.assertEqual(r, datetime(2028, 2, 29, 12, 0, tzinfo=UTC))

    def test_monthly_virada_de_ano(self):
        agora = datetime(2026, 12, 20, 12, 0, tzinfo=UTC)
        r = proxima_execucao("monthly", time(9, 0), agora, dia_mes=5)
        self.assertEqual(r, datetime(2027, 1, 5, 12, 0, tzinfo=UTC))

    def test_sem_rajada_apos_queda(self):
        # servidor fora do ar 3 dias: a próxima diária é só a de amanhã, não 3 atrasadas
        agora = datetime(2026, 10, 29, 15, 0, tzinfo=UTC)
        r = proxima_execucao("daily", time(9, 0), agora)
        self.assertEqual(r, datetime(2026, 10, 30, 12, 0, tzinfo=UTC))

    def test_entradas_invalidas(self):
        agora = datetime(2026, 10, 26, tzinfo=UTC)
        with self.assertRaises(ValueError):
            proxima_execucao("weekly", time(9, 0), agora, dias_semana=[])
        with self.assertRaises(ValueError):
            proxima_execucao("monthly", time(9, 0), agora, dia_mes=32)
        with self.assertRaises(ValueError):
            proxima_execucao("once", time(9, 0), agora)
        with self.assertRaises(ValueError):
            proxima_execucao("daily", time(9, 0), datetime(2026, 10, 26))


if __name__ == "__main__":
    unittest.main()
