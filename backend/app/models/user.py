from ..extensions import db
from .common import DATETIME, TABLE_OPTIONS, new_id, utc_now


class AppUser(db.Model):
    __tablename__ = "app_users"
    __table_args__ = (db.UniqueConstraint("login_id", name="uq_app_users_login_id"), TABLE_OPTIONS)
    id = db.Column(db.CHAR(36), primary_key=True, default=new_id)
    login_id = db.Column(db.String(100), nullable=False)
    display_name = db.Column(db.String(80), nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(DATETIME, nullable=False, default=utc_now)
