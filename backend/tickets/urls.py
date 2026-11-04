from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("technicians", views.TechnicianViewSet, basename="technician")
router.register("rooms", views.RoomViewSet, basename="room")
router.register("tickets", views.TicketViewSet, basename="ticket")

urlpatterns = [
    path("categories/", views.categories),
    path("", include(router.urls)),
]
