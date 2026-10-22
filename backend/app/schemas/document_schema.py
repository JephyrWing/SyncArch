"""문서 요청의 구조·타입과 결정적인 정규화를 담당합니다. DB는 조회하지 않습니다."""
from copy import deepcopy
import json
import math
import re
from uuid import UUID

from werkzeug.exceptions import RequestEntityTooLarge

from ..errors import DocumentValidationError

MAX_BYTES = 1024 * 1024
MAX_VERSION = 2**63 - 1
AREAS = ("ideas", "features", "nodes", "connections", "tables")
COMPATIBILITY = ("archVersions", "stepLocks", "currentArchVersionId")
CATEGORIES = {"problems_goals", "actors", "user_stories", "constraints"}
STATUSES = {"PLANNED", "IN_PROGRESS", "QA", "COMPLETED"}
DECISIONS = {"ACCEPTED", "REVIEW", "DEFERRED", "REJECTED"}


def fail(path, reason):
    raise DocumentValidationError(path, reason)


def fields(value, required, optional, path):
    if not isinstance(value, dict):
        fail(path, "객체여야 합니다.")
    if set(required) - value.keys():
        fail(path, "필수 필드가 없습니다.")
    if value.keys() - set(required) - set(optional):
        fail(path, "허용하지 않는 필드가 있습니다.")


def string(value, path, maximum=5000, *, empty=True):
    if not isinstance(value, str) or len(value) > maximum or "\x00" in value or (not empty and not value.strip()):
        fail(path, "문자열 길이 또는 형식이 유효하지 않습니다.")
    return value


def identifier(value, path):
    return string(value, path, 100, empty=False)


def integer(value, path, minimum=0, maximum=MAX_VERSION):
    if type(value) is not int or not minimum <= value <= maximum:
        fail(path, "정수 범위가 유효하지 않습니다.")
    return value


def uuid(value, path):
    try:
        return str(UUID(value))
    except (ValueError, AttributeError, TypeError):
        fail(path, "UUID여야 합니다.")


def sequence(value, path):
    if not isinstance(value, list):
        fail(path, "배열이어야 합니다.")
    return value


def canonical(value):
    pending = [(value, 0)]
    while pending:
        item, depth = pending.pop()
        if depth > 64:
            fail("payload", "JSON 중첩은 64단계 이하여야 합니다.")
        if isinstance(item, dict):
            pending.extend((v, depth + 1) for v in item.values())
        elif isinstance(item, list):
            pending.extend((v, depth + 1) for v in item)
    try:
        encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)
        if len(encoded.encode("utf-8")) > MAX_BYTES:
            raise RequestEntityTooLarge("문서는 JSON 인코딩 기준 1 MiB 이하여야 합니다.")
        return encoded
    except (ValueError, TypeError, RecursionError, UnicodeError):
        fail("payload", "유한한 값과 유효한 UTF-8 JSON만 허용합니다.")


def _enum(value, options, path):
    if not isinstance(value, str) or value not in options:
        fail(path, "허용된 값이 아닙니다.")


def _common(item, required, optional, path, *, names=(), enums=None, booleans=()):
    fields(item, required, optional, path)
    identifier(item["id"], path + ".id")
    for key, value in item.items():
        if key in names:
            string(value, path + "." + key, 120, empty=False)
        elif key in booleans:
            if type(value) is not bool:
                fail(path + "." + key, "불리언이어야 합니다.")
        elif key in ("x", "y"):
            if type(value) not in (int, float) or abs(value) > 1e9 or not math.isfinite(value):
                fail(path + "." + key, "유한한 좌표여야 합니다.")
        elif enums and key in enums:
            _enum(value, enums[key], path + "." + key)


def _strings(item, keys, path, maximum=5000):
    for key in keys:
        if key in item:
            string(item[key], path + "." + key, maximum)


def _ids(value, path):
    values = sequence(value, path)
    for i, item in enumerate(values):
        identifier(item, f"{path}[{i}]")
    if len(set(values)) != len(values):
        fail(path, "중복 ID를 허용하지 않습니다.")


def data_type(column, path, conversions):
    original = string(column["dataType"], path + ".dataType", 4000, empty=False)
    # ENUM/SET labels are case-sensitive application data, not SQL keywords.
    choice = re.fullmatch(r"(ENUM|SET)\s*\((.*)\)", original.strip(), re.I | re.S)
    if choice:
        # Only SQL single-quoted literals, escaped with doubled quotes. No SQL clauses.
        literal = r"'(?:[^'\\\x00-\x1f]|'')*'"
        if not re.fullmatch(rf"\s*{literal}(?:\s*,\s*{literal})*\s*", choice[2]):
            fail(path + ".dataType", "ENUM/SET은 작은따옴표 값 목록이어야 합니다. 따옴표는 두 번 입력하세요.")
        labels = re.findall(literal, choice[2])
        decoded = [label[1:-1].replace("''", "'") for label in labels]
        if len(set(decoded)) != len(decoded) or len(labels) > (64 if choice[1].upper() == "SET" else 65535):
            fail(path + ".dataType", "ENUM/SET 값은 중복 없이 허용 개수 이하여야 합니다.")
        if choice[1].upper() == "SET" and any("," in label for label in decoded):
            fail(path + ".dataType", "SET 값에는 쉼표를 넣을 수 없습니다.")
        if any(key in column for key in ("length", "precision", "scale")):
            fail(path, "ENUM/SET에는 길이·정밀도를 지정하지 않습니다.")
        column["dataType"] = choice[1].upper() + "(" + ",".join(labels) + ")"
        return
    value = original.strip().upper()
    # 기존 PostgreSQL 예시의 의미 변환을 응답에 명시합니다.
    value = {"INTEGER": "INT", "TIMESTAMPTZ": "DATETIME", "JSONB": "JSON", "BOOL": "BOOLEAN",
             "NUMERIC": "DECIMAL", "DEC": "DECIMAL", "FIXED": "DECIMAL",
             "DOUBLE PRECISION": "DOUBLE", "REAL": "DOUBLE"}.get(value, value)
    value = re.sub(r"^(INTEGER|NUMERIC|DEC|FIXED)(?=\s*\(| UNSIGNED$)",
                   lambda m: "INT" if m[1] == "INTEGER" else "DECIMAL", value)
    unsigned = value.endswith(" UNSIGNED")
    if unsigned:
        value = value[:-9].strip()
    match = re.fullmatch(r"(CHAR|VARCHAR|BINARY|VARBINARY|BIT|DECIMAL|DATETIME|TIME|TIMESTAMP)\s*\((\d+)(?:\s*,\s*(\d+))?\)", value)
    if match:
        value = match[1]
        if value in {"CHAR", "VARCHAR", "BINARY", "VARBINARY", "BIT"}:
            if match[3] is not None:
                fail(path, "해당 자료형에는 길이만 지정합니다.")
            if "length" in column and column["length"] != int(match[2]):
                fail(path + ".length", "자료형 표기와 길이가 다릅니다.")
            column.setdefault("length", int(match[2]))
        elif value == "DECIMAL":
            if any(k in column and column[k] != v for k, v in (("precision", int(match[2])), ("scale", int(match[3] or 0)))):
                fail(path, "자료형 표기와 정밀도가 다릅니다.")
            column.setdefault("precision", int(match[2]))
            column.setdefault("scale", int(match[3] or 0))
        else:
            if match[3] is not None:
                fail(path, "시간 자료형에는 소수초 정밀도만 지정합니다.")
            if "precision" in column and column["precision"] != int(match[2]):
                fail(path + ".precision", "자료형 표기와 정밀도가 다릅니다.")
            column.setdefault("precision", int(match[2]))
    numeric = {"TINYINT", "SMALLINT", "MEDIUMINT", "INT", "BIGINT", "DECIMAL", "FLOAT", "DOUBLE"}
    supported = numeric | {"CHAR", "VARCHAR", "BINARY", "VARBINARY", "BIT", "TINYTEXT", "TEXT", "MEDIUMTEXT", "LONGTEXT",
        "TINYBLOB", "BLOB", "MEDIUMBLOB", "LONGBLOB", "BOOLEAN", "DATE", "TIME", "DATETIME", "TIMESTAMP", "YEAR", "UUID", "JSON", "INET4", "INET6",
        "GEOMETRY", "POINT", "LINESTRING", "POLYGON", "MULTIPOINT", "MULTILINESTRING", "MULTIPOLYGON", "GEOMETRYCOLLECTION"}
    if value not in supported or (unsigned and value not in numeric):
        fail(path + ".dataType", "지원하지 않는 자료형입니다.")
    lengths = {"CHAR": (1, 255), "VARCHAR": (1, 16383), "BINARY": (1, 255), "VARBINARY": (1, 65532), "BIT": (1, 64)}
    if value in lengths:
        if value in {"CHAR", "BINARY", "BIT"}:
            column.setdefault("length", 1)
        integer(column.get("length"), path + ".length", *lengths[value])
    elif "length" in column:
        fail(path + ".length", "해당 자료형에는 길이를 지정할 수 없습니다.")
    if value == "DECIMAL":
        precision = integer(column.get("precision"), path + ".precision", 1, 65)
        integer(column.get("scale", 0), path + ".scale", 0, min(38, precision))
        column.setdefault("scale", 0)
    elif value in {"DATETIME", "TIME", "TIMESTAMP"}:
        if original.strip().upper() == "TIMESTAMPTZ":
            column.setdefault("precision", 6)
        if "precision" in column:
            integer(column["precision"], path + ".precision", 0, 6)
        if "scale" in column:
            fail(path + ".scale", "시간 자료형에는 scale을 지정하지 않습니다.")
    elif "precision" in column or "scale" in column:
        fail(path, "해당 자료형에 정밀도를 지정할 수 없습니다.")
    column["dataType"] = value + (" UNSIGNED" if unsigned else "")
    if original != value or value == "UUID":
        conversions.append({"path": path + ".dataType", "from": original,
            "to": "CHAR(36)" if value == "UUID" else column["dataType"],
            "message": "UTC 의미·길이·정밀도와 MariaDB 출력 변환을 확인해 주세요."})


def payload_input(value):
    canonical(value)
    fields(value, ["schemaVersion", *AREAS], COMPATIBILITY, "payload")
    if type(value["schemaVersion"]) is not int or value["schemaVersion"] not in (1, 2):
        fail("payload.schemaVersion", "지원하는 버전은 1과 2입니다.")
    result, conversions = deepcopy(value), []
    result["schemaVersion"] = 2
    for area in AREAS:
        sequence(result[area], "payload." + area)
        seen = set()
        for index, item in enumerate(result[area]):
            path = f"payload.{area}[{index}]"
            if not isinstance(item, dict) or "id" not in item:
                fail(path, "항목 ID가 필요합니다.")
            identifier(item["id"], path + ".id")
            if item["id"] in seen:
                fail(path + ".id", "종류 내 ID가 중복됩니다.")
            seen.add(item["id"])
            if area == "ideas":
                _common(item, ["id", "title", "category"], ["description", "authorId", "author", "voterIds", "votes", "votedBy", "comments", "isAiDraft", "rationale", "decisionStatus", "decisionReason", "decidedBy", "parentIdeaId", "siblingOrder"], path,
                    names=("title",), enums={"category": CATEGORIES, "decisionStatus": DECISIONS}, booleans=("isAiDraft",))
                _strings(item, ["description", "author", "rationale", "decisionReason"], path)
                for key in ("authorId", "decidedBy"):
                    if item.get(key) is not None:
                        identifier(item[key], path + "." + key)
                item.setdefault("description", "")
                item.setdefault("parentIdeaId", None)
                item.setdefault("siblingOrder", index)
                integer(item["siblingOrder"], path + ".siblingOrder", 0, 1000000)
                if item["parentIdeaId"] is not None:
                    identifier(item["parentIdeaId"], path + ".parentIdeaId")
                item.setdefault("voterIds", [])
                _ids(item["voterIds"], path + ".voterIds")
                if "votes" in item:
                    integer(item["votes"], path + ".votes")
                if "votedBy" in item:
                    _ids(item["votedBy"], path + ".votedBy")
                item.setdefault("comments", [])
                comment_ids = set()
                for ci, comment in enumerate(sequence(item["comments"], path + ".comments")):
                    cp = f"{path}.comments[{ci}]"
                    _common(comment, ["id", "text"], ["authorId", "author", "createdAt"], cp)
                    _strings(comment, ["text", "author"], cp)
                    if comment.get("authorId") is not None:
                        identifier(comment["authorId"], cp + ".authorId")
                    if "createdAt" in comment:
                        # 과거 상대 시각은 불변 호환 값이며 새 댓글은 서비스에서 UTC로 지정합니다.
                        string(comment["createdAt"], cp + ".createdAt", 40, empty=False)
                    if comment["id"] in comment_ids:
                        fail(cp, "댓글 ID가 중복됩니다.")
                    comment_ids.add(comment["id"])
            elif area == "features":
                _common(item, ["id", "name"], ["displayCode", "domain", "priority", "assignee", "method", "endpoint", "requestFields", "responseFields", "summary", "status", "responseStatusCodes", "relatedStoryId", "isAiDraft"], path, names=("name",),
                    enums={"priority": {"P0", "P1", "P2"}, "method": {"GET", "POST", "PUT", "PATCH", "DELETE"}, "status": STATUSES}, booleans=("isAiDraft",))
                _strings(item, ["displayCode", "domain", "assignee", "endpoint", "requestFields", "responseFields", "summary", "relatedStoryId"], path)
                item.setdefault("status", "PLANNED")
                if "responseStatusCodes" in item:
                    for code in sequence(item["responseStatusCodes"], path + ".responseStatusCodes"):
                        if not isinstance(code, str) or not re.fullmatch(r"[1-5]\d{2}(?: [^\x00\r\n]{1,100})?", code):
                            fail(path + ".responseStatusCodes", "HTTP 상태 코드여야 합니다.")
            elif area == "nodes":
                _common(item, ["id", "name", "category", "x", "y"], ["techStack", "description", "assignedTeam", "isAiDraft"], path, names=("name",),
                    enums={"category": {"Client", "Service", "DataStore", "Messaging", "Infra"}, "assignedTeam": {"Frontend", "Backend", "Infra", "Common"}}, booleans=("isAiDraft",))
                _strings(item, ["description"], path)
                for tech in sequence(item.get("techStack", []), path + ".techStack"):
                    string(tech, path + ".techStack", 120, empty=False)
            elif area == "connections":
                _common(item, ["id", "sourceId", "targetId", "protocol"], ["label", "description"], path,
                    enums={"protocol": {"REST", "gRPC", "WebSocket", "Pub/Sub", "SQL", "Redis", "Kafka"}})
                identifier(item["sourceId"], path + ".sourceId")
                identifier(item["targetId"], path + ".targetId")
                _strings(item, ["label", "description"], path)
                item.setdefault("description", "")
            else:
                _common(item, ["id", "name", "columns"], ["comment", "relatedFeatureIds", "x", "y", "isAiDraft"], path, names=("name",), booleans=("isAiDraft",))
                _strings(item, ["comment"], path)
                _ids(item.get("relatedFeatureIds", []), path + ".relatedFeatureIds")
                for ci, column in enumerate(sequence(item["columns"], path + ".columns")):
                    cp = f"{path}.columns[{ci}]"
                    _common(column, ["id", "name", "dataType"], ["isPrimaryKey", "isForeignKey", "references", "isUnique", "isNullable", "defaultValue", "comment", "relatedFeatureId", "length", "precision", "scale"], cp,
                        names=("name",), booleans=("isPrimaryKey", "isForeignKey", "isUnique", "isNullable"))
                    _strings(column, ["references", "defaultValue", "comment", "relatedFeatureId"], cp)
                    for flag in ("isPrimaryKey", "isForeignKey", "isUnique"):
                        column.setdefault(flag, False)
                    column.setdefault("isNullable", not column["isPrimaryKey"])
                    data_type(column, cp, conversions)
    canonical(result)
    return result, conversions


def save_input(value):
    canonical(value)
    fields(value, ["baseVersion", "mutationId", "project", "payload"], [], "request")
    from .project_schema import project_input
    # 기존 프로젝트 생성 계약과 같은 메타데이터 길이·DBMS 정책을 적용합니다.
    try:
        project = project_input(value["project"])
    except Exception as error:
        from werkzeug.exceptions import BadRequest
        if not isinstance(error, BadRequest):
            raise
        fail("project", "제목·요약·분류·대상 DBMS를 확인해 주세요.")
    project["targetDbms"] = "mariadb"
    payload, conversions = payload_input(value["payload"])
    return {"baseVersion": integer(value["baseVersion"], "baseVersion", 1),
            "mutationId": uuid(value["mutationId"], "mutationId"), "project": project,
            "payload": payload}, conversions


def activity_query(args):
    if set(args) - {"beforeVersion", "limit"}:
        fail("query", "허용하지 않는 조회 조건입니다.")
    result = {}
    for key in ("beforeVersion", "limit"):
        value = args.get(key)
        if value is not None:
            if not isinstance(value, str) or not re.fullmatch(r"[1-9]\d{0,18}", value):
                fail("query." + key, "양의 정수여야 합니다.")
            result[key] = integer(int(value), "query." + key, 1)
    result["limit"] = min(result.get("limit", 20), 100)
    return result
