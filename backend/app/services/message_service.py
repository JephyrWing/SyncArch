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
    """since가 없으면 최근 대화를, 있으면 (since, after_id) 커서 다음 대화를 오래된 순으로 돌려줍니다.

    같은 시각 메시지가 MAX_MESSAGES개를 넘어도 id로 이어서 읽으므로 다음 조회에서 건너뛰거나 멈추지 않습니다.
    shortcut: 시각은 저장 직전에 정하므로 아주 드물게 먼저 정한 시각이 나중에 커밋되면 커서 뒤로 들어가 놓칠 수 있습니다.
    서버가 여러 대가 되거나 놓침이 보고되면 커밋 순서 번호(자동 증가 열)로 바꿉니다.
    """
    with session_factory() as session:
        require_access(session, actor_id, project_id)
        if since is None:
            rows = messages.latest_messages(session, project_id, MAX_MESSAGES)
        else:
            rows = messages.messages_after(session, project_id, since, after_id, MAX_MESSAGES)
        return [_view(message, user) for message, user in rows]


def _existing(session, actor_id, project_id, body, client_id):
    message = messages.find_by_client_id(session, project_id, actor_id, client_id)
    if message is not None and message.body != body:
        raise IdempotencyKeyReused()
    return message


def post_message(session_factory, actor_id, project_id, body, client_id=None):
    """같은 clientId로 다시 보내면 처음 저장한 메시지를 돌려줍니다. 두 번째 값은 새로 저장했는지입니다."""
    try:
        with session_factory.begin() as session:
            require_access(session, actor_id, project_id, write=True)
            actor = require_active_actor(session, actor_id)
            if client_id is not None:
                existing = _existing(session, actor_id, project_id, body, client_id)
                if existing is not None:
                    return _view(existing, actor), False
            return _view(messages.insert_message(session, project_id, actor_id, body, client_id), actor), True
    except IntegrityError:
        # 같은 키의 재전송이 동시에 들어와 고유 인덱스에 막혔습니다. 먼저 저장된 메시지를 돌려줍니다.
        if client_id is None:
            raise
        with session_factory() as session:
            actor = require_active_actor(session, actor_id)
            existing = _existing(session, actor_id, project_id, body, client_id)
            if existing is None:
                raise
            return _view(existing, actor), False
