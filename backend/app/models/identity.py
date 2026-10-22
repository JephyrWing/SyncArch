"""검증된 외부 subject와 기존 내부 사용자 사이의 영구 연결입니다."""
from sqlalchemy.dialects import mysql

from ..extensions import db
from .common import DATETIME, TABLE_OPTIONS, new_id, utc_now


class UserIdentity(db.Model):
    __tablename__ = "app_user_identities"
    __table_args__ = (db.UniqueConstraint("provider", "subject", name="uq_identities_provider_subject"),
        db.UniqueConstraint("user_id", "provider", name="uq_identities_user_provider"), TABLE_OPTIONS)
    id = db.Column(db.CHAR(36), primary_key=True, default=new_id)
    user_id = db.Column(db.CHAR(36), db.ForeignKey("app_users.id", name="fk_identities_user"), nullable=False)
    provider = db.Column(db.String(16), nullable=False)
    subject = db.Column(db.String(255).with_variant(mysql.VARCHAR(255, charset="ascii", collation="ascii_bin"), "mysql", "mariadb"), nullable=False)
    email = db.Column(db.String(254))
    email_verified = db.Column(db.Boolean, nullable=False)
    created_at = db.Column(DATETIME, nullable=False, default=utc_now)
