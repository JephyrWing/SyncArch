"""외부 인증 입력 형식입니다. 이메일 주소는 ASCII 정책으로 정규화합니다."""
import re

from werkzeug.exceptions import BadRequest


def fields(value, keys):
    if not isinstance(value, dict) or set(value) != set(keys):
        raise BadRequest("요청 필드를 확인해 주세요.")
    return value


def password(value):
    if not isinstance(value, str) or not 1 <= len(value) <= 128:
        raise BadRequest("비밀번호를 확인해 주세요.")
    return value


def normalize_email(value):
    if not isinstance(value, str):
        raise ValueError("이메일 형식을 확인해 주세요.")
    value = value.strip()
    if (len(value) > 254 or not value.isascii() or value.count("@") != 1 or
            not re.fullmatch(r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,63}", value)):
        raise ValueError("ASCII 이메일 주소를 입력해 주세요.")
    local, domain = value.split("@")
    if len(local) > 64 or local.startswith(".") or local.endswith(".") or ".." in value or any(
            label.startswith("-") or label.endswith("-") or len(label) > 63 for label in domain.split(".")):
        raise ValueError("이메일 형식을 확인해 주세요.")
    return value, value.lower()


def email(value):
    try:
        return normalize_email(value)
    except ValueError as error:
        raise BadRequest(str(error)) from None


def email_input(value):
    fields(value, ("email", "password"))
    return email(value["email"])[0], password(value["password"])
