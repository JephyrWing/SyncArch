"""Common JSON errors; exception details must never reach clients or logs."""
from flask import jsonify
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.exceptions import HTTPException

from .extensions import db


class ApplicationError(Exception):
    code = "INTERNAL_ERROR"
    message = "서버 내부 오류가 발생했습니다."
    status = 500


class SeedConflict(ApplicationError):
    code = "SEED_CONFLICT"
    message = "기존 계정 정보가 초기 계정 정의와 다릅니다. 기존 계정은 변경하지 않았습니다."
    status = 409


class AuthenticationRequired(ApplicationError):
    code = "AUTH_REQUIRED"
    message = "로그인이 필요하거나 인증 정보가 유효하지 않습니다."
    status = 401


class AuthenticationUnavailable(ApplicationError):
    code = "AUTH_UNAVAILABLE"
    message = "인증 상태를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요."
    status = 503


class GoogleAuthenticationFailed(AuthenticationRequired):
    code = "GOOGLE_AUTH_FAILED"
    message = "Google 인증을 완료하지 못했습니다. 로그인 과정을 다시 시작해 주세요."


class GoogleLinkRequired(ApplicationError):
    code = "GOOGLE_LINK_REQUIRED"
    message = "기존 계정의 이메일을 등록하거나 로그인 후 Google 계정을 연결해 주세요."
    status = 409


class IdentityConflict(ApplicationError):
    code = "IDENTITY_CONFLICT"
    message = "이미 연결된 계정 또는 이메일과 충돌합니다. 기존 연결을 확인해 주세요."
    status = 409


class CsrfFailed(ApplicationError):
    code = "CSRF_FAILED"
    message = "요청 출처 또는 CSRF 정보가 유효하지 않습니다."
    status = 400


class ProjectNotFound(ApplicationError):
    code = "NOT_FOUND"
    message = "프로젝트를 찾을 수 없습니다."
    status = 404


class Forbidden(ApplicationError):
    code = "FORBIDDEN"
    message = "이 작업을 수행할 권한이 없습니다."
    status = 403


class ProjectArchived(Forbidden):
    code = "PROJECT_ARCHIVED"
    message = "보관된 프로젝트는 변경할 수 없습니다."


class VersionConflict(ApplicationError):
    code = "VERSION_CONFLICT"
    message = "프로젝트 버전이 변경되었습니다. 최신 문서를 확인해 주세요."
    status = 409

    def __init__(self, version):
        self.details = {"currentVersion": version}


class DocumentValidationError(ApplicationError):
    code = "VALIDATION_FAILED"
    message = "문서의 필드와 참조를 확인해 주세요."
    status = 422

    def __init__(self, path, reason):
        self.details = {"fieldErrors": [{"path": path, "message": reason}]}


class IdempotencyKeyReused(ApplicationError):
    code = "IDEMPOTENCY_KEY_REUSED"
    message = "다른 요청에서 사용한 mutationId입니다. 새 mutationId를 사용해 주세요."
    status = 409


class InviteCodeNotFound(ApplicationError):
    code = "NOT_FOUND"
    message = "초대 코드가 올바르지 않습니다. 팀장에게 최신 코드를 받아 다시 입력해 주세요."
    status = 404


class UserNotFound(ApplicationError):
    code = "USER_NOT_FOUND"
    message = "추가할 수 있는 기존 사용자를 찾을 수 없습니다."
    status = 404


def register_error_handlers(app):
    @app.errorhandler(ApplicationError)
    def application_error(error):
        return jsonify(error={"code": error.code, "message": error.message,
                              **getattr(error, "details", {})}), error.status

    @app.errorhandler(HTTPException)
    def http_error(error):
        codes = {
            400: "BAD_REQUEST", 401: "AUTH_REQUIRED", 403: "FORBIDDEN",
            404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED", 409: "VERSION_CONFLICT",
            413: "DOCUMENT_TOO_LARGE", 422: "VALIDATION_FAILED",
            429: "TOO_MANY_REQUESTS", 503: "DB_UNAVAILABLE",
        }
        response = error.get_response()
        response.data = app.json.dumps({"error": {
            "code": codes.get(error.code, "INTERNAL_ERROR" if error.code >= 500 else "BAD_REQUEST"),
            "message": "서버 내부 오류가 발생했습니다." if error.code >= 500 else error.description,
        }})
        response.content_type = "application/json"
        return response

    @app.errorhandler(SQLAlchemyError)
    def database_error(error):
        db.session.rollback()
        app.logger.error("Database operation failed (%s)", type(error).__name__)
        return jsonify(error={"code": "DB_UNAVAILABLE", "message": "데이터베이스 작업에 실패했습니다."}), 503

    @app.errorhandler(500)
    def server_error(error):
        return jsonify(error={"code": "INTERNAL_ERROR", "message": "서버 내부 오류가 발생했습니다."}), 500
