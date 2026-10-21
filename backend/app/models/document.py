from ..extensions import db
from .common import DATETIME, VERSION, TABLE_OPTIONS, empty_document, utc_now


class ProjectDocument(db.Model):
    __tablename__ = "project_documents"
    __table_args__ = (
        db.CheckConstraint("version >= 1", name="ck_project_documents_version"),
        db.CheckConstraint("schema_version >= 1", name="ck_project_documents_schema"), TABLE_OPTIONS,
    )
    project_id = db.Column(db.CHAR(36), db.ForeignKey("projects.id", name="fk_project_documents_project"), primary_key=True)
    version = db.Column(VERSION, nullable=False, default=1)
    schema_version = db.Column(db.Integer, nullable=False, default=1)
    payload = db.Column(db.JSON, nullable=False, default=empty_document)
    updated_by = db.Column(db.CHAR(36), db.ForeignKey("app_users.id", name="fk_project_documents_user"), nullable=False)
    updated_at = db.Column(DATETIME, nullable=False, default=utc_now, onupdate=utc_now)
