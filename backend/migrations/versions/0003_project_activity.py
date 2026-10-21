"""기존 문서와 마이그레이션 이력을 보존하며 프로젝트 활동을 추가합니다."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("project_activity",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("project_id", sa.CHAR(36), nullable=False),
        sa.Column("version", sa.BigInteger().with_variant(mysql.BIGINT(unsigned=True), "mysql", "mariadb"), nullable=False),
        sa.Column("mutation_id", sa.CHAR(36), nullable=False),
        sa.Column("actor_id", sa.CHAR(36), nullable=False),
        sa.Column("committed_at", sa.DateTime().with_variant(mysql.DATETIME(fsp=6), "mysql", "mariadb"), nullable=False),
        sa.Column("changes", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name="fk_project_activity_project"),
        sa.ForeignKeyConstraint(["actor_id"], ["app_users.id"], name="fk_project_activity_actor"),
        sa.UniqueConstraint("project_id", "mutation_id", name="uq_project_activity_mutation"),
        sa.CheckConstraint("version >= 1", name="ck_project_activity_version"),
        mysql_engine="InnoDB", mysql_charset="utf8mb4", mysql_collate="utf8mb4_unicode_ci")


def downgrade():
    op.drop_table("project_activity")
