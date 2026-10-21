"""기존 React 예시의 읽기 전용 스냅샷입니다. DB에는 자동 저장하지 않습니다."""
from copy import deepcopy
import json
from pathlib import Path

_PATH = Path(__file__).resolve().parents[1] / "data/project_templates.json"


def list_templates():
    return json.loads(_PATH.read_text(encoding="utf-8"))


def find_template(template_id):
    return next((deepcopy(t) for t in list_templates() if t["id"] == template_id), None)
