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


def register_error_handlers(app):
    @app.errorhandler(ApplicationError)
    def application_error(error):
        return jsonify(error={"code": error.code, "message": error.message}), error.status

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
