"""실제 Redis의 OAuth state·이메일 challenge를 원자적으로 확인/소비합니다."""
from hashlib import sha256
import json

from ..errors import GoogleAuthenticationFailed, EmailVerificationFailed, VerificationRateLimited
from .token_repository import TokenRepository

OAUTH_CONSUME = """
local raw = redis.call('GET', KEYS[1])
if not raw then return false end
local record = cjson.decode(raw)
if record.binding ~= ARGV[1] then return false end
redis.call('DEL', KEYS[1])
return raw
"""
EMAIL_ACTIVATE = """
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local ttl = redis.call('PTTL', KEYS[1])
if ttl <= 0 then return 0 end
local record = cjson.decode(raw)
record.active = true
redis.call('SET', KEYS[1], cjson.encode(record), 'PX', ttl)
return 1
"""
EMAIL_CONSUME = """
local raw = redis.call('GET', KEYS[1])
if not raw then return false end
local record = cjson.decode(raw)
if not record.active or record.userId ~= ARGV[1] or record.sessionId ~= ARGV[2] then return false end
if record.codeHash ~= ARGV[3] then
    record.attempts = record.attempts + 1
    if record.attempts >= 5 then redis.call('DEL', KEYS[1])
    else
        local ttl = redis.call('PTTL', KEYS[1])
        if ttl > 0 then redis.call('SET', KEYS[1], cjson.encode(record), 'PX', ttl) end
    end
    return false
end
redis.call('DEL', KEYS[1])
return raw
"""


def digest(value):
    return sha256(value.encode()).hexdigest()


class AuthStateRepository(TokenRepository):
    def oauth_key(self, state):
        return self.prefix + "auth:oauth:google:" + digest(state)

    def email_key(self, challenge):
        return self.prefix + "auth:email:" + challenge

    def create_oauth(self, state, record):
        if not self._execute("set", self.oauth_key(state), json.dumps(record), nx=True, ex=300):
            raise GoogleAuthenticationFailed()

    def consume_oauth(self, state, binding):
        raw = self._execute("eval", OAUTH_CONSUME, 1, self.oauth_key(state), digest(binding))
        if not raw:
            raise GoogleAuthenticationFailed()
        return json.loads(raw)

    def create_email(self, challenge, record):
        cooldown = self.prefix + "auth:email:cooldown:" + record["userId"]
        if not self._execute("set", cooldown, "1", nx=True, ex=60):
            raise VerificationRateLimited()
        if not self._execute("set", self.email_key(challenge), json.dumps(record), nx=True, ex=600):
            raise EmailVerificationFailed()

    def activate_email(self, challenge):
        if self._execute("eval", EMAIL_ACTIVATE, 1, self.email_key(challenge)) != 1:
            raise EmailVerificationFailed()

    def discard_email(self, challenge):
        self._execute("delete", self.email_key(challenge))

    def consume_email(self, challenge, user_id, session_id, code_hash):
        raw = self._execute("eval", EMAIL_CONSUME, 1, self.email_key(challenge), user_id, session_id, code_hash)
        if not raw:
            raise EmailVerificationFailed()
        return json.loads(raw)
