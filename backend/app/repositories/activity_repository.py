"""업무 트랜잭션에 참여하는 활동 이력 저장소입니다."""
from ..models import ProjectActivity


def insert_activity(session, *, project_id, version, actor_id, changes, mutation_id=None, committed_at=None):
    from ..models import new_id, utc_now
    activity = ProjectActivity(id=new_id(), project_id=project_id, version=version,
        mutation_id=mutation_id or new_id(), actor_id=actor_id, committed_at=committed_at or utc_now(), changes=changes)
    session.add(activity)
    session.flush()
    return activity


def page(session, project_id, *, before_version=None, limit=20):
    from sqlalchemy import select
    query = select(ProjectActivity).where(ProjectActivity.project_id == project_id)
    if before_version is not None:
        query = query.where(ProjectActivity.version < before_version)
    return session.scalars(query.order_by(ProjectActivity.version.desc(), ProjectActivity.id.desc()).limit(limit)).all()


def for_mutation(session, project_id, mutation_id):
    from sqlalchemy import select
    return session.scalar(select(ProjectActivity).where(ProjectActivity.project_id == project_id,
        ProjectActivity.mutation_id == mutation_id))
