from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import Room, Technician, Ticket


class TechnicianSerializer(serializers.ModelSerializer):
    rooms = serializers.SerializerMethodField()

    class Meta:
        model = Technician
        fields = ["id", "name", "rooms"]

    @extend_schema_field(serializers.ListField(child=serializers.CharField()))
    def get_rooms(self, obj):
        return [r.number for r in obj.rooms.all()]


class RoomSerializer(serializers.ModelSerializer):
    """Аудитория с вычисленным статусом: ok / new / taken."""

    room = serializers.CharField(source="number", help_text="Номер аудитории")
    techId = serializers.IntegerField(source="technician_id", help_text="Id закреплённого специалиста")
    techName = serializers.CharField(source="technician.name", help_text="Имя закреплённого специалиста")
    status = serializers.SerializerMethodField(help_text="ok — всё работает, new — есть новая заявка, taken — специалист идёт")
    category = serializers.SerializerMethodField(help_text="Тип неисправности самой свежей активной заявки (или пусто)")

    class Meta:
        model = Room
        fields = ["room", "techId", "techName", "status", "category"]

    def _active(self, obj):
        # active_tickets подгружается Prefetch'ем во view (новые первыми)
        return getattr(obj, "active_tickets", [])

    @extend_schema_field(serializers.ChoiceField(choices=["ok", "new", "taken"]))
    def get_status(self, obj):
        active = self._active(obj)
        if any(t.status == Ticket.Status.NEW for t in active):
            return "new"
        return "taken" if active else "ok"

    @extend_schema_field(serializers.CharField())
    def get_category(self, obj):
        active = self._active(obj)
        return active[0].category if active else ""


class TicketSerializer(serializers.ModelSerializer):
    """Формат совпадает с объектом заявки на фронте:
    { id, teacher, room, category, text, status, techId, at }"""

    room = serializers.SlugRelatedField(
        slug_field="number",
        queryset=Room.objects.select_related("technician"),
        error_messages={"does_not_exist": "Такой аудитории нет.", "invalid": "Некорректная аудитория."},
    )
    techId = serializers.IntegerField(source="technician_id", read_only=True, help_text="Id специалиста, назначенного автоматически")
    at = serializers.SerializerMethodField(help_text="Время создания, Unix-время в миллисекундах")
    teacher = serializers.CharField(max_length=100, help_text="Имя преподавателя")

    class Meta:
        model = Ticket
        fields = ["id", "teacher", "room", "category", "text", "status", "techId", "at"]
        read_only_fields = ["id", "status"]

    def get_at(self, obj) -> int:
        return int(obj.created_at.timestamp() * 1000)

    def validate_teacher(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Укажите имя.")
        return value

    def create(self, validated_data):
        room = validated_data["room"]
        return Ticket.objects.create(technician=room.technician, **validated_data)


class ErrorSerializer(serializers.Serializer):
    detail = serializers.CharField(help_text="Описание ошибки")
