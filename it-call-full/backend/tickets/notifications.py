

import json
import logging
import threading
import urllib.request

from django.conf import settings

log = logging.getLogger(__name__)


def _send_telegram(chat_id: str, text: str) -> None:
    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
    data = json.dumps({"chat_id": chat_id, "text": text}).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req, timeout=5).read()
    except Exception:  # уведомление не должно ломать создание заявки
        log.exception("Не удалось отправить Telegram-уведомление")


def notify_technician(ticket) -> None:
    tech = ticket.technician
    if not (settings.TELEGRAM_BOT_TOKEN and tech.telegram_chat_id):
        return
    text = f"🔔 Ауд. {ticket.room.number}: {ticket.category}\nОт: {ticket.teacher}"
    if ticket.text:
        text += f"\n{ticket.text}"
    threading.Thread(target=_send_telegram, args=(tech.telegram_chat_id, text), daemon=True).start()
