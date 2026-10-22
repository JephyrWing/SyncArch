"""프로젝트 멤버끼리 나누는 채팅입니다."""
from sqlalchemy import select

from ..models import AppUser, ProjectMessage
from .project_access import require_access, require_active_actor
from .project_service import utc

MAX_MESSAGES = 200


def _view(message, user):
    return {"id": message.id, "userId": user.id, "displayName": user.display_name, "body": message.body,
            "createdAt": utc(message.created_at)}


def list_messages(session_factory, actor_id, project_id, since=None):
    """since가 없으면 최근 대화를, 있으면 그 시각 이후(같은 시각 포함) 대화를 오래된 순으로 돌려줍니다.

    같은 시각에 저장된 메시지를 놓치지 않으려고 같은 시각을 포함합니다. 클라이언트가 id로 중복을 거릅니다.
    """
    with session_factory() as session:
        require_access(session, actor_id, project_id)
        query = (select(ProjectMessage, AppUser).join(AppUser, AppUser.id == ProjectMessage.user_id)
                 .where(ProjectMessage.project_id == project_id))
        if since is not None:
            rows = session.execute(query.where(ProjectMessage.created_at >= since)
                                   .order_by(ProjectMessage.created_at).limit(MAX_MESSAGES)).all()
        else:
            rows = list(reversed(session.execute(query.order_by(ProjectMessage.created_at.desc())
                                                 .limit(MAX_MESSAGES)).all()))
        return [_view(message, user) for message, user in rows]


def post_message(session_factory, actor_id, project_id, body):
    with session_factory.begin() as session:
        require_access(session, actor_id, project_id, write=True)
        actor = require_active_actor(session, actor_id)
        message = ProjectMessage(project_id=project_id, user_id=actor_id, body=body)
        session.add(message)
        session.flush()
        return _view(message, actor)
