"""Validate explicitly supplied credentials without echoing their values."""
import json

ACCOUNTS = {
    "choi_jinwoo": "최진우",
    "jeon_seolmin": "전설민",
    "maeng_dongyeong": "맹동영",
    "kim_donghyeon": "김동현",
    "shin_osim": "신오심",
}


def parse_seed_passwords(raw):
    try:
        def unique_keys(pairs):
            result = {}
            for key, value in pairs:
                if key in result:
                    raise ValueError()
                result[key] = value
            return result

        passwords = json.loads(raw, object_pairs_hook=unique_keys)
        if not isinstance(passwords, dict) or set(passwords) != set(ACCOUNTS):
            raise ValueError()
        if any(not isinstance(p, str) or not 12 <= len(p) <= 128 or not p.strip()
               for p in passwords.values()):
            raise ValueError()
        if len(set(passwords.values())) != len(ACCOUNTS):
            raise ValueError()
    except (ValueError, TypeError, RecursionError):
        raise ValueError("SEED_ACCOUNT_PASSWORDS requires five distinct passwords (12–128 characters), keyed by the documented login IDs.") from None
    return passwords
