from ..extensions import db
from .common import DATETIME, TABLE_OPTIONS, new_id, utc_now


class ProjectMessage(db.Model):
    """프로젝트 멤버끼리 편집하면서 나누는 대화입니다. 나중에 참가한 멤버도 이전 대화를 봅니다."""
    __tablename__ = "project_messages"
    __table_args__ = (db.Index("ix_project_messages_project_created", "project_id", "created_at"), TABLE_OPTIONS)
    id = db.Column(db.CHAR(36), primary_key=True, default=new_id)
    project_id = db.Column(db.CHAR(36), db.ForeignKey("projects.id", name="fk_project_messages_project"), nullable=False)
    user_id = db.Column(db.CHAR(36), db.ForeignKey("app_users.id", name="fk_project_messages_user"), nullable=False)
    body = db.Column(db.Text, nullable=False)
    created_at = db.Column(DATETIME, nullable=False, default=utc_now)
