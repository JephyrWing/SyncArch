"""프로젝트/문서 조회와 변경입니다. 커밋은 서비스에서만 수행합니다."""
from sqlalchemy import select

from ..models import Project, ProjectDocument, ProjectMember, utc_now


def find_project(session, project_id, *, lock=False):
    query = select(Project).where(Project.id == project_id)
    return session.scalar(query.with_for_update() if lock else query)


def find_by_invite_code(session, code, *, lock=False):
    query = select(Project).where(Project.invite_code == code)
    return session.scalar(query.with_for_update() if lock else query)


def find_document(session, project_id, *, lock=False):
    query = select(ProjectDocument).where(ProjectDocument.project_id == project_id)
    return session.scalar(query.with_for_update() if lock else query)


def accessible_projects(session, actor_id, archived):
    query = (select(Project, ProjectDocument, ProjectMember).join(ProjectDocument,
        ProjectDocument.project_id == Project.id).join(ProjectMember,
        ProjectMember.project_id == Project.id).where(ProjectMember.user_id == actor_id))
    if archived is not None:
        query = query.where(Project.archived_at.is_not(None) if archived else Project.archived_at.is_(None))
    return session.execute(query.order_by(Project.updated_at.desc(), Project.id)).all()


def insert_project(session, actor_id, fields, payload):
    project = Project(owner_id=actor_id, title=fields["title"], summary=fields.get("summary", ""),
                      category_tag=fields.get("categoryTag", ""), target_dbms="mariadb")
    session.add(project)
    session.flush()
    document = ProjectDocument(project_id=project.id, schema_version=payload.get("schemaVersion", 1),
                               payload=payload, updated_by=actor_id)
    session.add(document)
    return project, document


def mark_changed(project, document, actor_id):
    now = utc_now()
    project.updated_at = now
    document.updated_at = now
    document.updated_by = actor_id
    document.version += 1


def set_archived(project, archived):
    project.archived_at = utc_now() if archived else None
