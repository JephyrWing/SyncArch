"""Google code 교환과 공식 google-auth의 서명·claims 검증 경계입니다."""
import base64
from hashlib import sha256
import hmac
import re
from urllib.parse import urlencode

from google.auth.exceptions import GoogleAuthError, TransportError
from google.auth.transport.requests import Request
from google.oauth2.id_token import verify_oauth2_token
import requests

from ..errors import AuthenticationUnavailable, GoogleAuthenticationFailed
from ..schemas.social_schema import normalize_email


class GoogleProvider:
    def __init__(self, config):
        self.client_id = config["GOOGLE_CLIENT_ID"]
        self.client_secret = config["GOOGLE_CLIENT_SECRET"]
        self.redirect_uri = config["GOOGLE_REDIRECT_URI"]

    def authorization_url(self, state, nonce, verifier):
        challenge = base64.urlsafe_b64encode(sha256(verifier.encode("ascii")).digest()).rstrip(b"=").decode("ascii")
        return "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode({"client_id": self.client_id,
            "redirect_uri": self.redirect_uri, "response_type": "code", "scope": "openid email profile",
            "state": state, "nonce": nonce, "code_challenge": challenge, "code_challenge_method": "S256",
            "prompt": "select_account"})

    def exchange(self, code, verifier, nonce):
        try:
            response = requests.post("https://oauth2.googleapis.com/token", data={
                "grant_type": "authorization_code", "code": code, "code_verifier": verifier,
                "client_id": self.client_id, "client_secret": self.client_secret, "redirect_uri": self.redirect_uri},
                timeout=5, allow_redirects=False)
            if response.status_code >= 500 or response.status_code == 429:
                raise AuthenticationUnavailable()
            if response.status_code != 200 or len(response.content) > 65536:
                raise GoogleAuthenticationFailed()
            encoded = response.json().get("id_token")
            return self.verify(encoded, nonce)
        except requests.RequestException:
            raise AuthenticationUnavailable() from None
        except (ValueError, TypeError, AttributeError):
            raise GoogleAuthenticationFailed() from None

    def verify(self, encoded, nonce):
        if not isinstance(encoded, str) or len(encoded) > 16384:
            raise GoogleAuthenticationFailed()
        try:
            with requests.Session() as session:
                transport = Request(session=session)
                def bounded_request(*args, **kwargs):
                    kwargs["timeout"] = 5
                    return transport(*args, **kwargs)
                claims = verify_oauth2_token(encoded, bounded_request, self.client_id)
            actual_nonce = claims.get("nonce")
            if (not isinstance(actual_nonce, str) or not hmac.compare_digest(actual_nonce, nonce) or
                    claims.get("aud") != self.client_id or claims.get("azp", self.client_id) != self.client_id or
                    not isinstance(claims.get("sub"), str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,255}", claims["sub"])):
                raise GoogleAuthenticationFailed()
            # 이메일은 표시용이어도 DB 길이·자료형을 확인합니다. 계정 키는 검증된 sub입니다.
            if claims.get("email") is not None:
                claims["email"], _ = normalize_email(claims["email"])
            return claims
        except TransportError:
            raise AuthenticationUnavailable() from None
        except (GoogleAuthError, ValueError, TypeError, KeyError):
            raise GoogleAuthenticationFailed() from None
