from flask import Flask

from .config import load_config
from .extensions import db, migrate, init_auth


def create_app(test_config=None):
    app = Flask(__name__, static_folder=None)
    app.config.from_mapping(load_config())
    if test_config:
        app.config.update(test_config)
    app.json.ensure_ascii = False
    app.json.sort_keys = False
    db.init_app(app)
    migrate.init_app(app, db, compare_type=True)
    init_auth(app)

    # Import models so Flask-Migrate can discover their metadata.
    from . import models  # noqa: F401
    from .commands import register_commands
    register_commands(app)
    from .frontend import register_frontend
    register_frontend(app)

    from .errors import register_error_handlers
    from .routes.health import health
    from .routes.auth import auth
    from .routes.projects import projects
    from .routes.members import members
    from .routes.documents import documents
    app.register_blueprint(health)
    app.register_blueprint(auth)
    app.register_blueprint(projects)
    app.register_blueprint(members)
    app.register_blueprint(documents)
    register_error_handlers(app)

    return app
