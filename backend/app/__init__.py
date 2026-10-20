from flask import Flask, jsonify
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.exceptions import HTTPException

from .config import load_config
from .extensions import db, migrate


def create_app(test_config=None):
    app = Flask(__name__, static_folder=None)
    app.config.from_mapping(load_config())
    if test_config:
        app.config.update(test_config)
    app.json.ensure_ascii = False
    app.json.sort_keys = False
    db.init_app(app)
    migrate.init_app(app, db, compare_type=True)

    # Import models so Flask-Migrate can discover their metadata.
    from . import models  # noqa: F401
    from .commands import register_commands
    register_commands(app)
    from .frontend import register_frontend
    register_frontend(app)

    # Register blueprints here when the existing API specification is connected.

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
        # Exception messages can contain SQL, bound parameters and credentials.
        app.logger.error("Database operation failed (%s)", type(error).__name__)
        return jsonify(error={"code": "DB_UNAVAILABLE", "message": "데이터베이스 작업에 실패했습니다."}), 503

    @app.errorhandler(500)
    def server_error(error):
        return jsonify(error={"code": "INTERNAL_ERROR", "message": "서버 내부 오류가 발생했습니다."}), 500

    return app
