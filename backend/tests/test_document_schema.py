"""W05: v2 구조·트리·참조·식별자와 기존 예시 호환을 DB 없이 검증합니다."""
from copy import deepcopy
import json
from pathlib import Path
from uuid import uuid4

import pytest
from werkzeug.exceptions import RequestEntityTooLarge

from app.errors import DocumentValidationError
from app.schemas.document_schema import payload_input, save_input, canonical
from app.services.document_validation import validate_transition, changes_between

ACTOR = str(uuid4())


def empty():
    return {"schemaVersion": 2, "ideas": [], "features": [], "nodes": [], "connections": [], "tables": []}


def idea(**updates):
    return {"id": str(uuid4()), "title": "새 아이디어", "category": "problems_goals", **updates}


def valid_payload():
    root = idea(authorId=ACTOR, voterIds=[ACTOR], decisionStatus="ACCEPTED", decisionReason="필요해요")
    child = idea(parentIdeaId=root["id"])
    grandchild = idea(parentIdeaId=child["id"])
    feature = {"id": str(uuid4()), "name": "기능", "relatedStoryId": grandchild["id"], "status": "COMPLETED"}
    first = {"id": str(uuid4()), "name": "API", "category": "Service", "x": 0, "y": 1}
    second = {"id": str(uuid4()), "name": "DB", "category": "DataStore", "x": 2, "y": 3}
    table = {"id": str(uuid4()), "name": "users", "relatedFeatureIds": [feature["id"]], "columns": [
        {"id": str(uuid4()), "name": "id", "dataType": "UUID", "isPrimaryKey": True}]}
    detail = {"id": str(uuid4()), "name": "details", "columns": [{"id": str(uuid4()), "name": "user_id",
        "dataType": "UUID", "isForeignKey": True, "references": "users.id", "relatedFeatureId": feature["id"]}]}
    return {**empty(), "ideas": [root, child, grandchild], "features": [feature], "nodes": [first, second],
        "connections": [{"id": str(uuid4()), "sourceId": first["id"], "targetId": second["id"], "protocol": "SQL"}],
        "tables": [table, detail]}


def validate(payload, previous=None):
    normalized, conversions = payload_input(payload)
    return validate_transition(normalized, previous or empty(), ACTOR, "검증 A", "2026-10-21T00:00:00Z"), conversions


def test_valid_deep_tree_reference_document_is_normalized_without_mutating_input():
    original = valid_payload()
    before = deepcopy(original)
    result, conversions = validate(original)
    assert original == before
    assert result["ideas"][1]["parentIdeaId"] == original["ideas"][0]["id"]
    assert result["ideas"][0]["decidedBy"] == ACTOR
    assert all(i["authorId"] == ACTOR for i in result["ideas"])
    assert result["connections"][0]["description"] == ""
    assert any(c["to"] == "CHAR(36)" for c in conversions)


@pytest.mark.parametrize("damage", [
    lambda p: p.update(ownerId=ACTOR),
    lambda p: p.update(schemaVersion=True),
    lambda p: p.update(features=None),
    lambda p: p["ideas"].append(deepcopy(p["ideas"][0])),
    lambda p: p["ideas"][0].update(title="x" * 121),
    lambda p: p["ideas"][0].update(description="x" * 5001),
    lambda p: p["ideas"][0].update(id="NEW-NON-UUID"),
    lambda p: p["ideas"][0].update(parentIdeaId=p["ideas"][2]["id"]),
    lambda p: p["ideas"][0].update(parentIdeaId=p["ideas"][0]["id"]),
    lambda p: p["ideas"][1].update(parentIdeaId=str(uuid4())),
    lambda p: p["ideas"][1].update(category="actors"),
    lambda p: p["ideas"][1].update(siblingOrder=-1),
    lambda p: p["ideas"][1].update(siblingOrder=True),
    lambda p: p["ideas"][0].update(decisionReason=""),
    lambda p: p["ideas"][0].update(authorId=str(uuid4())),
    lambda p: p["ideas"][0].update(voterIds=[str(uuid4())]),
    lambda p: p["features"][0].update(relatedStoryId="missing"),
    lambda p: p["features"][0].update(status="DONE"),
    lambda p: p["features"][0].update(ownerId=ACTOR),
    lambda p: p["nodes"][0].update(x=float("inf")),
    lambda p: p["nodes"][0].update(x=float("nan")),
    lambda p: p["nodes"][0].update(x=10**400),
    lambda p: p["nodes"][0].update(x=True),
    lambda p: p["connections"][0].update(targetId="missing"),
    lambda p: p["connections"][0].update(protocol="FTP"),
    lambda p: p["tables"][1].update(name="USERS"),
    lambda p: p["tables"][0].update(name="users;DROP"),
    lambda p: p["tables"][0]["columns"].append({**p["tables"][0]["columns"][0], "id": str(uuid4()), "name": "ID"}),
    lambda p: p["tables"][0]["columns"][0].update(isNullable=True),
    lambda p: p["tables"][1]["columns"][0].update(references="users.missing"),
    lambda p: p["tables"][0]["columns"][0].update(isPrimaryKey=False),
    lambda p: p["tables"][1]["columns"][0].update(dataType="INT"),
    lambda p: p["tables"][1]["columns"][0].update(isForeignKey=False),
    lambda p: p["tables"][0]["columns"][0].update(dataType="VARCHAR", length=0),
    lambda p: p["tables"][0]["columns"][0].update(dataType="VARCHAR(30)", length=40),
    lambda p: p["tables"][0]["columns"][0].update(dataType="DECIMAL", precision=2, scale=3),
    lambda p: p["tables"][0]["columns"][0].update(defaultValue="0); DROP TABLE users; --"),
    lambda p: p["tables"][0].update(relatedFeatureIds=["missing"]),
    lambda p: p["tables"][0]["columns"][0].update(relatedFeatureId="missing"),
    lambda p: p.update(archVersions=[{"id": "injected"}]),
])
def test_invalid_document_never_becomes_a_partial_save(damage):
    payload = valid_payload()
    damage(payload)
    with pytest.raises(DocumentValidationError) as error:
        validate(payload)
    assert error.value.details["fieldErrors"][0]["path"]


def test_json_limits_depth_and_utf8_not_character_count():
    with pytest.raises(RequestEntityTooLarge):
        canonical({"text": "한" * (1024 * 1024 // 3 + 1)})
    with pytest.raises(DocumentValidationError):
        canonical({"text": "\ud800"})
    value = {}
    for _ in range(66):
        value = {"child": value}
    with pytest.raises(DocumentValidationError):
        canonical(value)


@pytest.mark.parametrize("damage", [lambda r: r.update(baseVersion=True), lambda r: r.update(baseVersion=0),
    lambda r: r.update(baseVersion=2**63), lambda r: r.update(mutationId="invalid"),
    lambda r: r["project"].update(ownerId=ACTOR), lambda r: r["project"].update(targetDbms="postgres")])
def test_envelope_is_strict(damage):
    request = {"baseVersion": 1, "mutationId": str(uuid4()), "project": {"title": "검사"}, "payload": empty()}
    damage(request)
    with pytest.raises(DocumentValidationError):
        save_input(request)


def test_both_legacy_templates_keep_ids_history_relative_times_and_emit_type_conversions():
    path = Path(__file__).resolve().parents[1] / "app/data/project_templates.json"
    for template in json.loads(path.read_text(encoding="utf-8")):
        old = deepcopy(template["payload"])
        normalized, conversions = payload_input(old)
        result, _ = validate(normalized, normalized)
        assert result["schemaVersion"] == 2
        assert result["archVersions"] == old["archVersions"]
        assert [i["id"] for i in result["ideas"]] == [i["id"] for i in old["ideas"]]
        assert [i["comments"] for i in result["ideas"]] == [i["comments"] for i in old["ideas"]]
        assert all(i["parentIdeaId"] is None for i in result["ideas"])
        assert conversions
        assert template["payload"] == old


def test_rename_and_delete_references_must_be_applied_together():
    payload, _ = validate(valid_payload())
    renamed = deepcopy(payload)
    renamed["tables"][0]["name"] = "accounts"
    with pytest.raises(DocumentValidationError):
        validate(renamed, payload)
    renamed["tables"][1]["columns"][0]["references"] = "accounts.id"
    assert validate(renamed, payload)[0]["tables"][0]["name"] == "accounts"
    deleted = deepcopy(payload)
    deleted["ideas"] = []
    with pytest.raises(DocumentValidationError):
        validate(deleted, payload)
    deleted["features"][0].pop("relatedStoryId")
    assert validate(deleted, payload)[0]["ideas"] == []


def test_nested_activity_diff_retains_removed_column_and_comment_labels():
    before = empty()
    before["ideas"] = [idea(comments=[{"id": "old-comment", "text": "삭제된 댓글"}])]
    before["tables"] = [{"id": "old-table", "name": "accounts", "columns": [{"id": "old-column", "name": "email"}]}]
    changes = changes_between(before, empty(), {"id": "p", "title": "같음"}, {"id": "p", "title": "같음"})
    assert any(c["entityType"] == "comment" and c["label"] == "삭제된 댓글" and c["action"] == "deleted" for c in changes)
    assert any(c["entityType"] == "column" and c["label"] == "email" and c["action"] == "deleted" for c in changes)
