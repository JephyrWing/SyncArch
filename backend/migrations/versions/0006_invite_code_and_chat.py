"""초대 코드로 프로젝트에 참가하고, 프로젝트 안에서 채팅합니다."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None

DATETIME = sa.DateTime().with_variant(mysql.DATETIME(fsp=6), "mysql", "mariadb")
OPTIONS = {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}


def upgrade():
    # 기존 프로젝트는 팀장이 처음 초대 코드를 열 때 코드가 만들어지므로 NULL로 둡니다.
    op.add_column("projects", sa.Column("invite_code", sa.String(12), nullable=True))
    op.create_index("uq_projects_invite_code", "projects", ["invite_code"], unique=True)
    op.create_table("project_messages",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("project_id", sa.CHAR(36), nullable=False),
        sa.Column("user_id", sa.CHAR(36), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", DATETIME, nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name="fk_project_messages_project"),
        sa.ForeignKeyConstraint(["user_id"], ["app_users.id"], name="fk_project_messages_user"), **OPTIONS)
    op.create_index("ix_project_messages_project_created", "project_messages", ["project_id", "created_at"])


def downgrade():
    # MariaDB는 외래키가 쓰는 인덱스를 따로 지울 수 없습니다. 테이블을 지우면 인덱스도 함께 지워집니다.
    op.drop_table("project_messages")
    op.drop_index("uq_projects_invite_code", table_name="projects")
    op.drop_column("projects", "invite_code")
