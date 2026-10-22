"""REST·W05·W15가 공유하는 최신 객체 권한 정책입니다."""
from ..errors import AuthenticationRequired, Forbidden, ProjectArchived, ProjectNotFound
from ..repositories import project_repository as projects, member_repository as members
from ..repositories.user_repository import find_by_id


def require_active_actor(session, actor_id):
    actor = find_by_id(session, actor_id)
    if not actor or not actor.is_active:
        raise AuthenticationRequired()
    return actor


def require_access(session, actor_id, project_id, *, lock=False, owner=False, write=False):
    # 모든 쓰기는 projects -> project_members -> project_documents 순서로 잠급니다.
    project = projects.find_project(session, project_id, lock=lock)
    if project is None:
        raise ProjectNotFound()
    member = members.find_member(session, project_id, actor_id, lock=lock)
    require_active_actor(session, actor_id)
    if member is None:
        raise ProjectNotFound()
    if owner and (member.role != "OWNER" or project.owner_id != actor_id):
        raise Forbidden()
    if write and project.archived_at is not None:
        raise ProjectArchived()
    return project, member
