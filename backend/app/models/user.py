from ..extensions import db
from .common import DATETIME, TABLE_OPTIONS, new_id, utc_now
from sqlalchemy.dialects import mysql


class AppUser(db.Model):
    __tablename__ = "app_users"
    __table_args__ = (db.UniqueConstraint("login_id", name="uq_app_users_login_id"),
        db.Index("uq_app_users_email_normalized", "email_normalized", unique=True), TABLE_OPTIONS)
    id = db.Column(db.CHAR(36), primary_key=True, default=new_id)
    login_id = db.Column(db.String(100), nullable=False)
    display_name = db.Column(db.String(80), nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(DATETIME, nullable=False, default=utc_now)
    email = db.Column(db.String(254))
    email_normalized = db.Column(db.String(254).with_variant(mysql.VARCHAR(254, charset="ascii", collation="ascii_bin"), "mysql", "mariadb"))
    email_verified_at = db.Column(DATETIME)
