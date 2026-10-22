"""지금 프로젝트를 보고 있는 멤버와 단계를 알려 줍니다."""
import threading
import time

from .project_access import require_access, require_active_actor

# 마지막 신호 후 이 시간이 지나면 접속이 끊긴 것으로 봅니다(클라이언트는 2초마다 보냅니다).
TTL_SECONDS = 15

# shortcut: 서버 프로세스 메모리에 둡니다. 서버 프로세스가 여러 개가 되면 Redis로 옮깁니다.
_lock = threading.Lock()
_rooms = {}


def heartbeat(session_factory, actor_id, project_id, step, now=None):
    with session_factory() as session:
        require_access(session, actor_id, project_id)
        name = require_active_actor(session, actor_id).display_name
    now = time.monotonic() if now is None else now
    with _lock:
        room = _rooms.setdefault(project_id, {})
        room[actor_id] = {"userId": actor_id, "displayName": name, "step": step, "seenAt": now}
        for user_id in [key for key, entry in room.items() if now - entry["seenAt"] > TTL_SECONDS]:
            del room[user_id]
        return [{"userId": e["userId"], "displayName": e["displayName"], "step": e["step"]} for e in room.values()]


def leave(actor_id, project_id):
    """프로젝트를 닫거나 전환하면 바로 접속자 목록에서 뺍니다."""
    with _lock:
        _rooms.get(project_id, {}).pop(actor_id, None)
