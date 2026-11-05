from datetime import datetime, timedelta, timezone as dt_timezone

from django.conf import settings
from django.db import transaction
from django.db.models import Prefetch, Q
from django.utils import timezone
from drf_spectacular.utils import OpenApiExample, OpenApiParameter, OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from .models import Room, Technician, Ticket
from .notifications import notify_technician
from .serializers import ErrorSerializer, RoomSerializer, TechnicianSerializer, TicketSerializer


class TicketCreateThrottle(AnonRateThrottle):
    scope = "ticket_create"


@extend_schema(
    tags=["Справочники"],
    summary="Типы неисправностей",
    description="Допустимые значения поля `category` при создании заявки.",
    responses={200: {"type": "array", "items": {"type": "string"}, "example": [c for c, _ in Ticket.Category.choices]}},
)
@api_view(["GET"])
def categories(request):
    return Response([c for c, _ in Ticket.Category.choices])


@extend_schema(tags=["Справочники"])
@extend_schema_view(
    list=extend_schema(summary="Список специалистов", description="Активные специалисты и номера закреплённых за ними аудиторий."),
    retrieve=extend_schema(summary="Специалист по id"),
)
class TechnicianViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TechnicianSerializer
    pagination_class = None

    def get_queryset(self):
        return Technician.objects.filter(is_active=True).prefetch_related("rooms")


@extend_schema(tags=["Аудитории"])
@extend_schema_view(
    list=extend_schema(
        summary="Список аудиторий со статусом",
        description="Статус вычисляется по активным заявкам: `new`, если есть новая; `taken`, если есть только принятые; иначе `ok`.",
        parameters=[
            OpenApiParameter("techId", int, description="Только аудитории этого специалиста"),
            OpenApiParameter("q", str, description="Поиск по номеру аудитории (подстрока, без учёта регистра)"),
            OpenApiParameter("faulty", bool, description="`1` — только аудитории с активными заявками"),
        ],
    ),
    retrieve=extend_schema(summary="Аудитория по номеру", description="Например, `/api/rooms/101/` или `/api/rooms/TS3/`."),
)
class RoomViewSet(viewsets.ReadOnlyModelViewSet):
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


@extend_schema(tags=["Заявки"])
@extend_schema_view(
    list=extend_schema(
        summary="Список заявок",
        description=(
            "По умолчанию возвращает активные заявки и решённые за последние "
            f"{settings.TICKETS_DONE_VISIBLE_HOURS} ч. Для опроса сервера передавайте `since`."
        ),
        parameters=[
            OpenApiParameter("techId", int, description="Только заявки этого специалиста"),
            OpenApiParameter("room", str, description="Только заявки по этой аудитории, например `101`"),
            OpenApiParameter("status", str, description="Статусы через запятую: `new`, `taken`, `done`"),
            OpenApiParameter("since", int, description="Unix-время в мс: только заявки, изменённые позже. Невалидное значение игнорируется"),
            OpenApiParameter("history", bool, description="`1` — вся история, а не только активные и недавно решённые"),
        ],
    ),
    create=extend_schema(
        summary="Создать заявку",
        description=(
            "Специалист назначается автоматически по аудитории. "
            "Если у него настроен Telegram, ему уйдёт уведомление. "
            "Лимит: 60 запросов в минуту с одного IP."
        ),
        examples=[
            OpenApiExample(
                "Проектор не включается",
                value={"teacher": "Мария Сергеевна", "room": "101", "category": "Проектор", "text": "Не включается"},
                request_only=True,
            )
        ],
        responses={
            201: TicketSerializer,
            400: OpenApiResponse(description="Ошибка валидации: пустое имя, нет такой аудитории или неверный тип неисправности"),
            429: OpenApiResponse(description="Слишком много заявок за короткое время"),
        },
    ),
    retrieve=extend_schema(summary="Заявка по id"),
    take=extend_schema(
        summary="Принять заявку",
        description="Переводит заявку `new → taken`.",
        request=None,
        responses={200: TicketSerializer, 404: ErrorSerializer, 409: OpenApiResponse(ErrorSerializer, description="Заявка уже не в статусе `new`")},
    ),
    done=extend_schema(
        summary="Отметить решённой",
        description="Переводит заявку `taken → done`.",
        request=None,
        responses={200: TicketSerializer, 404: ErrorSerializer, 409: OpenApiResponse(ErrorSerializer, description="Заявка не в статусе `taken`")},
    ),
)
class TicketViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
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
        self.get_object()  # 404, если заявки нет
        return self._move(pk, Ticket.Status.NEW, Ticket.Status.TAKEN, "taken_at")

    @action(detail=True, methods=["post"])
    def done(self, request, pk=None):
        self.get_object()
        return self._move(pk, Ticket.Status.TAKEN, Ticket.Status.DONE, "done_at")
