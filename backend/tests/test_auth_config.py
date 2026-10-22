"""인증 설정의 실행 환경 경계를 검증합니다."""
import pytest

from app.config import load_config


def test_demo_supports_user_selected_non_tls_redis(monkeypatch):
    for name, value in {
        "APP_ENV": "demo", "SECRET_KEY": "test-only-" * 8,
        "TRUSTED_HOSTS": "demo.example.test", "DB_PASSWORD": "test-only",
        "JWT_SECRET_KEY": "jwt-test-only-" * 8,
        "REDIS_URL": "redis://default:test@redis.example.test:12345/0",
        "ALLOWED_ORIGINS": "https://demo.example.test",
    }.items():
        monkeypatch.setenv(name, value)
    config = load_config()
    assert config["REDIS_URL"].startswith("redis://")
    assert config["JWT_COOKIE_SECURE"] is True
    monkeypatch.delenv("JWT_SECRET_KEY")
    with pytest.raises(ValueError, match="JWT_SECRET_KEY"):
        load_config()


@pytest.mark.parametrize("value", ["https://example.test", "redis://default:test@host:12345/0#fragment",
                                   "redis://default:test@host:invalid/0", "redis://host:12345/0"])
def test_invalid_redis_settings_do_not_echo_credentials(monkeypatch, value):
    monkeypatch.setenv("REDIS_URL", value)
    with pytest.raises(ValueError) as failure:
        load_config()
    assert value not in str(failure.value)


@pytest.mark.parametrize("value", ["*", "https://example.test/path", "null", "https://user:pass@example.test"])
def test_allowed_origins_must_be_exact(monkeypatch, value):
    monkeypatch.setenv("ALLOWED_ORIGINS", value)
    with pytest.raises(ValueError, match="ALLOWED_ORIGINS"):
        load_config()
