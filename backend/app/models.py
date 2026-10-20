from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy.dialects import mysql

from .extensions import db

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


class AppUser(db.Model):
    __tablename__ = "app_users"
    __table_args__ = (db.UniqueConstraint("login_id", name="uq_app_users_login_id"), TABLE_OPTIONS)
    id = db.Column(db.CHAR(36), primary_key=True, default=new_id)
    login_id = db.Column(db.String(100), nullable=False)
    display_name = db.Column(db.String(80), nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(DATETIME, nullable=False, default=utc_now)


class Project(db.Model):
    __tablename__ = "projects"
    __table_args__ = TABLE_OPTIONS
    id = db.Column(db.CHAR(36), primary_key=True, default=new_id)
    owner_id = db.Column(db.CHAR(36), db.ForeignKey("app_users.id", name="fk_projects_owner"), nullable=False)
    title = db.Column(db.String(120), nullable=False)
    summary = db.Column(db.Text, nullable=False, default="")
    category_tag = db.Column(db.String(80), nullable=False, default="", server_default="")
    target_dbms = db.Column(db.String(20), nullable=False, default="mariadb", server_default="mariadb")
    archived_at = db.Column(DATETIME)
    created_at = db.Column(DATETIME, nullable=False, default=utc_now)
    updated_at = db.Column(DATETIME, nullable=False, default=utc_now, onupdate=utc_now)


class ProjectMember(db.Model):
    __tablename__ = "project_members"
    __table_args__ = (db.CheckConstraint("role IN ('OWNER', 'EDITOR')", name="ck_project_members_role"), TABLE_OPTIONS)
    project_id = db.Column(db.CHAR(36), db.ForeignKey("projects.id", name="fk_project_members_project"), primary_key=True)
    user_id = db.Column(db.CHAR(36), db.ForeignKey("app_users.id", name="fk_project_members_user"), primary_key=True)
    role = db.Column(db.String(10), nullable=False)
    joined_at = db.Column(DATETIME, nullable=False, default=utc_now)


class ProjectDocument(db.Model):
    __tablename__ = "project_documents"
    __table_args__ = (
        db.CheckConstraint("version >= 1", name="ck_project_documents_version"),
        db.CheckConstraint("schema_version >= 1", name="ck_project_documents_schema"), TABLE_OPTIONS,
    )
    project_id = db.Column(db.CHAR(36), db.ForeignKey("projects.id", name="fk_project_documents_project"), primary_key=True)
    version = db.Column(VERSION, nullable=False, default=1)
    schema_version = db.Column(db.Integer, nullable=False, default=1)
    payload = db.Column(db.JSON, nullable=False, default=empty_document)
    updated_by = db.Column(db.CHAR(36), db.ForeignKey("app_users.id", name="fk_project_documents_user"), nullable=False)
    updated_at = db.Column(DATETIME, nullable=False, default=utc_now, onupdate=utc_now)


class DocumentMutation(db.Model):
    __tablename__ = "document_mutations"
    __table_args__ = (db.CheckConstraint("result_version >= 1", name="ck_document_mutations_version"), TABLE_OPTIONS)
    project_id = db.Column(db.CHAR(36), db.ForeignKey("projects.id", name="fk_document_mutations_project"), primary_key=True)
    mutation_id = db.Column(db.CHAR(36), primary_key=True)
    actor_id = db.Column(db.CHAR(36), db.ForeignKey("app_users.id", name="fk_document_mutations_user"), nullable=False)
    request_hash = db.Column(db.CHAR(64), nullable=False)
    result_version = db.Column(VERSION, nullable=False)
    result_updated_at = db.Column(DATETIME, nullable=False)
    created_at = db.Column(DATETIME, nullable=False, default=utc_now)
