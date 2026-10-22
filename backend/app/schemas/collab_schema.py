"""초대 코드·접속 표시·채팅 요청의 구조만 확인합니다. 객체 권한은 서비스가 판단합니다."""
from datetime import datetime

from werkzeug.exceptions import BadRequest

from .project_schema import object_fields, text


def code_input(value):
    # 화면에는 ABCD-EFGH로 보여 주므로 하이픈·공백·소문자로 입력해도 받습니다.
    code = "".join(ch for ch in text(object_fields(value, ["code"])["code"], 20).upper() if ch.isalnum())
    if not code:
        raise BadRequest("초대 코드를 입력해 주세요.")
    return code


def step_input(value):
    step = object_fields(value, ["step"])["step"]
    if type(step) is not int or step not in (1, 2, 3, 4):
        raise BadRequest("step은 1~4 중 하나여야 합니다.")
    return step


def message_input(value):
    return text(object_fields(value, ["body"])["body"], 1000)


def since_input(value):
    if value is None:
        return None
    try:
        return datetime.fromisoformat(value.removesuffix("Z"))
    except ValueError:
        raise BadRequest("since는 ISO 8601 시각이어야 합니다.") from None
