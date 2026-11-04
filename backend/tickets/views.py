from datetime import datetime, timedelta, timezone as dt_timezone

from django.conf import settings
from django.db import transaction
from django.db.models import Prefetch, Q
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action, api_view, throttle_classes
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from .models import Room, Technician, Ticket
from .notifications import notify_technician
from .serializers import RoomSerializer, TechnicianSerializer, TicketSerializer


class TicketCreateThrottle(AnonRateThrottle):
    scope = "ticket_create"


@api_view(["GET"])
def categories(request):
    return Response([c for c, _ in Ticket.Category.choices])


class TechnicianViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TechnicianSerializer
    pagination_class = None

    def get_queryset(self):
        return Technician.objects.filter(is_active=True).prefetch_related("rooms")


class RoomViewSet(viewsets.ReadOnlyModelViewSet):
    """GET /api/rooms/?techId=1&q=10&faulty=1"""

    serializer_class = RoomSerializer
    pagination_class = None
    lookup_field = "number"
    lookup_value_regex = "[^/]+"

    def get_queryset(self):
        qs = Room.objects.select_related("technician").prefetch_related(
            Prefetch(
                "tickets",
                queryset=Ticket.objects.exclude(status=Ticket.Status.DONE).order_by("-created_at", "-id"),
                to_attr="active_tickets",
            )
        )
        p = self.request.query_params
        if p.get("techId"):
            qs = qs.filter(technician_id=p["techId"])
        if p.get("q"):
            qs = qs.filter(number__icontains=p["q"].strip())
        if p.get("faulty") in ("1", "true"):
            qs = qs.filter(tickets__status__in=[Ticket.Status.NEW, Ticket.Status.TAKEN]).distinct()
        return qs


class TicketViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """
    GET  /api/tickets/            список заявок
        ?techId=1                 только заявки специалиста
        ?room=101                 только по аудитории
        ?status=new,taken         фильтр по статусам
        ?since=<ms>               только изменённые после момента (для опроса)
        ?history=1                вся история, а не только активные + недавние решённые
    POST /api/tickets/            создать заявку {teacher, room, category, text}
    POST /api/tickets/{id}/take/  принять   (new -> taken)
    POST /api/tickets/{id}/done/  решено    (taken -> done)
    """

    serializer_class = TicketSerializer
    pagination_class = None

    def get_queryset(self):
        qs = Ticket.objects.select_related("room", "technician")
        if self.action != "list":
            return qs
        p = self.request.query_params

        if p.get("techId"):
            qs = qs.filter(technician_id=p["techId"])
        if p.get("room"):
            qs = qs.filter(room__number=p["room"])
        if p.get("status"):
            qs = qs.filter(status__in=[s.strip() for s in p["status"].split(",")])

        if p.get("since"):
            try:
                since = datetime.fromtimestamp(int(p["since"]) / 1000, tz=dt_timezone.utc)
            except (ValueError, OverflowError, OSError):
                since = None
            if since:
                return qs.filter(updated_at__gt=since)

        if p.get("history") not in ("1", "true"):
            border = timezone.now() - timedelta(hours=settings.TICKETS_DONE_VISIBLE_HOURS)
            qs = qs.filter(~Q(status=Ticket.Status.DONE) | Q(done_at__gte=border))
        return qs

    def get_throttles(self):
        if self.action == "create":
            return [TicketCreateThrottle()]
        return super().get_throttles()

    def perform_create(self, serializer):
        ticket = serializer.save()
        transaction.on_commit(lambda: notify_technician(ticket))

    def _move(self, pk, expected, new_status, stamp_field):
        with transaction.atomic():
            ticket = Ticket.objects.select_for_update().select_related("room", "technician").get(pk=pk)
            if ticket.status != expected:
                return Response(
                    {"detail": f"Нельзя перевести заявку из статуса «{ticket.get_status_display()}»."},
                    status=status.HTTP_409_CONFLICT,
                )
            ticket.status = new_status
            setattr(ticket, stamp_field, timezone.now())
            ticket.save()
        return Response(self.get_serializer(ticket).data)

    @action(detail=True, methods=["post"])
    def take(self, request, pk=None):
        self.get_object()  
        return self._move(pk, Ticket.Status.NEW, Ticket.Status.TAKEN, "taken_at")

    @action(detail=True, methods=["post"])
    def done(self, request, pk=None):
        self.get_object()
        return self._move(pk, Ticket.Status.TAKEN, Ticket.Status.DONE, "done_at")
