from django.db import models


class Technician(models.Model):
    name = models.CharField("Имя", max_length=100)
    telegram_chat_id = models.CharField(
        "Telegram chat id", max_length=32, blank=True,
        help_text="Для уведомлений о новых заявках (необязательно)",
    )
    is_active = models.BooleanField("Активен", default=True)

    class Meta:
        verbose_name = "Специалист"
        verbose_name_plural = "Специалисты"
        ordering = ["id"]

    def __str__(self):
        return self.name


class Room(models.Model):
    number = models.CharField("Номер", max_length=20, unique=True)
    technician = models.ForeignKey(
        Technician, on_delete=models.PROTECT, related_name="rooms", verbose_name="Специалист",
    )

    class Meta:
        verbose_name = "Аудитория"
        verbose_name_plural = "Аудитории"
        ordering = ["technician_id", "number"]

    def __str__(self):
        return self.number


class Ticket(models.Model):
    class Category(models.TextChoices):
        PROJECTOR = "Проектор", "Проектор"
        COMPUTER = "Компьютер", "Компьютер"
        INTERNET = "Интернет", "Интернет"
        SOUND = "Звук", "Звук"
        BOARD = "Интерактивная доска", "Интерактивная доска"
        OTHER = "Другое", "Другое"

    class Status(models.TextChoices):
        NEW = "new", "Вызов отправлен"
        TAKEN = "taken", "Специалист идёт"
        DONE = "done", "Решено"

    teacher = models.CharField("Преподаватель", max_length=100)
    room = models.ForeignKey(Room, on_delete=models.PROTECT, related_name="tickets", verbose_name="Аудитория")
  
    technician = models.ForeignKey(
        Technician, on_delete=models.PROTECT, related_name="tickets", verbose_name="Специалист",
    )
    category = models.CharField("Тип неисправности", max_length=40, choices=Category.choices)
    text = models.TextField("Описание", blank=True, max_length=1000)
    status = models.CharField("Статус", max_length=10, choices=Status.choices, default=Status.NEW)

    created_at = models.DateTimeField("Создана", auto_now_add=True)
    updated_at = models.DateTimeField("Обновлена", auto_now=True)
    taken_at = models.DateTimeField("Принята", null=True, blank=True)
    done_at = models.DateTimeField("Решена", null=True, blank=True)

    class Meta:
        verbose_name = "Заявка"
        verbose_name_plural = "Заявки"
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["technician", "status"]),
            models.Index(fields=["updated_at"]),
        ]

    def __str__(self):
        return f"#{self.room_id} {self.category} ({self.status})"
