from django.core.management.base import BaseCommand

from tickets.models import Room, Technician


def seq(floor):
    return [f"{floor}0{n}" for n in range(1, 7)]


# Те же данные, что в массиве techs на фронте. Меняйте под себя (или правьте в админке).
TECHS = [
    ("Алишер", [*seq(1), *seq(3), *seq(5)]),
    ("Француз", [*seq(2), *seq(4), "TS2", "TS3", "TS4", "TS5", "TS6"]),
]


class Command(BaseCommand):
    help = "Создаёт специалистов и аудитории (идемпотентно)"

    def handle(self, *args, **options):
        for name, rooms in TECHS:
            tech, _ = Technician.objects.get_or_create(name=name)
            for number in rooms:
                Room.objects.get_or_create(number=number, defaults={"technician": tech})
        self.stdout.write(self.style.SUCCESS(
            f"Готово: специалистов {Technician.objects.count()}, аудиторий {Room.objects.count()}"
        ))
