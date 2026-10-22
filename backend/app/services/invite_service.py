"""초대 코드 발급과 코드로 참가하기입니다. 코드를 아는 로그인 사용자는 EDITOR로 참가합니다."""
import secrets

from sqlalchemy import select

from ..errors import InviteCodeNotFound, ProjectArchived, ProjectNotFound
from ..models import Project
from ..repositories import project_repository as projects, member_repository as members
from .project_access import require_access, require_active_actor
from .project_events import publish
from .project_service import project_view, record_change

# 헷갈리는 글자(0/O, 1/I/L)를 뺐습니다. 31자 8자리라 약 8.5×10^11가지여서 맞혀서 들어오기 어렵습니다.
ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def _new_code(session):
    while True:
        code = "".join(secrets.choice(ALPHABET) for _ in range(8))
        if session.scalar(select(Project.id).where(Project.invite_code == code)) is None:
            return code


def get_invite(session_factory, actor_id, project_id):
    """팀장만 봅니다. 코드가 없던 기존 프로젝트는 이때 만듭니다."""
    with session_factory.begin() as session:
        project, _ = require_access(session, actor_id, project_id, lock=True, owner=True)
        if not project.invite_code:
            project.invite_code = _new_code(session)
        return {"code": project.invite_code}


def regenerate_invite(session_factory, actor_id, project_id):
    """코드가 새어 나갔을 때 팀장이 바꿉니다. 이미 참가한 멤버는 그대로입니다."""
    with session_factory.begin() as session:
        project, _ = require_access(session, actor_id, project_id, lock=True, owner=True)
        project.invite_code = _new_code(session)
        return {"code": project.invite_code}


def join_by_code(session_factory, actor_id, code):
    """이미 멤버면 그대로 프로젝트를 돌려줍니다. 새 멤버는 멤버 추가와 같은 이력을 남깁니다."""
    event = None
    with session_factory.begin() as session:
        actor = require_active_actor(session, actor_id)
        # 잠금 순서는 projects -> project_members -> project_documents입니다(project_access 참고).
        project = session.scalar(select(Project).where(Project.invite_code == code).with_for_update())
        if project is None:
            raise InviteCodeNotFound()
        if project.archived_at is not None:
            raise ProjectArchived()
        member = members.find_member(session, project.id, actor_id, lock=True)
        document = projects.find_document(session, project.id, lock=True)
        if document is None:
            raise ProjectNotFound()
        if member is None:
            member = members.insert_member(session, project.id, actor_id, "EDITOR")
            projects.mark_changed(project, document, actor_id)
            event = record_change(session, project, document, actor, "member_added",
                                  entity_type="member", entity_id=actor_id, label=actor.display_name)
        result = project_view(project, document, member.role)
    publish([event] if event else [])
    return result
