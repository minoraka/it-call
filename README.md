# it-call — вызов айтишника

React (Vite) + Django REST Framework.

## Запуск одной командой

Нужны: **Python 3.10+** и **Node.js 18+**.

- Windows: двойной клик по `start.bat`
- Linux / macOS: `./start.sh`

Скрипт сам создаст виртуальное окружение, поставит зависимости, применит миграции,
создаст специалистов и аудитории и запустит оба сервера.
Сайт: **http://localhost:5173**  ·  API: http://localhost:8000/api/  ·  Админка: http://localhost:8000/admin/

Чтобы войти в админку (менять специалистов, аудитории, заявки):

```bash
cd backend && .venv/bin/python manage.py createsuperuser   # Windows: .venv\Scripts\python
```

## Ручной запуск

```bash
# терминал 1
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate && python manage.py seed_data
python manage.py runserver

# терминал 2
cd it-call
npm install && npm run dev
```

## Доступ с других устройств (телефон специалиста)

1. Узнайте IP компьютера, например `192.168.1.50`.
2. Задайте переменные окружения перед запуском бэкенда:
   `DJANGO_ALLOWED_HOSTS=192.168.1.50,localhost`
3. Откройте на телефоне `http://192.168.1.50:5173` (в `start.sh` фронт уже слушает сеть;
   в Windows добавьте `-- --host` к `npm run dev` в `start.bat`).

## Что где

- `backend/` — Django: модели `Technician`, `Room`, `Ticket`, API, админка, тесты (`python manage.py test`).
  Подробности API — в `backend/README.md`.
- `it-call/` — фронт. Запросы к серверу — в `src/api.js`, обновление раз в 5 с (`POLL_MS` в `src/App.jsx`).
- Уведомления в Telegram — по желанию, см. `backend/README.md`.

## Важно

API открытый (как и сам фронт, без входа). Для публикации в интернет добавьте авторизацию специалистов
и используйте gunicorn + nginx вместо dev-серверов.
