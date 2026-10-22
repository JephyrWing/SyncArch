"""프로젝트 변경과 같은 트랜잭션에 기록하는 영구 활동 이력입니다."""
from ..extensions import db
from .common import DATETIME, VERSION, TABLE_OPTIONS, new_id, utc_now


class ProjectActivity(db.Model):
    __tablename__ = "project_activity"
    __table_args__ = (
        db.UniqueConstraint("project_id", "mutation_id", name="uq_project_activity_mutation"),
        db.CheckConstraint("version >= 1", name="ck_project_activity_version"), TABLE_OPTIONS,
    )
    id = db.Column(db.CHAR(36), primary_key=True, default=new_id)
    project_id = db.Column(db.CHAR(36), db.ForeignKey("projects.id", name="fk_project_activity_project"), nullable=False)
    version = db.Column(VERSION, nullable=False)
    mutation_id = db.Column(db.CHAR(36), nullable=False)
    actor_id = db.Column(db.CHAR(36), db.ForeignKey("app_users.id", name="fk_project_activity_actor"), nullable=False)
    committed_at = db.Column(DATETIME, nullable=False, default=utc_now)
    changes = db.Column(db.JSON, nullable=False)
