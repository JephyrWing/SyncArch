"""기존 계정을 보존하고 Google identity와 검증 이메일을 추가합니다."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade():
    # 기존 주소를 추측하지 않습니다. 모든 과거 행은 NULL 이메일로 시작합니다.
    op.add_column("app_users", sa.Column("email", sa.String(254)))
    op.add_column("app_users", sa.Column("email_normalized", sa.String(254).with_variant(
        mysql.VARCHAR(254, charset="ascii", collation="ascii_bin"), "mysql", "mariadb")))
    op.add_column("app_users", sa.Column("email_verified_at", sa.DateTime().with_variant(mysql.DATETIME(fsp=6), "mysql", "mariadb")))
    op.create_index("uq_app_users_email_normalized", "app_users", ["email_normalized"], unique=True)
    op.create_table("app_user_identities",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("user_id", sa.CHAR(36), nullable=False),
        sa.Column("provider", sa.String(16), nullable=False),
        sa.Column("subject", sa.String(255).with_variant(mysql.VARCHAR(255, charset="ascii", collation="ascii_bin"), "mysql", "mariadb"), nullable=False),
        sa.Column("email", sa.String(254)),
        sa.Column("email_verified", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime().with_variant(mysql.DATETIME(fsp=6), "mysql", "mariadb"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["app_users.id"], name="fk_identities_user"),
        sa.UniqueConstraint("provider", "subject", name="uq_identities_provider_subject"),
        sa.UniqueConstraint("user_id", "provider", name="uq_identities_user_provider"),
        mysql_engine="InnoDB", mysql_charset="utf8mb4", mysql_collate="utf8mb4_unicode_ci")


def downgrade():
    op.drop_table("app_user_identities")
    op.drop_index("uq_app_users_email_normalized", table_name="app_users")
    for column in ("email_verified_at", "email_normalized", "email"):
        op.drop_column("app_users", column)
