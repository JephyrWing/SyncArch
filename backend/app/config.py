import os
import secrets
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import load_dotenv
from sqlalchemy.engine import URL
from .social_config import external_config


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
    jwt_key = os.getenv("JWT_SECRET_KEY", "")
    redis_url = os.getenv("REDIS_URL", "")
    origins = [value.strip() for value in os.getenv("ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5000,http://127.0.0.1:5000"
        if app_env == "development" else "").split(",") if value.strip()]
    if redis_url:
        try:
            parsed = urlsplit(redis_url)
            valid = parsed.scheme in {"redis", "rediss"} and parsed.hostname and parsed.port
            valid = valid and parsed.password and not parsed.fragment and not parsed.query
        except ValueError:
            valid = False
        if not valid:
            raise ValueError("REDIS_URL must contain a valid Redis host, port and credentials")
    for origin in origins:
        parsed = urlsplit(origin)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc or parsed.path or parsed.query or parsed.fragment or parsed.username:
            raise ValueError("ALLOWED_ORIGINS must contain exact HTTP(S) origins")
    if app_env == "demo" and (len(jwt_key) < 32 or not redis_url or not origins):
        raise ValueError("demo requires JWT_SECRET_KEY (at least 32 characters), REDIS_URL and ALLOWED_ORIGINS")
    access_seconds = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES", "900"))
    refresh_seconds = int(os.getenv("JWT_REFRESH_TOKEN_EXPIRES", "604800"))
    if not 1 <= access_seconds <= 3600 or not access_seconds < refresh_seconds <= 2592000:
        raise ValueError("JWT expiration settings are outside the supported range")
    return {
        **external_config(app_env, origins),
        "APP_ENV": app_env,
        "RELEASE_SHA": os.getenv("RELEASE_SHA", "development"),
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
        "JWT_SECRET_KEY": jwt_key or secrets.token_hex(32),
        "JWT_ACCESS_TOKEN_EXPIRES": timedelta(seconds=access_seconds),
        "JWT_REFRESH_TOKEN_EXPIRES": timedelta(seconds=refresh_seconds),
        "JWT_TOKEN_LOCATION": ["headers"],
        "JWT_REFRESH_COOKIE_NAME": "syncarch_refresh",
        "JWT_REFRESH_COOKIE_PATH": "/api/auth/",
        "JWT_COOKIE_SECURE": app_env == "demo",
        "JWT_COOKIE_SAMESITE": "Lax",
        "JWT_SESSION_COOKIE": False,
        "JWT_COOKIE_CSRF_PROTECT": True,
        "JWT_CSRF_IN_COOKIES": False,
        "JWT_REFRESH_CSRF_HEADER_NAME": "X-CSRF-TOKEN",
        "REDIS_URL": redis_url,
        # 선택 사항입니다. 저장할 때마다 이 폴더의 API 명세 엑셀을 최신본으로 바꿉니다.
        "API_SPEC_EXPORT_DIR": os.getenv("API_SPEC_EXPORT_DIR", "").strip(),
        "REDIS_KEY_PREFIX": "syncarch:",
        "ALLOWED_ORIGINS": origins,
        "JSON_SORT_KEYS": False,
    }
