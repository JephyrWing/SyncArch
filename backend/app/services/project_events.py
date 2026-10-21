"""커밋 후 W15에 전달하는 신호입니다. 소켓 전송은 W15에서 연결합니다."""
import logging
from blinker import Namespace

_signals = Namespace()
project_changed = _signals.signal("project-changed")
access_revoked = _signals.signal("project-access-revoked")


def publish(events):
    for signal, payload in events:
        try:
            signal.send("project-service", **payload)
        except Exception:
            # DB 커밋 뒤 알림 실패를 저장 실패로 바꾸거나 예외 원문을 노출하지 않습니다.
            logging.getLogger(__name__).error("Project notification failed after commit")
