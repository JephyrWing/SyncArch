"""문서 저장과 조회의 권한·트랜잭션·커밋 후 알림 경계입니다."""
from copy import deepcopy
import hashlib

from ..errors import IdempotencyKeyReused, ProjectNotFound, VersionConflict
from ..models import utc_now
from ..repositories import activity_repository as activities, document_repository as documents
from ..repositories import project_repository as projects
from ..repositories.user_repository import find_by_id
from ..schemas.document_schema import canonical, payload_input, STATUSES, MAX_VERSION, fail
from .document_validation import changes_between, validate_transition
from .project_access import require_access, require_active_actor
from .project_events import project_changed, publish
from .project_service import project_view, utc


def _metadata(project):
    return {"id": project.id, "title": project.title, "summary": project.summary,
            "categoryTag": project.category_tag, "targetDbms": project.target_dbms}


def save_document(session_factory, actor_id, project_id, request, conversions):
    # 서버가 부여하는 댓글 시각/작성자 전에 해시를 계산해 동일 재시도에 같은 키를 사용합니다.
    digest = hashlib.sha256(canonical(request).encode("utf-8")).hexdigest()
    event = None
    with session_factory.begin() as session:
        project, member = require_access(session, actor_id, project_id, lock=True, write=True)
        mutation = documents.find_mutation(session, project_id, request["mutationId"])
        if mutation is not None:
            if mutation.actor_id != actor_id or mutation.request_hash != digest:
                raise IdempotencyKeyReused()
            if mutation.result_data is not None:
                return {**deepcopy(mutation.result_data), "replayed": True}
            # 이전 스키마 기록에는 응답 스냅샷이 없습니다. 현재 문서를 과거 결과로 위장하지 않습니다.
            activity = activities.for_mutation(session, project_id, mutation.mutation_id)
            return {"version": mutation.result_version, "updatedAt": utc(mutation.result_updated_at),
                "mutationId": mutation.mutation_id, "eventId": activity.id if activity else None,
                "replayed": True, "requiresReload": True}
        document = projects.find_document(session, project_id, lock=True)
        if document is None:
            raise ProjectNotFound()
        if document.version != request["baseVersion"]:
            raise VersionConflict(document.version)
        if document.version >= MAX_VERSION:
            fail("baseVersion", "지원하는 버전 상한에 도달했습니다.")
        actor = require_active_actor(session, actor_id)
        previous, _ = payload_input(document.payload)
        now = utc_now()
        payload = validate_transition(request["payload"], previous, actor_id, actor.display_name, utc(now))
        canonical(payload)
        old_project, new_project = _metadata(project), {"id": project.id, **request["project"]}
        changes = changes_between(previous, payload, old_project, new_project)
        if not documents.compare_and_swap(session, project_id, request["baseVersion"], payload, actor_id, now):
            raise VersionConflict(document.version)
        project.title, project.summary = new_project["title"], new_project["summary"]
        project.category_tag, project.updated_at = new_project["categoryTag"], now
        session.expire(document)
        session.refresh(document)
        activity = activities.insert_activity(session, project_id=project_id, version=document.version,
            mutation_id=request["mutationId"], actor_id=actor_id, committed_at=now, changes=changes)
        result = {"project": project_view(project, document, member.role), "payload": payload,
            "version": document.version, "updatedAt": utc(now), "mutationId": request["mutationId"],
            "eventId": activity.id, "replayed": False, "normalizations": deepcopy(conversions)}
        documents.insert_mutation(session, project_id=project_id, mutation_id=request["mutationId"],
            actor_id=actor_id, request_hash=digest, result={**result, "updated_at_db": now})
        event = (project_changed, {"event": {"eventId": activity.id, "projectId": project_id,
            "version": document.version, "mutationId": request["mutationId"], "actorId": actor_id,
            "actorName": actor.display_name, "committedAt": utc(now), "changes": changes}})
    publish([event])
    return result


def _activity_view(session, activity):
    actor = find_by_id(session, activity.actor_id)
    return {"eventId": activity.id, "projectId": activity.project_id, "version": activity.version,
        "mutationId": activity.mutation_id, "actorId": activity.actor_id,
        "actorName": actor.display_name if actor else "", "committedAt": utc(activity.committed_at),
        "changes": deepcopy(activity.changes)}


def get_activity(session_factory, actor_id, project_id, *, beforeVersion=None, limit=20):
    with session_factory.begin() as session:
        require_access(session, actor_id, project_id)
        rows = activities.page(session, project_id, before_version=beforeVersion, limit=limit + 1)
        visible = rows[:limit]
        return {"items": [_activity_view(session, a) for a in visible],
            "nextBeforeVersion": visible[-1].version if len(rows) > limit else None}


def get_dashboard(session_factory, actor_id, project_id):
    # 프로젝트 잠금으로 권한·문서·활동 조회 중 같은 프로젝트의 쓰기를 직렬화합니다.
    with session_factory.begin() as session:
        project, _ = require_access(session, actor_id, project_id, lock=True)
        document = projects.find_document(session, project_id, lock=True)
        if document is None:
            raise ProjectNotFound()
        payload, _ = payload_input(document.payload)
        statuses = {status: 0 for status in sorted(STATUSES)}
        for feature in payload["features"]:
            statuses[feature["status"]] += 1
        total = len(payload["features"])
        return {"projectId": project.id, "version": document.version,
            "counts": {area: len(payload[area]) for area in ("ideas", "features", "nodes", "connections", "tables")},
            "featureStatuses": statuses, "progress": statuses["COMPLETED"] / total * 100 if total else 0,
            "recentActivity": [_activity_view(session, a) for a in activities.page(session, project_id)]}
