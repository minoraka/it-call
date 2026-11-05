@echo off
chcp 65001 >nul
REM Windows: двойной клик по start.bat — ставит зависимости и запускает бэкенд + фронт
cd /d "%~dp0backend"
if not exist .venv python -m venv .venv
call .venv\Scripts\activate
pip install -q -r requirements.txt
python manage.py migrate -v0
python manage.py seed_data
start "it-call backend" cmd /k ".venv\Scripts\python manage.py runserver 8000"

cd /d "%~dp0it-call"
if not exist node_modules call npm install
start "it-call frontend" cmd /k "npm run dev -- --open"
echo.
echo Откроется http://localhost:5173  (два чёрных окна не закрывайте)
pause
