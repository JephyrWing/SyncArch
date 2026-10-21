from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from redis import Redis

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()


def init_auth(app):
    from .auth import register_jwt_callbacks
    from .repositories.token_repository import TokenRepository

    jwt.init_app(app)
    # 연결은 실제 인증 요청 때 수행합니다. health/마이그레이션은 Redis와 독립입니다.
    client = Redis.from_url(app.config["REDIS_URL"], decode_responses=True,
                            socket_connect_timeout=3, socket_timeout=3,
                            retry_on_timeout=False) if app.config["REDIS_URL"] else None
    app.extensions["token_repository"] = TokenRepository(client, app.config["REDIS_KEY_PREFIX"])
    register_jwt_callbacks(jwt, app)
    from .services.google_provider import GoogleProvider
    from .services.mail_service import SmtpMailer
    app.extensions["google_provider"] = GoogleProvider(app.config)
    app.extensions["verification_mailer"] = SmtpMailer(app.config)
