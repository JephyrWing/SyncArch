"""지금 프로젝트를 보고 있는 멤버와 단계를 알려 줍니다."""
import threading
import time

from .project_access import require_access, require_active_actor
from .project_events import access_revoked

# 마지막 신호 후 이 시간이 지나면 접속이 끊긴 것으로 봅니다(클라이언트는 2초마다 보냅니다).
TTL_SECONDS = 15

# shortcut: 서버 프로세스 메모리에 둡니다. 서버 프로세스가 여러 개가 되면 Redis로 옮깁니다.
_lock = threading.Lock()
_rooms = {}
_removed_at = {}


def heartbeat(session_factory, actor_id, project_id, step, tab_id="", now=None):
    checked_at = time.monotonic()
    with session_factory() as session:
        require_access(session, actor_id, project_id)
        name = require_active_actor(session, actor_id).display_name
    now = time.monotonic() if now is None else now
    with _lock:
        room = _rooms.setdefault(project_id, {})
        # 권한 확인 뒤 기다리는 사이 멤버에서 빠졌다면 다시 올리지 않습니다.
        # 제외 기록은 TTL 동안만 남기므로, 권한 확인이 그보다 오래된 신호도 올리지 않습니다.
        if (time.monotonic() - checked_at <= TTL_SECONDS
                and _removed_at.get((project_id, actor_id), float("-inf")) < checked_at):
            room[(actor_id, tab_id)] = {"userId": actor_id, "displayName": name, "step": step, "seenAt": now}
        for key in [key for key, entry in room.items() if now - entry["seenAt"] > TTL_SECONDS]:
            del room[key]
        # 탭이 여러 개면 사람당 한 줄로 합치고, 가장 최근에 신호를 보낸 탭의 단계를 보여 줍니다.
        latest = {}
        for entry in sorted(room.values(), key=lambda entry: entry["seenAt"]):
            latest[entry["userId"]] = entry
        return [{"userId": e["userId"], "displayName": e["displayName"], "step": e["step"]} for e in latest.values()]


def leave(actor_id, project_id, tab_id=""):
    """프로젝트를 닫거나 전환한 탭만 바로 접속자 목록에서 뺍니다."""
    with _lock:
        _rooms.get(project_id, {}).pop((actor_id, tab_id), None)


@access_revoked.connect
def _drop_removed_member(sender, project_id, user_id, **_):
    # 멤버에서 빠진 사람의 모든 탭을 TTL을 기다리지 않고 바로 지웁니다(멤버 제외 커밋 뒤에 옵니다).
    now = time.monotonic()
    with _lock:
        _removed_at[(project_id, user_id)] = now
        # 오래된 제외 기록은 진행 중인 heartbeat가 없으니 지웁니다.
        for key in [key for key, at in _removed_at.items() if now - at > TTL_SECONDS]:
            del _removed_at[key]
        room = _rooms.get(project_id, {})
        for key in [key for key in room if key[0] == user_id]:
            del room[key]
