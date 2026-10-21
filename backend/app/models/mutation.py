from ..extensions import db
from .common import DATETIME, VERSION, TABLE_OPTIONS, utc_now


class DocumentMutation(db.Model):
    __tablename__ = "document_mutations"
    __table_args__ = (db.CheckConstraint("result_version >= 1", name="ck_document_mutations_version"), TABLE_OPTIONS)
    project_id = db.Column(db.CHAR(36), db.ForeignKey("projects.id", name="fk_document_mutations_project"), primary_key=True)
    mutation_id = db.Column(db.CHAR(36), primary_key=True)
    actor_id = db.Column(db.CHAR(36), db.ForeignKey("app_users.id", name="fk_document_mutations_user"), nullable=False)
    request_hash = db.Column(db.CHAR(64), nullable=False)
    result_version = db.Column(VERSION, nullable=False)
    result_updated_at = db.Column(DATETIME, nullable=False)
    created_at = db.Column(DATETIME, nullable=False, default=utc_now)
