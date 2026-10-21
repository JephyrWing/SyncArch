"""업무 트랜잭션에 참여하는 활동 이력 저장소입니다."""
from ..models import ProjectActivity


def insert_activity(session, *, project_id, version, actor_id, changes):
    from ..models import new_id, utc_now
    activity = ProjectActivity(id=new_id(), project_id=project_id, version=version,
        mutation_id=new_id(), actor_id=actor_id, committed_at=utc_now(), changes=changes)
    session.add(activity)
    session.flush()
    return activity
