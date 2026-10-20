from datetime import datetime, timezone
from uuid import uuid4

from .extensions import db


def utc_now():
    # MariaDB DATETIME stores a naive UTC value; serialize explicitly as UTC.
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Project(db.Model):
    __tablename__ = "projects"

    id = db.Column(db.String(64), primary_key=True, default=lambda: str(uuid4()))
    title = db.Column(db.String(200), nullable=False)
    summary = db.Column(db.Text, nullable=False, default="")
    data = db.Column(db.JSON, nullable=False, default=dict)
    created_at = db.Column(db.DateTime, nullable=False, default=utc_now)
    updated_at = db.Column(db.DateTime, nullable=False, default=utc_now, onupdate=utc_now)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "summary": self.summary,
            "data": self.data,
            "createdAt": self.created_at.isoformat() + "Z",
            "updatedAt": self.updated_at.isoformat() + "Z",
        }
