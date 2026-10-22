"""프로젝트 멤버끼리 나누는 채팅입니다."""
from sqlalchemy.exc import IntegrityError

from ..errors import IdempotencyKeyReused
from ..repositories import message_repository as messages
from .project_access import require_access, require_active_actor
from .project_service import utc

MAX_MESSAGES = 200


def _view(message, user):
    return {"id": message.id, "userId": user.id, "displayName": user.display_name, "body": message.body,
            "createdAt": utc(message.created_at)}


def list_messages(session_factory, actor_id, project_id, since=None, after_id=None):
    """since가 없으면 최근 대화를, 있으면 그 시각 이후(같은 시각 포함) 대화를 오래된 순으로 돌려줍니다.

    같은 시각에 저장된 메시지를 놓치지 않으려고 같은 시각을 포함합니다. 클라이언트가 id로 중복을 거릅니다.
    """
    with session_factory() as session:
        require_access(session, actor_id, project_id)
        rows = messages.page(session, project_id, since, after_id, MAX_MESSAGES)
        return [_view(message, user) for message, user in rows]


def post_message(session_factory, actor_id, project_id, body, message_id=None):
    with session_factory.begin() as session:
        require_access(session, actor_id, project_id, write=True, lock=True)
        actor = require_active_actor(session, actor_id)
        existing = messages.find(session, message_id) if message_id else None
        if existing:
            if (existing.project_id, existing.user_id, existing.body) != (project_id, actor_id, body):
                raise IdempotencyKeyReused()
            return _view(existing, actor)
        try:
            with session.begin_nested():
                message = messages.insert(session, project_id, actor_id, body, message_id)
        except IntegrityError:
            existing = messages.find(session, message_id) if message_id else None
            if existing and (existing.project_id, existing.user_id, existing.body) == (project_id, actor_id, body):
                return _view(existing, actor)
            raise IdempotencyKeyReused() from None
        return _view(message, actor)
