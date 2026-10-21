"""Redis 세션 저장과 원자적 RT 회전. 실제 토큰 대신 jti의 해시만 저장합니다."""
from hashlib import sha256
from time import time

from redis.exceptions import RedisError

from ..errors import AuthenticationRequired, AuthenticationUnavailable


ROTATE = """
local values = redis.call('HMGET', KEYS[1], 'userId', 'jtiHash', 'status')
if not values[1] or values[1] ~= ARGV[1] or values[3] ~= 'active' then return 0 end
if values[2] ~= ARGV[2] then
    redis.call('HSET', KEYS[1], 'status', 'revoked')
    return -1
end
redis.call('HSET', KEYS[1], 'jtiHash', ARGV[3])
return 1
"""
CREATE = """
if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
redis.call('HSET', KEYS[1], 'userId', ARGV[1], 'jtiHash', ARGV[2],
           'status', 'active', 'expiresAt', ARGV[3])
redis.call('EXPIREAT', KEYS[1], ARGV[3])
return 1
"""
REVOKE = """
if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end
redis.call('HSET', KEYS[1], 'status', 'revoked')
return 1
"""


class TokenRepository:
    def __init__(self, client, prefix="syncarch:"):
        self.client = client
        self.prefix = prefix

    def _key(self, session_id):
        return f"{self.prefix}auth:rt:{session_id}"

    def _execute(self, command, *args, **kwargs):
        if self.client is None:
            raise AuthenticationUnavailable()
        try:
            return getattr(self.client, command)(*args, **kwargs)
        except RedisError:
            # Redis 오류에는 접속 정보가 포함될 수 있으므로 원문을 전달하지 않습니다.
            raise AuthenticationUnavailable() from None

    def create(self, session_id, user_id, jti, expires_at):
        if self._execute("eval", CREATE, 1, self._key(session_id), user_id,
                         sha256(jti.encode()).hexdigest(), expires_at) != 1:
            raise AuthenticationUnavailable()

    def is_active(self, session_id, user_id):
        values = self._execute("hmget", self._key(session_id), "userId", "status", "expiresAt")
        try:
            return (values[0] == user_id and values[1] == "active"
                    and values[2] is not None and int(values[2]) > time())
        except (ValueError, TypeError):
            raise AuthenticationUnavailable() from None

    def rotate(self, session_id, user_id, old_jti, new_jti):
        result = self._execute("eval", ROTATE, 1, self._key(session_id), user_id,
                               sha256(old_jti.encode()).hexdigest(), sha256(new_jti.encode()).hexdigest())
        if result != 1:
            raise AuthenticationRequired()

    def revoke(self, session_id):
        self._execute("eval", REVOKE, 1, self._key(session_id))
