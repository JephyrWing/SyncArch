"""W04 요청의 구조·형식만 확인합니다. 객체 권한은 서비스가 판단합니다."""
from uuid import UUID

from werkzeug.exceptions import BadRequest


def object_fields(value, required, optional=()):
    if not isinstance(value, dict) or not set(required).issubset(value) or set(value) - set(required) - set(optional):
        raise BadRequest("요청 필드를 확인해 주세요.")
    return value


def text(value, maximum, *, allow_empty=False):
    if not isinstance(value, str) or len(value) > maximum or (not allow_empty and not value.strip()) or "\x00" in value:
        raise BadRequest("문자열 길이 또는 형식이 유효하지 않습니다.")
    return value.strip() if not allow_empty else value


def project_input(value):
    data = object_fields(value, ["title"], ["summary", "categoryTag", "targetDbms"])
    if data.get("targetDbms", "mariadb") != "mariadb":
        raise BadRequest("이번 저장 대상 DBMS는 mariadb입니다.")
    return {"title": text(data["title"], 120), "summary": text(data.get("summary", ""), 5000, allow_empty=True),
            "categoryTag": text(data.get("categoryTag", ""), 80, allow_empty=True)}


def clone_input(value):
    data = object_fields(value, ["sourceVersion", "title"])
    if type(data["sourceVersion"]) is not int or data["sourceVersion"] < 1:
        raise BadRequest("sourceVersion은 양의 정수여야 합니다.")
    return {"sourceVersion": data["sourceVersion"], "title": text(data["title"], 120)}


def archive_input(value):
    data = object_fields(value, ["archived"])
    if type(data["archived"]) is not bool:
        raise BadRequest("archived는 불리언이어야 합니다.")
    return data["archived"]


def member_input(value):
    data = object_fields(value, ["loginId"])
    login_id = text(data["loginId"], 100)
    if login_id != data["loginId"]:
        raise BadRequest("loginId 앞뒤에 공백을 넣지 마세요.")
    return login_id


def identifier(value):
    try:
        return str(UUID(value))
    except (ValueError, TypeError, AttributeError):
        raise BadRequest("ID 형식이 유효하지 않습니다.") from None


def archive_filter(value):
    if value not in {None, "true", "false", "all"}:
        raise BadRequest("archived는 true, false, all 중 하나여야 합니다.")
    return None if value == "all" else value == "true"
