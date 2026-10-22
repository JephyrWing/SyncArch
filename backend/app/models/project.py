from ..extensions import db
from .common import DATETIME, TABLE_OPTIONS, new_id, utc_now


class Project(db.Model):
    __tablename__ = "projects"
    __table_args__ = (db.Index("uq_projects_invite_code", "invite_code", unique=True), TABLE_OPTIONS)
    id = db.Column(db.CHAR(36), primary_key=True, default=new_id)
    owner_id = db.Column(db.CHAR(36), db.ForeignKey("app_users.id", name="fk_projects_owner"), nullable=False)
    title = db.Column(db.String(120), nullable=False)
    summary = db.Column(db.Text, nullable=False, default="")
    category_tag = db.Column(db.String(80), nullable=False, default="", server_default="")
    target_dbms = db.Column(db.String(20), nullable=False, default="mariadb", server_default="mariadb")
    archived_at = db.Column(DATETIME)
    # 팀장이 처음 초대 코드를 열 때 만듭니다. 코드로 참가한 사람은 EDITOR가 됩니다.
    invite_code = db.Column(db.String(12))
    created_at = db.Column(DATETIME, nullable=False, default=utc_now)
    updated_at = db.Column(DATETIME, nullable=False, default=utc_now, onupdate=utc_now)
