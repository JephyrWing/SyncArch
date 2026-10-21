"""외부 인증·메일 환경변수를 검증합니다. 실제 값은 오류에 넣지 않습니다."""
import os
from urllib.parse import urlsplit


def flag(name, default=False):
    value = os.getenv(name, "true" if default else "false").lower()
    if value not in {"true", "false", "1", "0"}:
        raise ValueError(name + " must be true or false")
    return value in {"true", "1"}


def external_config(app_env, origins):
    enabled = flag("GOOGLE_OAUTH_ENABLED")
    client_id, client_secret = os.getenv("GOOGLE_CLIENT_ID", ""), os.getenv("GOOGLE_CLIENT_SECRET", "")
    uri = os.getenv("GOOGLE_REDIRECT_URI", "")
    front_origin = ""
    if enabled:
        parsed = urlsplit(uri)
        front_origin = parsed.scheme + "://" + parsed.netloc
        valid_http = app_env == "development" and parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1", "::1"}
        if (not client_id.endswith(".apps.googleusercontent.com") or not client_secret or
                not (parsed.scheme == "https" or valid_http) or front_origin not in origins or
                parsed.path != "/api/auth/google/callback" or parsed.query or parsed.fragment or parsed.username):
            raise ValueError("Google OAuth requires credentials and an allowed exact callback URI")
    smtp_ssl, starttls = flag("SMTP_SSL"), flag("SMTP_STARTTLS", True)
    port = int(os.getenv("SMTP_PORT", "587"))
    if not 1 <= port <= 65535 or (smtp_ssl and starttls):
        raise ValueError("SMTP port or TLS options are invalid")
    if app_env == "demo" and os.getenv("SMTP_HOST") and not (smtp_ssl or starttls):
        raise ValueError("demo SMTP requires TLS")
    sender = os.getenv("SMTP_FROM", "")
    if "\r" in sender or "\n" in sender:
        raise ValueError("SMTP_FROM contains invalid characters")
    return {"GOOGLE_OAUTH_ENABLED": enabled, "GOOGLE_CLIENT_ID": client_id,
        "GOOGLE_CLIENT_SECRET": client_secret, "GOOGLE_REDIRECT_URI": uri,
        "AUTH_FRONTEND_ORIGIN": front_origin,
        "SMTP_HOST": os.getenv("SMTP_HOST", ""), "SMTP_PORT": port,
        "SMTP_USERNAME": os.getenv("SMTP_USERNAME", ""), "SMTP_PASSWORD": os.getenv("SMTP_PASSWORD", ""),
        "SMTP_FROM": sender, "SMTP_SSL": smtp_ssl, "SMTP_STARTTLS": starttls}
