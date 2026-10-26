# Apollo: prazo das tarefas agendadas passa de "N dias" para quantidade + unidade
# (dias, semanas, meses, anos). O valor existente é preservado como dias.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0123_scheduledissue"),
    ]

    operations = [
        migrations.RenameField(
            model_name="scheduledissue",
            old_name="due_in_days",
            new_name="due_amount",
        ),
        migrations.AddField(
            model_name="scheduledissue",
            name="due_unit",
            field=models.CharField(
                choices=[("day", "Dias"), ("week", "Semanas"), ("month", "Meses"), ("year", "Anos")],
                default="day",
                max_length=10,
            ),
        ),
    ]
