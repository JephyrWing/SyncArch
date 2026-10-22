"""초대 코드·접속 표시·채팅 요청의 구조만 확인합니다. 객체 권한은 서비스가 판단합니다."""
from datetime import datetime

from werkzeug.exceptions import BadRequest

from .project_schema import object_fields, text, identifier


def code_input(value):
    # 화면에는 ABCD-EFGH로 보여 주므로 하이픈·공백·소문자로 입력해도 받습니다.
    code = "".join(ch for ch in text(object_fields(value, ["code"])["code"], 20).upper() if ch.isalnum())
    if not code:
        raise BadRequest("초대 코드를 입력해 주세요.")
    return code


def presence_input(value):
    data = object_fields(value, ["step"], ["tabId"])
    step = data["step"]
    if type(step) is not int or step not in (1, 2, 3, 4):
        raise BadRequest("step은 1~4 중 하나여야 합니다.")
    return step, tab_input(data.get("tabId"))


def tab_input(value):
    # 같은 사람이 연 탭을 따로 세어, 한 탭을 닫아도 다른 탭의 접속 표시는 남깁니다. 없으면 예전처럼 사람 하나로 봅니다.
    return "" if value is None else text(value, 64)


def message_input(value):
    data = object_fields(value, ["body"], ["messageId"])
    return text(data["body"], 1000), identifier(data['messageId']) if 'messageId' in data else None


def after_input(value, since):
    if value is None: return None
    if since is None: raise BadRequest('afterId에는 since 시각이 필요합니다.')
    return identifier(value)


def since_input(value):
    if value is None:
        return None
    try:
        return datetime.fromisoformat(value.removesuffix("Z"))
    except ValueError:
        raise BadRequest("since는 ISO 8601 시각이어야 합니다.") from None
