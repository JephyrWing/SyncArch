"""멱등 재시도에 최초 정규화 응답을 보존합니다."""
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade():
    # 기존 멱등 기록과 문서는 변경하지 않습니다. 이전 기록은 NULL을 유지합니다.
    op.add_column("document_mutations", sa.Column("result_data", sa.JSON(), nullable=True))


def downgrade():
    op.drop_column("document_mutations", "result_data")
