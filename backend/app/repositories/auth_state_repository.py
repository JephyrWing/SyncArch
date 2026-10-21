"""실제 Redis의 OAuth state를 원자적으로 확인/소비합니다."""
from hashlib import sha256
import json

from ..errors import GoogleAuthenticationFailed
from .token_repository import TokenRepository

OAUTH_CONSUME = """
local raw = redis.call('GET', KEYS[1])
if not raw then return false end
local record = cjson.decode(raw)
if record.binding ~= ARGV[1] then return false end
redis.call('DEL', KEYS[1])
return raw
"""


def digest(value):
    return sha256(value.encode()).hexdigest()


class AuthStateRepository(TokenRepository):
    def oauth_key(self, state):
        return self.prefix + "auth:oauth:google:" + digest(state)

    def create_oauth(self, state, record):
        if not self._execute("set", self.oauth_key(state), json.dumps(record), nx=True, ex=300):
            raise GoogleAuthenticationFailed()

    def consume_oauth(self, state, binding):
        raw = self._execute("eval", OAUTH_CONSUME, 1, self.oauth_key(state), digest(binding))
        if not raw:
            raise GoogleAuthenticationFailed()
        return json.loads(raw)
