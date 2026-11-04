from rest_framework import serializers

from .models import Room, Technician, Ticket


class TechnicianSerializer(serializers.ModelSerializer):
    rooms = serializers.SerializerMethodField()

    class Meta:
        model = Technician
        fields = ["id", "name", "rooms"]

    def get_rooms(self, obj):
        return [r.number for r in obj.rooms.all()]


class RoomSerializer(serializers.ModelSerializer):
   

    room = serializers.CharField(source="number")
    techId = serializers.IntegerField(source="technician_id")
    techName = serializers.CharField(source="technician.name")
    status = serializers.SerializerMethodField()
    category = serializers.SerializerMethodField()

    class Meta:
        model = Room
        fields = ["room", "techId", "techName", "status", "category"]

    def _active(self, obj):
       
        return getattr(obj, "active_tickets", [])

    def get_status(self, obj):
        active = self._active(obj)
        if any(t.status == Ticket.Status.NEW for t in active):
            return "new"
        return "taken" if active else "ok"

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
    techId = serializers.IntegerField(source="technician_id", read_only=True)
    at = serializers.SerializerMethodField()
    teacher = serializers.CharField(max_length=100)

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
