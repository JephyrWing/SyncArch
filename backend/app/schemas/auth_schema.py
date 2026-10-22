"""로그인과 신규 가입의 입력을 각각 검사합니다."""
from werkzeug.exceptions import BadRequest

from .social_schema import email as parse_email


def parse_registration(value):
    required = {"loginId", "displayName", "password"}
    if not isinstance(value, dict) or not required <= set(value) or set(value) - required - {"email"}:
        raise BadRequest("아이디, 이름, 비밀번호와 선택 이메일만 입력해 주세요.")
    login_id, display_name, password = value["loginId"], value["displayName"], value["password"]
    if not isinstance(login_id, str) or not 1 <= len(login_id.strip()) <= 100:
        raise BadRequest("아이디는 공백을 제외하고 1~100자로 입력해 주세요.")
    if not isinstance(display_name, str) or not 1 <= len(display_name.strip()) <= 80:
        raise BadRequest("이름은 공백을 제외하고 1~80자로 입력해 주세요.")
    if not isinstance(password, str) or not 8 <= len(password) <= 128:
        raise BadRequest("새 비밀번호는 8~128자로 입력해 주세요.")
    address, normalized = parse_email(value["email"]) if "email" in value else (None, None)
    return {"login_id": login_id.strip(), "display_name": display_name.strip(),
            "password": password, "email": address, "email_normalized": normalized}


def parse_login(value):
    if not isinstance(value, dict) or set(value) != {"loginId", "password"}:
        raise BadRequest("loginId와 password만 입력해 주세요.")
    login_id, password = value["loginId"], value["password"]
    if not isinstance(login_id, str) or not 1 <= len(login_id) <= 100 or login_id != login_id.strip():
        raise BadRequest("로그인 ID 형식이 유효하지 않습니다.")
    if not isinstance(password, str) or not 1 <= len(password) <= 128:
        raise BadRequest("비밀번호 형식이 유효하지 않습니다.")
    return login_id, password
