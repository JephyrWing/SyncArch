"""Split project documents from operating metadata without discarding old data.

Revision ID: 0002
Revises: 0001
"""
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

LEGACY_OWNER = "00000000-0000-4000-8000-000000000001"
DATETIME = sa.DateTime().with_variant(mysql.DATETIME(fsp=6), "mysql", "mariadb")
VERSION = sa.BigInteger().with_variant(mysql.BIGINT(unsigned=True), "mysql", "mariadb")
OPTIONS = {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}


def upgrade():
    connection = op.get_bind()
    legacy = sa.Table("projects", sa.MetaData(), autoload_with=connection)
    rows = list(connection.execute(sa.select(legacy)).mappings())
    # Check before MariaDB's auto-committing DDL; never silently truncate old values.
    if any(len(row["id"]) > 36 or len(row["title"]) > 120 for row in rows):
        raise RuntimeError("Migration 0002 requires legacy IDs <=36 and titles <=120 characters; no data was changed")

    op.create_table("app_users",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("login_id", sa.String(100), nullable=False),
        sa.Column("display_name", sa.String(80), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", DATETIME, nullable=False),
        sa.UniqueConstraint("login_id", name="uq_app_users_login_id"), **OPTIONS)
    if rows:
        users = sa.table("app_users", sa.column("id"), sa.column("login_id"),
                         sa.column("display_name"), sa.column("password_hash"),
                         sa.column("is_active"), sa.column("created_at", DATETIME))
        connection.execute(users.insert().values(
            id=LEGACY_OWNER, login_id="__legacy_import__", display_name="Legacy import (unassigned)",
            password_hash="!disabled", is_active=False,
            created_at=datetime.now(timezone.utc).replace(tzinfo=None)))

    with op.batch_alter_table("projects") as batch:
        batch.add_column(sa.Column("owner_id", sa.CHAR(36), nullable=True))
        batch.add_column(sa.Column("category_tag", sa.String(80), nullable=False, server_default=""))
        batch.add_column(sa.Column("target_dbms", sa.String(20), nullable=False, server_default="mariadb"))
        batch.add_column(sa.Column("archived_at", DATETIME, nullable=True))
    if rows:
        projects = sa.table("projects", sa.column("owner_id"))
        connection.execute(projects.update().values(owner_id=LEGACY_OWNER))
    with op.batch_alter_table("projects") as batch:
        batch.alter_column("id", type_=sa.CHAR(36), existing_type=sa.String(64), existing_nullable=False)
        batch.alter_column("title", type_=sa.String(120), existing_type=sa.String(200), existing_nullable=False)
        batch.alter_column("owner_id", nullable=False, existing_type=sa.CHAR(36))
        for name in ("created_at", "updated_at"):
            batch.alter_column(name, type_=DATETIME, existing_type=sa.DateTime(), existing_nullable=False)
        batch.create_foreign_key("fk_projects_owner", "app_users", ["owner_id"], ["id"])

    op.create_table("project_members",
        sa.Column("project_id", sa.CHAR(36), primary_key=True),
        sa.Column("user_id", sa.CHAR(36), primary_key=True),
        sa.Column("role", sa.String(10), nullable=False),
        sa.Column("joined_at", DATETIME, nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name="fk_project_members_project"),
        sa.ForeignKeyConstraint(["user_id"], ["app_users.id"], name="fk_project_members_user"),
        sa.CheckConstraint("role IN ('OWNER', 'EDITOR')", name="ck_project_members_role"), **OPTIONS)
    op.create_table("project_documents",
        sa.Column("project_id", sa.CHAR(36), primary_key=True),
        sa.Column("version", VERSION, nullable=False),
        sa.Column("schema_version", sa.Integer(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("updated_by", sa.CHAR(36), nullable=False),
        sa.Column("updated_at", DATETIME, nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name="fk_project_documents_project"),
        sa.ForeignKeyConstraint(["updated_by"], ["app_users.id"], name="fk_project_documents_user"),
        sa.CheckConstraint("version >= 1", name="ck_project_documents_version"),
        sa.CheckConstraint("schema_version >= 1", name="ck_project_documents_schema"), **OPTIONS)
    op.create_table("document_mutations",
        sa.Column("project_id", sa.CHAR(36), primary_key=True),
        sa.Column("mutation_id", sa.CHAR(36), primary_key=True),
        sa.Column("actor_id", sa.CHAR(36), nullable=False),
        sa.Column("request_hash", sa.CHAR(64), nullable=False),
        sa.Column("result_version", VERSION, nullable=False),
        sa.Column("result_updated_at", DATETIME, nullable=False),
        sa.Column("created_at", DATETIME, nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name="fk_document_mutations_project"),
        sa.ForeignKeyConstraint(["actor_id"], ["app_users.id"], name="fk_document_mutations_user"),
        sa.CheckConstraint("result_version >= 1", name="ck_document_mutations_version"), **OPTIONS)
    if rows:
        members = sa.Table("project_members", sa.MetaData(), autoload_with=connection)
        documents = sa.Table("project_documents", sa.MetaData(), autoload_with=connection)
        for row in rows:
            connection.execute(members.insert().values(project_id=row["id"], user_id=LEGACY_OWNER,
                                                      role="OWNER", joined_at=row["created_at"]))
            # Preserve the exact legacy JSON, including fields not yet in schemaVersion 1.
            connection.execute(documents.insert().values(project_id=row["id"], version=1, schema_version=1,
                payload=row["data"], updated_by=LEGACY_OWNER, updated_at=row["updated_at"]))
    # MariaDB DDL commits implicitly. Keep source JSON until every copy succeeded.
    # Direct DROP COLUMN also avoids rebuilding an SQLite parent with live FK children.
    op.drop_column("projects", "data")


def downgrade():
    connection = op.get_bind()
    documents = sa.Table("project_documents", sa.MetaData(), autoload_with=connection)
    payloads = dict(connection.execute(sa.select(documents.c.project_id, documents.c.payload)).all())
    op.add_column("projects", sa.Column("data", sa.JSON(), nullable=True))
    projects = sa.Table("projects", sa.MetaData(), autoload_with=connection)
    project_ids = list(connection.execute(sa.select(projects.c.id)).scalars())
    for project_id in project_ids:
        connection.execute(projects.update().where(projects.c.id == project_id).values(data=payloads.get(project_id, {})))
    for name in ("document_mutations", "project_members", "project_documents"):
        op.drop_table(name)
    with op.batch_alter_table("projects") as batch:
        batch.drop_constraint("fk_projects_owner", type_="foreignkey")
        for name in ("owner_id", "category_tag", "target_dbms", "archived_at"):
            batch.drop_column(name)
        batch.alter_column("id", type_=sa.String(64), existing_type=sa.CHAR(36), existing_nullable=False)
        batch.alter_column("title", type_=sa.String(200), existing_type=sa.String(120), existing_nullable=False)
        for name in ("created_at", "updated_at"):
            batch.alter_column(name, type_=sa.DateTime(), existing_type=DATETIME, existing_nullable=False)
        batch.alter_column("data", nullable=False, existing_type=sa.JSON())
    op.drop_table("app_users")
