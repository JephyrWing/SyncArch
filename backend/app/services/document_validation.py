"""이전 저장본과 비교하는 작성자 보호·트리·교차 참조 업무 규칙입니다."""
from copy import deepcopy
import re

from ..schemas.document_schema import AREAS, COMPATIBILITY, fail, uuid


def _index(items):
    return {item["id"]: item for item in items}


def _new_ids(items, previous, path):
    seen = set()
    for item in items:
        if item["id"] in seen:
            fail(path, "종류 내 ID가 중복됩니다.")
        seen.add(item["id"])
        if item["id"] not in previous and uuid(item["id"], path + ".id") != item["id"]:
            fail(path + ".id", "새 ID는 표준 UUID 문자열이어야 합니다.")


def _immutable(item, old, keys, path):
    for key in keys:
        if item.get(key) != old.get(key):
            fail(path + "." + key, "기존 작성자와 시각·호환 기록을 조작할 수 없습니다.")


def _identity(item, actor_id, actor_name, path):
    if item.get("authorId", actor_id) != actor_id or item.get("author", actor_name) != actor_name:
        fail(path + ".authorId", "새 작성자는 인증 사용자여야 합니다.")
    item["authorId"] = actor_id


def _ideas(payload, previous, actor_id, actor_name, now):
    old_ideas, ideas = _index(previous["ideas"]), _index(payload["ideas"])
    all_comment_ids = set()
    for idea in ideas.values():
        path = "payload.ideas." + idea["id"]
        old = old_ideas.get(idea["id"])
        if old is not None:
            _immutable(idea, old, ("authorId", "author", "votedBy", "votes"), path)
        else:
            _identity(idea, actor_id, actor_name, path)
            if idea.get("votedBy") or idea.get("votes", 0):
                fail(path, "새 투표에는 voterIds를 사용해 주세요.")
        old_voters = set(old.get("voterIds", [])) if old else set()
        if (set(idea["voterIds"]) ^ old_voters) - {actor_id}:
            fail(path + ".voterIds", "본인 투표만 추가하거나 제거할 수 있습니다.")
        if idea.get("decisionStatus") in {"ACCEPTED", "DEFERRED"} and not idea.get("decisionReason", "").strip():
            fail(path + ".decisionReason", "채택과 보류에는 이유가 필요합니다.")
        changed_decision = old is None or any(idea.get(k) != old.get(k) for k in ("decisionStatus", "decisionReason"))
        if changed_decision and ("decisionStatus" in idea or "decidedBy" in idea):
            if idea.get("decidedBy", actor_id) != actor_id:
                fail(path + ".decidedBy", "결정자는 인증 사용자여야 합니다.")
            idea["decidedBy"] = actor_id
        elif old:
            _immutable(idea, old, ("decidedBy",), path)
        old_comments = _index(old.get("comments", [])) if old else {}
        _new_ids(idea["comments"], old_comments, path + ".comments")
        new_comments = _index(idea["comments"])
        for comment in idea["comments"]:
            cp = path + ".comments." + comment["id"]
            if comment["id"] in all_comment_ids:
                fail(cp, "문서 내 댓글 ID가 중복됩니다.")
            all_comment_ids.add(comment["id"])
            old_comment = old_comments.get(comment["id"])
            if old_comment:
                _immutable(comment, old_comment, ("authorId", "author", "createdAt"), cp)
                if comment != old_comment and old_comment.get("authorId") != actor_id:
                    fail(cp, "다른 작성자의 댓글은 수정할 수 없습니다.")
            else:
                _identity(comment, actor_id, actor_name, cp)
                comment["createdAt"] = now
        if any(old_comments[cid].get("authorId") != actor_id for cid in old_comments.keys() - new_comments.keys()):
            fail(path + ".comments", "다른 작성자의 댓글은 개별 삭제할 수 없습니다.")
        parent = idea["parentIdeaId"]
        if parent is not None:
            if parent not in ideas or parent == idea["id"]:
                fail(path + ".parentIdeaId", "현재 문서의 다른 아이디어를 부모로 지정해 주세요.")
            if idea["category"] != ideas[parent]["category"]:
                fail(path + ".category", "하위 아이디어 분류는 부모와 같아야 합니다.")
    # 반복 DFS로 깊은 트리에서도 Python 재귀 제한을 피합니다.
    checked = set()
    for start in ideas:
        chain, current = set(), start
        while current is not None and current not in checked:
            if current in chain:
                fail("payload.ideas.parentIdeaId", "아이디어 트리에 순환이 있습니다.")
            chain.add(current)
            current = ideas[current]["parentIdeaId"]
        checked.update(chain)


def _sql_name(value, path):
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]{0,63}", value):
        fail(path, "SQL 이름은 영문/밑줄로 시작하는 영문·숫자·밑줄 64자 이하여야 합니다.")


def _type_signature(column):
    return tuple(column.get(k) for k in ("dataType", "length", "precision", "scale"))


def _references(payload, previous):
    ideas, features, nodes = (_index(payload[a]) for a in ("ideas", "features", "nodes"))
    for feature in features.values():
        if feature.get("relatedStoryId") and feature["relatedStoryId"] not in ideas:
            fail("payload.features." + feature["id"] + ".relatedStoryId", "연결된 아이디어가 없습니다.")
    for connection in payload["connections"]:
        if connection["sourceId"] not in nodes or connection["targetId"] not in nodes:
            fail("payload.connections." + connection["id"], "연결선의 출발/도착 노드가 없습니다.")
    tables, columns_by_id = {}, {}
    old_columns = {c["id"]: c for t in previous["tables"] for c in t["columns"]}
    for table in payload["tables"]:
        path = "payload.tables." + table["id"]
        _sql_name(table["name"], path + ".name")
        name = table["name"].lower()
        if name in tables:
            fail(path + ".name", "테이블 이름이 중복됩니다.")
        tables[name] = table
        _new_ids(table["columns"], old_columns, path + ".columns")
        names = set()
        if sum(c["isPrimaryKey"] for c in table["columns"]) > 1:
            fail(path + ".columns", "단일 컬럼 PK만 지원합니다.")
        for column in table["columns"]:
            cp = path + ".columns." + column["id"]
            _sql_name(column["name"], cp + ".name")
            if column["name"].lower() in names or column["id"] in columns_by_id:
                fail(cp, "컬럼 이름 또는 문서 내 컬럼 ID가 중복됩니다.")
            names.add(column["name"].lower())
            columns_by_id[column["id"]] = column
            if column["isPrimaryKey"] and column["isNullable"]:
                fail(cp + ".isNullable", "PK는 NULL을 허용하지 않습니다.")
            if column.get("relatedFeatureId") and column["relatedFeatureId"] not in features:
                fail(cp + ".relatedFeatureId", "연결된 기능이 없습니다.")
            default = column.get("defaultValue", "")
            if default and not re.fullmatch(r"NULL|TRUE|FALSE|CURRENT_TIMESTAMP(?:\([0-6]\))?|-?\d+(?:\.\d+)?|'(?:[^'\\\x00]|'')*'", default, re.IGNORECASE):
                fail(cp + ".defaultValue", "허용된 기본값 리터럴만 사용해 주세요.")
            if default.upper() == "NULL" and not column["isNullable"]:
                fail(cp + ".defaultValue", "NOT NULL 컬럼에는 NULL 기본값을 지정할 수 없습니다.")
        if set(table.get("relatedFeatureIds", [])) - features.keys():
            fail(path + ".relatedFeatureIds", "연결된 기능이 없습니다.")
    for table in payload["tables"]:
        for column in table["columns"]:
            path = "payload.tables." + table["id"] + ".columns." + column["id"]
            reference = column.get("references", "")
            if bool(reference) != column["isForeignKey"]:
                fail(path + ".references", "FK 여부와 참조를 함께 변경해 주세요.")
            if not reference:
                continue
            parts = reference.lower().split(".")
            target_table = tables.get(parts[0]) if len(parts) == 2 else None
            target = next((c for c in target_table["columns"] if c["name"].lower() == parts[1]), None) if target_table else None
            if target is None or not (target["isPrimaryKey"] or target["isUnique"]):
                fail(path + ".references", "같은 문서의 PK 또는 고유 컬럼을 참조해 주세요.")
            if _type_signature(column) != _type_signature(target):
                fail(path + ".dataType", "FK와 참조 컬럼의 자료형·길이·정밀도가 달라요.")


def validate_transition(payload, previous, actor_id, actor_name, now):
    result = deepcopy(payload)
    for key in COMPATIBILITY:
        if result.get(key) != previous.get(key):
            fail("payload." + key, "이전 호환 읽기 필드는 변경할 수 없습니다.")
    for area in AREAS:
        _new_ids(result[area], _index(previous[area]), "payload." + area)
    _ideas(result, previous, actor_id, actor_name, now)
    _references(result, previous)
    return result


def changes_between(before, after, old_project, new_project):
    changes = []
    if old_project != new_project:
        changes.append({"area": "project", "entityType": "project", "entityId": old_project["id"],
                        "label": new_project["title"], "action": "updated"})
    for area in AREAS:
        old, new = _index(before[area]), _index(after[area])
        for entity_id in sorted(old.keys() | new.keys()):
            action = "created" if entity_id not in old else "deleted" if entity_id not in new else "updated"
            if entity_id in old and entity_id in new and old[entity_id] == new[entity_id]:
                continue
            item = new.get(entity_id, old.get(entity_id))
            changes.append({"area": area, "entityType": area[:-1] if area != "ideas" else "idea", "entityId": entity_id,
                            "label": item.get("title", item.get("name", item.get("label", entity_id))), "action": action})
        nested_key = "comments" if area == "ideas" else "columns" if area == "tables" else None
        if nested_key:
            old_nested = {child["id"]: child for parent in old.values() for child in parent.get(nested_key, [])}
            new_nested = {child["id"]: child for parent in new.values() for child in parent.get(nested_key, [])}
            for child_id in sorted(old_nested.keys() | new_nested.keys()):
                if old_nested.get(child_id) == new_nested.get(child_id):
                    continue
                child = new_nested.get(child_id, old_nested.get(child_id))
                changes.append({"area": area, "entityType": "comment" if area == "ideas" else "column",
                    "entityId": child_id, "label": child.get("name", child.get("text", child_id))[:120],
                    "action": "created" if child_id not in old_nested else "deleted" if child_id not in new_nested else "updated"})
    return changes
