from django.contrib import admin

from .models import Room, Technician, Ticket


class RoomInline(admin.TabularInline):
    model = Room
    extra = 0


@admin.register(Technician)
class TechnicianAdmin(admin.ModelAdmin):
    list_display = ["name", "telegram_chat_id", "is_active"]
    inlines = [RoomInline]


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ["number", "technician"]
    list_filter = ["technician"]
    search_fields = ["number"]


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ["id", "room", "category", "teacher", "technician", "status", "created_at"]
    list_filter = ["status", "technician", "category"]
    search_fields = ["room__number", "teacher", "text"]
    date_hierarchy = "created_at"
