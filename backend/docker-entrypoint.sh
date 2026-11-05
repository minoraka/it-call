#!/bin/sh
# Подготовка при каждом старте контейнера, затем запуск основной команды (gunicorn).
set -e

DATA_DIR="${DATA_DIR:-/data}"
mkdir -p "$DATA_DIR"
export DJANGO_DB_PATH="${DJANGO_DB_PATH:-$DATA_DIR/db.sqlite3}"

# Если секретный ключ не задан — генерируем один раз и храним в томе с данными
if [ -z "$DJANGO_SECRET_KEY" ]; then
  if [ ! -f "$DATA_DIR/secret_key" ]; then
    python -c "import secrets; print(secrets.token_urlsafe(50))" > "$DATA_DIR/secret_key"
    chmod 600 "$DATA_DIR/secret_key"
  fi
  DJANGO_SECRET_KEY="$(cat "$DATA_DIR/secret_key")"
  export DJANGO_SECRET_KEY
fi

python manage.py migrate --noinput
python manage.py seed_data --if-empty      # специалисты и аудитории — только на пустой базе
python manage.py collectstatic --noinput -v0

# Администратор создаётся, если заданы ADMIN_USER и ADMIN_PASSWORD (при повторных запусках не трогаем)
if [ -n "$DJANGO_SUPERUSER_USERNAME" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
  python manage.py shell -v0 -c "
import os
from django.contrib.auth import get_user_model
User = get_user_model()
name, pwd = os.environ['DJANGO_SUPERUSER_USERNAME'], os.environ['DJANGO_SUPERUSER_PASSWORD']
if User.objects.filter(username=name).exists():
    print('Администратор ' + name + ' уже существует')
else:
    User.objects.create_superuser(name, '', pwd)
    print('Создан администратор: ' + name)
"
fi

exec "$@"
