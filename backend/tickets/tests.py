from datetime import timedelta

from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import Room, Technician, Ticket


@override_settings(REST_FRAMEWORK={
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "DEFAULT_THROTTLE_RATES": {"ticket_create": "1000/min"},
})
class TicketApiTests(APITestCase):
    def setUp(self):
        self.t1 = Technician.objects.create(name="Алишер")
        self.t2 = Technician.objects.create(name="Француз")
        self.r101 = Room.objects.create(number="101", technician=self.t1)
        self.r201 = Room.objects.create(number="201", technician=self.t2)
        Room.objects.create(number="TS2", technician=self.t2)

    def create(self, **kw):
        data = {"teacher": "Мария", "room": "101", "category": "Проектор", "text": "не включается"}
        data.update(kw)
        return self.client.post("/api/tickets/", data, format="json")

    def test_create_assigns_technician_and_matches_front_shape(self):
        r = self.create()
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["techId"], self.t1.id)
        self.assertEqual(r.data["status"], "new")
        self.assertEqual(r.data["room"], "101")
        self.assertIsInstance(r.data["at"], int)

    def test_validation(self):
        self.assertEqual(self.create(teacher="   ").status_code, 400)
        self.assertEqual(self.create(room="999").status_code, 400)
        self.assertEqual(self.create(category="Кофемашина").status_code, 400)

    def test_status_flow_and_conflicts(self):
        tid = self.create().data["id"]
        self.assertEqual(self.client.post(f"/api/tickets/{tid}/done/").status_code, 409)
        self.assertEqual(self.client.post(f"/api/tickets/{tid}/take/").data["status"], "taken")
        self.assertEqual(self.client.post(f"/api/tickets/{tid}/take/").status_code, 409)
        self.assertEqual(self.client.post(f"/api/tickets/{tid}/done/").data["status"], "done")
        self.assertEqual(self.client.post("/api/tickets/9999/take/").status_code, 404)

    def test_room_status(self):
        def status_of(num):
            rooms = self.client.get("/api/rooms/").data
            return next(r for r in rooms if r["room"] == num)

        self.assertEqual(status_of("101")["status"], "ok")
        tid = self.create().data["id"]
        self.assertEqual(status_of("101")["status"], "new")
        self.assertEqual(status_of("101")["category"], "Проектор")
        self.client.post(f"/api/tickets/{tid}/take/")
        self.assertEqual(status_of("101")["status"], "taken")
        self.client.post(f"/api/tickets/{tid}/done/")
        self.assertEqual(status_of("101")["status"], "ok")

    def test_room_filters(self):
        self.create()
        self.assertEqual(len(self.client.get("/api/rooms/?techId=2").data), 2)
        self.assertEqual(len(self.client.get("/api/rooms/?q=ts").data), 1)
        faulty = self.client.get("/api/rooms/?faulty=1").data
        self.assertEqual([r["room"] for r in faulty], ["101"])

    def test_ticket_filters_and_done_window(self):
        a = self.create().data["id"]
        self.create(room="201")
        self.assertEqual(len(self.client.get(f"/api/tickets/?techId={self.t1.id}").data), 1)
        self.assertEqual(len(self.client.get("/api/tickets/?status=taken").data), 0)

        self.client.post(f"/api/tickets/{a}/take/")
        self.client.post(f"/api/tickets/{a}/done/")
        self.assertEqual(len(self.client.get("/api/tickets/").data), 2)  # свежая решённая ещё видна
        Ticket.objects.filter(pk=a).update(done_at=timezone.now() - timedelta(days=3))
        self.assertEqual(len(self.client.get("/api/tickets/").data), 1)
        self.assertEqual(len(self.client.get("/api/tickets/?history=1").data), 2)

    def test_since_polling(self):
        self.create()
        future = int((timezone.now() + timedelta(seconds=5)).timestamp() * 1000)
        self.assertEqual(self.client.get(f"/api/tickets/?since={future}").data, [])
        self.assertEqual(len(self.client.get("/api/tickets/?since=0").data), 1)
        self.assertEqual(len(self.client.get("/api/tickets/?since=abc").data), 1)  # мусор игнорируется

    def test_technicians_and_categories(self):
        data = self.client.get("/api/technicians/").data
        self.assertEqual(data[0], {"id": self.t1.id, "name": "Алишер", "rooms": ["101"]})
        self.assertIn("Проектор", self.client.get("/api/categories/").data)
