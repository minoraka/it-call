#!/usr/bin/env bash
# Linux / macOS: ./start.sh  — ставит зависимости и запускает бэкенд + фронт
set -e
cd "$(dirname "$0")"

cd backend
[ -d .venv ] || python3 -m venv .venv
. .venv/bin/activate
pip install -q -r requirements.txt
python manage.py migrate -v0
python manage.py seed_data
python manage.py runserver 8000 &
BACK=$!
trap 'kill $BACK 2>/dev/null' EXIT

cd ../it-call
[ -d node_modules ] || npm install
echo "=== Откройте http://localhost:5173 ==="
npm run dev -- --host
