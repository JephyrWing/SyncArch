"""비밀값을 출력하지 않고 실제 Redis에 연결해 격리된 인증 검증을 실행합니다."""
import argparse
import os
from pathlib import Path
import subprocess
import sys
from uuid import uuid4

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mariadb-bin", type=Path)
    parser.add_argument("--junitxml", type=Path, required=True)
    args = parser.parse_args()
    redis_url = os.getenv("TEST_REDIS_URL") or dotenv_values(ROOT / "backend/.env").get("REDIS_URL")
    if not redis_url:
        parser.error("TEST_REDIS_URL 또는 backend/.env의 REDIS_URL이 필요합니다.")
    environment = os.environ.copy()
    environment["TEST_REDIS_URL"] = redis_url
    environment["PYTHONIOENCODING"] = "utf-8"
    local = ROOT / ".local"
    local.mkdir(exist_ok=True)
    if args.mariadb_bin:
        command = [sys.executable, str(ROOT / "backend/scripts/verify_mariadb.py"),
                   "--bin-dir", str(args.mariadb_bin.resolve()), "--junitxml", str(args.junitxml.resolve())]
    else:
        command = [sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider", "-c", "backend/pytest.ini",
                   "backend/tests", "--basetemp", str(local / ("pytest-w03-" + uuid4().hex)),
                   "--junitxml", str(args.junitxml.resolve())]
    return subprocess.run(command, cwd=ROOT, env=environment).returncode


if __name__ == "__main__":
    raise SystemExit(main())
