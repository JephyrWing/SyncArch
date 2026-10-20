from flask import Flask, jsonify
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.exceptions import HTTPException

from .config import load_config
from .extensions import db, migrate


def create_app(test_config=None):
    app = Flask(__name__)
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

    # Register blueprints here when the existing API specification is connected.

    @app.errorhandler(HTTPException)
    def http_error(error):
        return jsonify(error={"code": error.code, "message": error.description}), error.code

    @app.errorhandler(SQLAlchemyError)
    def database_error(error):
        db.session.rollback()
        app.logger.exception("Database operation failed")
        return jsonify(error={"code": 503, "message": "데이터베이스 작업에 실패했습니다."}), 503

    @app.errorhandler(500)
    def server_error(error):
        return jsonify(error={"code": 500, "message": "서버 내부 오류가 발생했습니다."}), 500

    return app
