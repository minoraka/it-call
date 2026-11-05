# it-call — вызов айтишника

React (Vite) + Django REST Framework. 

| Что | Адрес (Docker) | Адрес (без Docker) |
|---|---|---|
| Сайт | http://localhost:8080 | http://localhost:5173 |
| **Swagger (документация API)** | http://localhost:8080/api/docs/ | http://localhost:8000/api/docs/ |
| Админка | http://localhost:8080/admin/ | http://localhost:8000/admin/ |

## Запуск в Docker (рекомендуется)


```bash
cp .env.example .env          # Windows (PowerShell): copy .env.example .env
#поменяйте ADMIN_PASSWORD на свой
docker compose up -d --build
```



Полезные команды:

```bash
docker compose logs -f              # логи
docker compose ps                   # состояние
docker compose restart              # перезапуск
docker compose down                 # остановить (данные сохраняются)
docker compose down -v              # остановить и УДАЛИТЬ базу данных
docker compose up -d --build        # обновить после изменения кода
```

Как это устроено: контейнер `web` (nginx) отдаёт собранный сайт и проксирует `/api`, `/admin`, `/static`
на контейнер `backend` (Django + gunicorn). База SQLite лежит в томе `db_data`, поэтому заявки не пропадают
при перезапусках и пересборке. Секретный ключ Django генерируется сам и хранится там же.

Доступ с телефона или другого компьютера: откройте `http://<IP-компьютера>:8080`
(IP узнайте командой `ipconfig` / `ip a`). Если в `.env` вы ограничили `DJANGO_ALLOWED_HOSTS`, добавьте туда этот IP.

## Запуск без Docker (для разработки)

Нужны **Python 3.10+** и **Node.js 18+**.

- Windows: двойной клик по `start.bat`
- Linux / macOS: `./start.sh`

Или вручную в двух терминалах:

```bash
# терминал 1
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate && python manage.py seed_data
python manage.py createsuperuser                      # для /admin/
python manage.py runserver

# терминал 2
cd it-call
npm install && npm run dev
```

> В Windows команда `python` может открывать Microsoft Store. Тогда используйте `py` вместо `python` только при создании окружения: `py -m venv .venv`.

## Что где

- `backend/` — Django: модели, API, Swagger, админка, тесты (`python manage.py test`). Подробности — `backend/README.md`.
- `it-call/` — фронт (React). Запросы к серверу — `src/api.js`, тексты — `src/i18n.js`, обновление раз в 5 с (`POLL_MS` в `src/App.jsx`).
- `docker-compose.yml`, `backend/Dockerfile`, `it-call/Dockerfile`, `it-call/nginx.conf` — Docker.
- Уведомления в Telegram — по желанию, см. `backend/README.md`.

## Важно

API открытый (как и сам фронт, без входа): любой, кто знает адрес, может принять или закрыть заявку.
Для публикации в интернет добавьте авторизацию специалистов, HTTPS (например, через Caddy/Traefik или
nginx с сертификатом) и ограничьте `DJANGO_ALLOWED_HOSTS` своим доменом.


=====================================================================
  IT-CALL — ШПАРГАЛКА: КОМАНДЫ И ЭНДПОИНТЫ
=====================================================================

Проект: React (Vite) + Django REST Framework.
Папки:  backend/  — сервер,   it-call/  — сайт (фронт)

Путь к проекту на вашем компьютере (пример):
C:\Users\polop\OneDrive\Рабочий стол\sharaga\It-call-full\it-call-full\it-call-full


---------------------------------------------------------------------
  1. ВСЕ АДРЕСА
---------------------------------------------------------------------

                          Docker                      Без Docker
  Сайт                    http://localhost:8080       http://localhost:5173
  Swagger (документация)  http://localhost:8080/api/docs/    http://localhost:8000/api/docs/
  ReDoc                   http://localhost:8080/api/redoc/   http://localhost:8000/api/redoc/
  Схема OpenAPI           http://localhost:8080/api/schema/  http://localhost:8000/api/schema/
  Админка                 http://localhost:8080/admin/       http://localhost:8000/admin/
  API                     http://localhost:8080/api/         http://localhost:8000/api/


---------------------------------------------------------------------
  2. ЗАПУСК БЕЗ DOCKER
---------------------------------------------------------------------

Нужно: Python 3.10+ и Node.js 18+.

--- Самый простой способ ---
  Windows:        двойной клик по start.bat
  Linux / macOS:  ./start.sh

--- Вручную, Windows (cmd или PowerShell) ---

ТЕРМИНАЛ 1 (бэкенд):
  cd backend
  py -m venv .venv
  .venv\Scripts\activate
  pip install -r requirements.txt
  python manage.py migrate
  python manage.py seed_data
  python manage.py runserver

ТЕРМИНАЛ 2 (фронт):
  cd it-call
  npm install
  npm run dev

Потом открыть: http://localhost:5173

ВАЖНО для Windows:
  * Если "python" пишет просто "Python" и ничего не делает — это заглушка
    Microsoft Store. Используйте "py" ТОЛЬКО в команде создания окружения
    (py -m venv .venv). Внутри окружения (после activate) python работает.
  * Если PowerShell ругается на activate, один раз выполните:
      Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
    или запускайте всё из cmd.

--- Вручную, Linux / macOS ---

ТЕРМИНАЛ 1:
  cd backend
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -r requirements.txt
  python manage.py migrate
  python manage.py seed_data
  python manage.py runserver

ТЕРМИНАЛ 2:
  cd it-call
  npm install
  npm run dev

--- Повторный запуск (когда всё уже установлено) ---
  Терминал 1:  cd backend  ->  .venv\Scripts\activate  ->  python manage.py runserver
  Терминал 2:  cd it-call  ->  npm run dev
  (migrate и seed_data повторять не нужно)

--- После обновления проекта (новые зависимости) ---
  cd backend
  .venv\Scripts\activate
  pip install -r requirements.txt
  python manage.py migrate


---------------------------------------------------------------------
  3. ЗАПУСК В DOCKER
---------------------------------------------------------------------

Нужен Docker Desktop (Windows/macOS) или Docker Engine (Linux).
Команды выполнять в КОРНЕ проекта (там, где лежит docker-compose.yml).

Первый запуск:
  copy .env.example .env          (Linux/macOS: cp .env.example .env)
  -> откройте .env и поменяйте ADMIN_PASSWORD на свой пароль
  docker compose up -d --build

Потом открыть: http://localhost:8080

Ежедневные команды:
  docker compose ps                состояние контейнеров
  docker compose logs -f           логи (выход: Ctrl+C)
  docker compose logs -f backend   логи только сервера
  docker compose restart           перезапуск
  docker compose stop              остановить (данные сохраняются)
  docker compose start             запустить снова
  docker compose down              остановить и убрать контейнеры (данные сохраняются)
  docker compose down -v           остановить и УДАЛИТЬ БАЗУ ДАННЫХ (осторожно!)
  docker compose up -d --build     пересобрать после изменений в коде

Зайти внутрь контейнера / выполнить команду Django:
  docker compose exec backend python manage.py createsuperuser
  docker compose exec backend python manage.py shell
  docker compose exec backend sh

Резервная копия базы:
  docker compose cp backend:/data/db.sqlite3 ./backup-db.sqlite3

Если сайт не открывается:
  docker compose ps                (backend должен быть "healthy")
  docker compose logs backend      (смотрите ошибку в конце)

Доступ с телефона / другого компьютера:
  http://<IP-компьютера>:8080     (IP: команда ipconfig или ip a)
  Если в .env вы ограничили DJANGO_ALLOWED_HOSTS — добавьте туда этот IP.


---------------------------------------------------------------------
  4. АДМИНКА
---------------------------------------------------------------------

Создать администратора (без Docker):
  cd backend
  .venv\Scripts\activate
  python manage.py createsuperuser

В Docker администратор создаётся сам из .env (ADMIN_USER / ADMIN_PASSWORD).
Если не задали — команда: docker compose exec backend python manage.py createsuperuser

В админке можно: менять специалистов, закреплять аудитории за специалистами,
добавлять аудитории, смотреть и править заявки, задавать Telegram chat id.


---------------------------------------------------------------------
  5. ТЕСТЫ И ПРОВЕРКИ
---------------------------------------------------------------------

Тесты бэкенда:
  cd backend
  python manage.py test

Проверка схемы Swagger:
  python manage.py spectacular --validate --fail-on-warn

Проверка кода фронта и сборка:
  cd it-call
  npx oxlint
  npm run build


---------------------------------------------------------------------
  6. ЗАЛИТЬ В GIT (поверх старого репозитория)
---------------------------------------------------------------------

Выполнять в папке проекта (где backend, it-call, docker-compose.yml):

  git init
  git branch -M main
  git remote add origin https://github.com/minoraka/it-call.git
  git fetch origin
  git reset --soft origin/main
  git status                       (проверьте список изменений)
  git add .
  git commit -m "Add Docker and Swagger"
  git push origin main

Если репозиторий уже подключён (повторные пуши):
  git add .
  git commit -m "Описание изменений"
  git push origin main

Если Git просит представиться:
  git config --global user.name "Ваше имя"
  git config --global user.email "почта@от.github"

При первом push в браузере откроется окно входа в GitHub. Если просит пароль
в терминале — нужен Personal Access Token (GitHub -> Settings -> Developer
settings -> Tokens), а не пароль от аккаунта.

В гит НЕ попадают (закрыто через .gitignore): .env, .venv, node_modules,
db.sqlite3, __pycache__, dist.


---------------------------------------------------------------------
  7. ЭНДПОИНТЫ API
---------------------------------------------------------------------

Базовый адрес: http://localhost:8000/api   (в Docker: http://localhost:8080/api)
Формат: JSON. Авторизации пока нет.

СТАТУСЫ ЗАЯВКИ:   new  ->  taken  ->  done
                  (вызов отправлен) (специалист идёт) (решено)
СТАТУС АУДИТОРИИ: ok (всё работает) | new (есть новая заявка) | taken (специалист идёт)

ТИПЫ НЕИСПРАВНОСТЕЙ (поле category, значения строго такие):
  Проектор, Компьютер, Интернет, Звук, Интерактивная доска, Другое

---- СПРАВОЧНИКИ ----

GET  /api/categories/
     Список типов неисправностей.
     Ответ: ["Проектор","Компьютер","Интернет","Звук","Интерактивная доска","Другое"]

GET  /api/technicians/
     Активные специалисты и их аудитории.
     Ответ: [{"id":1,"name":"Алишер","rooms":["101","102", ...]}, ...]

GET  /api/technicians/{id}/
     Один специалист.

---- АУДИТОРИИ ----

GET  /api/rooms/
     Все аудитории со статусом.
     Параметры (необязательные):
       techId=1     только аудитории этого специалиста
       q=10         поиск по номеру (подстрока)
       faulty=1     только с активными заявками
     Ответ: [{"room":"101","techId":1,"techName":"Алишер",
              "status":"ok","category":""}, ...]

GET  /api/rooms/{номер}/
     Одна аудитория, например /api/rooms/101/ или /api/rooms/TS3/

---- ЗАЯВКИ ----

GET  /api/tickets/
     Список заявок (по умолчанию: активные + решённые за последние 24 часа).
     Параметры (необязательные):
       techId=1        заявки специалиста
       room=101        заявки по аудитории
       status=new,taken  фильтр по статусам (через запятую)
       since=<мс>      только изменённые после момента (Unix-время в МИЛЛИсекундах)
                       — для обновления раз в несколько секунд
       history=1       вся история, а не только свежее
     Ответ: [{"id":1,"teacher":"Мария","room":"101","category":"Проектор",
              "text":"не включается","status":"new","techId":1,
              "at":1793790269314}, ...]
     at — время создания в миллисекундах.

POST /api/tickets/
     Создать заявку. Специалист назначается автоматически по аудитории.
     Тело:  {"teacher":"Мария Сергеевна","room":"101",
             "category":"Проектор","text":"не включается"}
     (text необязателен)
     Ответы: 201 — создана, 400 — ошибка данных, 429 — слишком много заявок
     Лимит: 60 заявок в минуту с одного IP.

GET  /api/tickets/{id}/
     Одна заявка.

POST /api/tickets/{id}/take/
     "Принять": new -> taken.   Тело не нужно.
     Ответы: 200, 404 (нет такой заявки), 409 (статус уже не new)

POST /api/tickets/{id}/done/
     "Решено": taken -> done.   Тело не нужно.
     Ответы: 200, 404, 409 (статус не taken)

---- КОДЫ ОТВЕТОВ ----
  200 / 201   успех
  400         ошибка данных (пустое имя, нет такой аудитории, неверный тип)
  404         не найдено
  409         недопустимая смена статуса
  429         слишком много запросов


---------------------------------------------------------------------
  8. ПРИМЕРЫ ЗАПРОСОВ
---------------------------------------------------------------------

--- Linux / macOS / Git Bash (curl) ---

  curl http://localhost:8000/api/rooms/
  curl "http://localhost:8000/api/tickets/?techId=1&status=new"

  curl -X POST http://localhost:8000/api/tickets/ \
    -H "Content-Type: application/json" \
    -d '{"teacher":"Мария","room":"101","category":"Проектор","text":"не включается"}'

  curl -X POST http://localhost:8000/api/tickets/1/take/
  curl -X POST http://localhost:8000/api/tickets/1/done/

--- Windows PowerShell ---
(в PowerShell "curl" — это другая команда, поэтому используйте Invoke-RestMethod)

  Invoke-RestMethod http://localhost:8000/api/rooms/
  Invoke-RestMethod "http://localhost:8000/api/tickets/?techId=1&status=new"

  $body = '{"teacher":"Мария","room":"101","category":"Проектор","text":"не включается"}'
  Invoke-RestMethod -Uri http://localhost:8000/api/tickets/ -Method Post `
    -ContentType "application/json" `
    -Body ([System.Text.Encoding]::UTF8.GetBytes($body))

  Invoke-RestMethod -Uri http://localhost:8000/api/tickets/1/take/ -Method Post
  Invoke-RestMethod -Uri http://localhost:8000/api/tickets/1/done/ -Method Post

Проще всего пробовать запросы в Swagger: http://localhost:8000/api/docs/
(выберите эндпоинт -> Try it out -> Execute).


---------------------------------------------------------------------
  9. НАСТРОЙКИ (ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ)
---------------------------------------------------------------------

Для Docker — в файле .env в корне проекта:
  WEB_PORT=8080                  порт сайта на вашем компьютере
  ADMIN_USER=admin               логин администратора (создаётся при 1-м запуске)
  ADMIN_PASSWORD=...             пароль администратора
  DJANGO_SECRET_KEY=             пусто = сгенерируется сам
  DJANGO_ALLOWED_HOSTS=*         через запятую; для интернета — укажите свой домен/IP
  CSRF_TRUSTED_ORIGINS=          для админки по домену с https, напр. https://it.example.com
  TELEGRAM_BOT_TOKEN=            уведомления в Telegram (необязательно)
  TZ=Asia/Bishkek                часовой пояс

Для запуска без Docker (бэкенд читает из окружения):
  DJANGO_DEBUG=1                 1 — разработка, 0 — продакшен (тогда обязателен ключ)
  DJANGO_SECRET_KEY=...          секретный ключ
  DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
  CORS_ALLOWED_ORIGINS=http://localhost:5173
  DJANGO_DB_PATH=...             путь к файлу базы SQLite (по умолчанию backend/db.sqlite3)
  TICKETS_DONE_VISIBLE_HOURS=24  сколько часов решённые заявки видны в очереди
  TELEGRAM_BOT_TOKEN=...         токен бота; chat id задаётся специалисту в админке

Где менять в коде:
  Интервал обновления сайта     it-call/src/App.jsx    константа POLL_MS (мс)
  Тексты и языки                it-call/src/i18n.js
  Специалисты и аудитории       админка /admin/ (стартовые данные — backend/tickets/management/commands/seed_data.py)


---------------------------------------------------------------------
  10. ЧАСТЫЕ ПРОБЛЕМЫ
---------------------------------------------------------------------

"cd backend: путь не существует"
   Архив распаковался с лишней вложенной папкой. Выполните dir, зайдите
   глубже (cd it-call-full), пока не увидите backend, it-call, start.bat.

start.bat пишет "Python The system cannot find the path specified"
   Не распакован архив (открыт прямо из zip) ИЛИ python — заглушка Store.
   Распакуйте архив ("Извлечь всё...") и в start.bat замените в строке
   "if not exist .venv python -m venv .venv" слово python на py.

Белый экран / "Не удалось подключиться к серверу"
   Не запущен бэкенд (runserver) или порт 8000 занят.

Пустой список аудиторий
   Не выполнена команда python manage.py seed_data.

Изменения на сайте не видны
   Нажмите Ctrl+F5.

Docker: порт 8080 занят
   Поменяйте WEB_PORT в .env (например, 8081) и выполните docker compose up -d

Docker: забыли пароль администратора
   docker compose exec backend python manage.py changepassword admin

Сбросить ВСЕ данные (заявки и настройки) и начать с нуля
   Без Docker: удалите backend/db.sqlite3, затем migrate и seed_data.
   Docker:     docker compose down -v  и  docker compose up -d --build

=====================================================================
