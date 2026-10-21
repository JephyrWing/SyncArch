"""로그인 입력에는 계정과 비밀번호만 허용합니다."""
from werkzeug.exceptions import BadRequest


def parse_login(value):
    if not isinstance(value, dict) or set(value) != {"loginId", "password"}:
        raise BadRequest("loginId와 password만 입력해 주세요.")
    login_id, password = value["loginId"], value["password"]
    if not isinstance(login_id, str) or not 1 <= len(login_id) <= 100 or login_id != login_id.strip():
        raise BadRequest("로그인 ID 형식이 유효하지 않습니다.")
    if not isinstance(password, str) or not 1 <= len(password) <= 128:
        raise BadRequest("비밀번호 형식이 유효하지 않습니다.")
    return login_id, password
