"""소유자 전용 멤버 변경과 원자적 권한/활동 이력 처리입니다."""
from ..errors import Forbidden, UserNotFound, ProjectNotFound
from ..repositories import project_repository as projects, member_repository as members
from ..repositories.user_repository import find_by_id, find_by_login_id
from .project_access import require_access, require_active_actor
from .project_service import record_change, utc
from .project_events import access_revoked, publish


def member_view(member, user):
    return {"id": user.id, "loginId": user.login_id, "displayName": user.display_name,
            "role": member.role, "joinedAt": utc(member.joined_at), "isActive": user.is_active}


def list_members(session_factory, actor_id, project_id):
    with session_factory() as session:
        require_access(session, actor_id, project_id)
        return [member_view(m, u) for m, u in members.list_members(session, project_id)]


def add_member(session_factory, actor_id, project_id, login_id):
    with session_factory.begin() as session:
        project, _ = require_access(session, actor_id, project_id, lock=True, owner=True, write=True)
        user = find_by_login_id(session, login_id)
        if user is None or not user.is_active:
            raise UserNotFound()
        member = members.find_member(session, project_id, user.id, lock=True)
        event = None
        if member is None:
            member = members.insert_member(session, project_id, user.id, "EDITOR")
            document = projects.find_document(session, project_id, lock=True)
            if document is None:
                raise ProjectNotFound()
            projects.mark_changed(project, document, actor_id)
            event = record_change(session, project, document, require_active_actor(session, actor_id), "member_added",
                                   entity_type="member", entity_id=user.id, label=user.display_name)
        result = member_view(member, user)
    publish([event] if event else [])
    return result


def remove_member(session_factory, actor_id, project_id, user_id):
    with session_factory.begin() as session:
        project, _ = require_access(session, actor_id, project_id, lock=True, owner=True, write=True)
        if user_id == project.owner_id:
            raise Forbidden()
        member = members.find_member(session, project_id, user_id, lock=True)
        events = []
        if member is not None:
            user = find_by_id(session, user_id)
            members.delete_member(session, member)
            document = projects.find_document(session, project_id, lock=True)
            if document is None:
                raise ProjectNotFound()
            projects.mark_changed(project, document, actor_id)
            event = record_change(session, project, document, require_active_actor(session, actor_id), "member_removed",
                                   entity_type="member", entity_id=user_id, label=user.display_name)
            events = [(access_revoked, {"project_id": project_id, "user_id": user_id, "reason": "MEMBER_REMOVED"}), event]
    publish(events)
