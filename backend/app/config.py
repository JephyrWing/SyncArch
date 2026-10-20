import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy.engine import URL


def load_config():
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
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
        "SQLALCHEMY_DATABASE_URI": database_url,
        "SQLALCHEMY_TRACK_MODIFICATIONS": False,
        "SQLALCHEMY_ENGINE_OPTIONS": engine_options,
        "MAX_CONTENT_LENGTH": 10 * 1024 * 1024,
        "JSON_SORT_KEYS": False,
    }
