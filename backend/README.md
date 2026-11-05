# it-call — backend (Django REST Framework)

## Запуск

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_data          # специалисты и аудитории как на фронте
python manage.py createsuperuser    # для админки /admin/
python manage.py runserver          # http://127.0.0.1:8000
python manage.py test               # тесты
```

Специалистов, аудитории и закрепления можно менять в админке `/admin/`.

## API

| Метод | URL | Что делает |
|---|---|---|
| GET | `/api/technicians/` | специалисты с их аудиториями |
| GET | `/api/categories/` | типы неисправностей |
| GET | `/api/rooms/` | аудитории со статусом `ok/new/taken` и категорией активной заявки. Фильтры: `?techId=1&q=10&faulty=1` |
| GET | `/api/tickets/` | заявки. Фильтры: `techId`, `room`, `status=new,taken`, `since=<мс>`, `history=1` |
| POST | `/api/tickets/` | создать: `{teacher, room, category, text}` |
| POST | `/api/tickets/{id}/take/` | «Принять» (`new → taken`) |
| POST | `/api/tickets/{id}/done/` | «Решено» (`taken → done`) |

Заявка отдаётся в том же формате, что на фронте: `{id, teacher, room, category, text, status, techId, at}` (`at` — миллисекунды).
Неверный переход статуса возвращает `409`, ошибки валидации — `400`.

По умолчанию `/api/tickets/` отдаёт активные заявки и решённые за последние 24 часа
(`TICKETS_DONE_VISIBLE_HOURS`); вся история — `?history=1`.

## Фронт

Уже подключён: см. `../it-call/src/api.js` и `../it-call/src/App.jsx`.

## Уведомления в Telegram (необязательно)

Задайте `TELEGRAM_BOT_TOKEN`, а специалисту в админке — `Telegram chat id`.
Новая заявка тогда придёт ему в мессенджер (`tickets/notifications.py`).

## Важно

Пока API открытый — как и сам фронт, где нет входа. Любой, кто знает адрес, может принять/закрыть заявку.
Для продакшена стоит добавить вход для специалистов (DRF TokenAuth/JWT) и закрыть `take`/`done`.
