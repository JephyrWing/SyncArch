from ..extensions import db
from .common import DATETIME, TABLE_OPTIONS, utc_now


class ProjectMember(db.Model):
    __tablename__ = "project_members"
    __table_args__ = (db.CheckConstraint("role IN ('OWNER', 'EDITOR')", name="ck_project_members_role"), TABLE_OPTIONS)
    project_id = db.Column(db.CHAR(36), db.ForeignKey("projects.id", name="fk_project_members_project"), primary_key=True)
    user_id = db.Column(db.CHAR(36), db.ForeignKey("app_users.id", name="fk_project_members_user"), primary_key=True)
    role = db.Column(db.String(10), nullable=False)
    joined_at = db.Column(DATETIME, nullable=False, default=utc_now)
