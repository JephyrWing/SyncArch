from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy.dialects import mysql

from ..extensions import db

DATETIME = db.DateTime().with_variant(mysql.DATETIME(fsp=6), "mysql", "mariadb")
VERSION = db.BigInteger().with_variant(mysql.BIGINT(unsigned=True), "mysql", "mariadb")
TABLE_OPTIONS = {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4",
                 "mysql_collate": "utf8mb4_unicode_ci"}


def utc_now():
    # MariaDB DATETIME stores a naive UTC value; serialize explicitly as UTC.
    return datetime.now(timezone.utc).replace(tzinfo=None)


def new_id():
    return str(uuid4())


def empty_document():
    return {"schemaVersion": 1, "ideas": [], "features": [], "nodes": [],
            "connections": [], "tables": []}
