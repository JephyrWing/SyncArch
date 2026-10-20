import os
import secrets
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy.engine import URL


def load_config():
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    app_env = os.getenv("APP_ENV", "development")
    if app_env not in {"development", "demo"}:
        raise ValueError("APP_ENV must be development or demo")
    if app_env == "demo" and os.getenv("FLASK_DEBUG", "0").lower() not in {"", "0", "false", "no"}:
        raise ValueError("demo requires FLASK_DEBUG=0")
    secret_key = os.getenv("SECRET_KEY", "")
    trusted_hosts = [host.strip() for host in os.getenv(
        "TRUSTED_HOSTS", "localhost,127.0.0.1,[::1]" if app_env == "development" else ""
    ).split(",") if host.strip()]
    if app_env == "demo" and (len(secret_key) < 32 or not trusted_hosts):
        raise ValueError("demo requires SECRET_KEY (at least 32 characters) and TRUSTED_HOSTS")
    if app_env == "demo" and not os.getenv("DATABASE_URL") and not os.getenv("DB_PASSWORD"):
        raise ValueError("demo requires DATABASE_URL or DB_PASSWORD")
    database_url = os.getenv("DATABASE_URL") or URL.create(
        "mysql+pymysql",
        username=os.getenv("DB_USER", "syncarch"),
        password=os.getenv("DB_PASSWORD", "syncarch_dev_password"),
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=int(os.getenv("DB_PORT", "3306")),
        database=os.getenv("DB_NAME", "syncarch"),
        query={"charset": "utf8mb4"},
    )
    engine_options = {"pool_pre_ping": True, "pool_recycle": 1800}
    if str(database_url).startswith(("mysql", "mariadb")):
        engine_options["connect_args"] = {"connect_timeout": 5}
    return {
        "APP_ENV": app_env,
        "FRONTEND_DIST": Path(__file__).resolve().parents[2] / "frontend" / "dist",
        "DEBUG": False,
        "SECRET_KEY": secret_key or secrets.token_hex(32),
        "TRUSTED_HOSTS": trusted_hosts,
        "SESSION_COOKIE_HTTPONLY": True,
        "SESSION_COOKIE_SAMESITE": "Lax",
        "SESSION_COOKIE_SECURE": app_env == "demo",
        "PERMANENT_SESSION_LIFETIME": timedelta(hours=8),
        "SQLALCHEMY_DATABASE_URI": database_url,
        "SQLALCHEMY_TRACK_MODIFICATIONS": False,
        "SQLALCHEMY_ENGINE_OPTIONS": engine_options,
        "MAX_CONTENT_LENGTH": 10 * 1024 * 1024,
        "JSON_SORT_KEYS": False,
    }
