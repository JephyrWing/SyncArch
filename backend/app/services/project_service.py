"""프로젝트 업무와 트랜잭션 경계입니다. HTTP 객체에는 의존하지 않습니다."""
from copy import deepcopy
from datetime import timezone

from ..errors import ProjectNotFound, VersionConflict
from ..repositories import project_repository as projects, member_repository as members
from ..repositories import activity_repository as activities, template_repository as templates
from .project_access import require_access, require_active_actor
from .project_events import project_changed, publish


def utc(value):
    return value.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z") if value else None


def project_view(project, document, role):
    return {"id": project.id, "title": project.title, "summary": project.summary,
        "categoryTag": project.category_tag, "targetDbms": project.target_dbms, "ownerId": project.owner_id,
        "archived": project.archived_at is not None, "archivedAt": utc(project.archived_at),
        "createdAt": utc(project.created_at), "updatedAt": utc(project.updated_at), "version": document.version, "role": role}


def record_change(session, project, document, actor, action, *, entity_type="project", entity_id=None, label=None):
    changes = [{"area": "project", "entityType": entity_type, "entityId": entity_id or project.id,
                "label": label or project.title, "action": action}]
    activity = activities.insert_activity(session, project_id=project.id, version=document.version,
                                          actor_id=actor.id, changes=changes)
    return (project_changed, {"event": {"eventId": activity.id, "projectId": project.id,
        "version": document.version, "mutationId": activity.mutation_id, "actorId": actor.id,
        "actorName": actor.display_name, "committedAt": utc(activity.committed_at), "changes": changes}})


def _create(session, actor, fields, payload):
    project, document = projects.insert_project(session, actor.id, fields, deepcopy(payload))
    members.insert_member(session, project.id, actor.id, "OWNER")
    event = record_change(session, project, document, actor, "created")
    return project_view(project, document, "OWNER"), event


def create_project(session_factory, actor_id, fields):
    with session_factory.begin() as session:
        actor = require_active_actor(session, actor_id)
        result, event = _create(session, actor, fields, {"schemaVersion": 2, "ideas": [], "features": [],
                                                        "nodes": [], "connections": [], "tables": []})
    publish([event])
    return result


def list_projects(session_factory, actor_id, archived=False):
    with session_factory() as session:
        require_active_actor(session, actor_id)
        return [project_view(p, d, m.role) for p, d, m in projects.accessible_projects(session, actor_id, archived)]


def get_document(session_factory, actor_id, project_id):
    with session_factory() as session:
        project, member = require_access(session, actor_id, project_id)
        document = projects.find_document(session, project_id)
        if document is None:
            raise ProjectNotFound()
        return {"project": project_view(project, document, member.role), "version": document.version,
                "payload": deepcopy(document.payload), "updatedAt": utc(document.updated_at)}


def clone_project(session_factory, actor_id, project_id, source_version, title):
    with session_factory.begin() as session:
        project, _ = require_access(session, actor_id, project_id, lock=True)
        document = projects.find_document(session, project_id, lock=True)
        if document is None:
            raise ProjectNotFound()
        if document.version != source_version:
            raise VersionConflict(document.version)
        actor = require_active_actor(session, actor_id)
        fields = {"title": title, "summary": project.summary, "categoryTag": project.category_tag}
        result, event = _create(session, actor, fields, document.payload)
    publish([event])
    return result


def list_templates(session_factory, actor_id):
    with session_factory() as session:
        require_active_actor(session, actor_id)
    return templates.list_templates()


def clone_template(session_factory, actor_id, template_id, source_version, title):
    template = templates.find_template(template_id)
    if template is None:
        raise ProjectNotFound()
    if template["version"] != source_version:
        raise VersionConflict(template["version"])
    with session_factory.begin() as session:
        actor = require_active_actor(session, actor_id)
        result, event = _create(session, actor, {"title": title, "summary": template["summary"],
            "categoryTag": template["categoryTag"]}, template["payload"])
    publish([event])
    return result


def archive_project(session_factory, actor_id, project_id, archived):
    with session_factory.begin() as session:
        project, member = require_access(session, actor_id, project_id, lock=True, owner=True)
        document = projects.find_document(session, project_id, lock=True)
        if document is None:
            raise ProjectNotFound()
        event = None
        if (project.archived_at is not None) != archived:
            actor = require_active_actor(session, actor_id)
            projects.set_archived(project, archived)
            projects.mark_changed(project, document, actor_id)
            event = record_change(session, project, document, actor, "archived" if archived else "restored")
        result = project_view(project, document, member.role)
    publish([event] if event else [])
    return result
