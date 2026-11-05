import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent


def env_list(name, default=""):
    return [v.strip() for v in os.environ.get(name, default).split(",") if v.strip()]


DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "")
if not SECRET_KEY:
    if not DEBUG:
        raise ImproperlyConfigured("Задайте DJANGO_SECRET_KEY (при DJANGO_DEBUG=0 он обязателен).")
    SECRET_KEY = "dev-insecure-key-change-me"

ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")
# localhost нужен всегда: по нему Docker проверяет здоровье контейнера
if "*" not in ALLOWED_HOSTS:
    ALLOWED_HOSTS += [h for h in ("localhost", "127.0.0.1") if h not in ALLOWED_HOSTS]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "drf_spectacular",
    "drf_spectacular_sidecar",  # статика Swagger UI/ReDoc: работает без интернета
    "tickets",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": Path(os.environ.get("DJANGO_DB_PATH", BASE_DIR / "db.sqlite3")),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
]

LANGUAGE_CODE = "ru"
TIME_ZONE = os.environ.get("TZ", "Asia/Bishkek")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


if not DEBUG:
    MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")
    STORAGES = {
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
    }


if os.environ.get("DJANGO_CACHE_DIR"):
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.filebased.FileBasedCache",
            "LOCATION": os.environ["DJANGO_CACHE_DIR"],
        }
    }


CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS")


REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"]
    + (["rest_framework.renderers.BrowsableAPIRenderer"] if DEBUG else []),
    "DEFAULT_THROTTLE_RATES": {
     
        "ticket_create": "60/min",
    },
   
    "NUM_PROXIES": int(os.environ["NUM_PROXIES"]) if os.environ.get("NUM_PROXIES") else None,
}


SPECTACULAR_SETTINGS = {
    "TITLE": "IT Call API",
    "DESCRIPTION": (
        "API системы вызова айтишника в колледже.\n\n"
        "**Как это работает.** Преподаватель создаёт заявку на аудиторию — она автоматически "
        "уходит специалисту, за которым закреплена эта аудитория. Специалист принимает заявку "
        "и отмечает её решённой.\n\n"
        "**Статусы заявки:** `new` (вызов отправлен) → `taken` (специалист идёт) → `done` (решено). "
        "Переход, не соответствующий этой цепочке, возвращает `409`.\n\n"
        "**Обновление в реальном времени** сделано опросом: запрашивайте "
        "`GET /api/tickets/?since=<мс>` раз в несколько секунд.\n\n"
        "Авторизации в API пока нет."
    ),
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SCHEMA_PATH_PREFIX": "/api",
    "SWAGGER_UI_DIST": "SIDECAR",
    "SWAGGER_UI_FAVICON_HREF": "SIDECAR",
    "REDOC_DIST": "SIDECAR",
    "SWAGGER_UI_SETTINGS": {"displayRequestDuration": True, "persistAuthorization": True},
    "TAGS": [
        {"name": "Заявки", "description": "Создание заявок и смена их статуса"},
        {"name": "Аудитории", "description": "Аудитории и их текущее состояние"},
        {"name": "Справочники", "description": "Специалисты и типы неисправностей"},
    ],
}


TICKETS_DONE_VISIBLE_HOURS = int(os.environ.get("TICKETS_DONE_VISIBLE_HOURS", "24"))
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
