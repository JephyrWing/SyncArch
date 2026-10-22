"""채팅 메시지를 다시 보내도 한 번만 저장되도록 브라우저가 붙인 키를 남깁니다."""
from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade():
    # 기존 메시지는 키가 없어 NULL로 둡니다. 고유 인덱스는 NULL끼리 겹쳐도 허용합니다.
    op.add_column("project_messages", sa.Column("client_id", sa.CHAR(36), nullable=True))
    op.create_index("uq_project_messages_client", "project_messages", ["project_id", "user_id", "client_id"],
                    unique=True)


def downgrade():
    op.drop_index("uq_project_messages_client", table_name="project_messages")
    op.drop_column("project_messages", "client_id")
