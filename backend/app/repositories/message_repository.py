"""채팅의 DB 조회·추가. 권한·트랜잭션·재시도 정책은 서비스 책임입니다."""
from sqlalchemy import and_, or_, select
from ..models import AppUser, ProjectMessage


def find(session, message_id):
    return session.scalar(select(ProjectMessage).where(ProjectMessage.id == message_id).with_for_update())


def page(session, project_id, since, after_id, limit):
    query = (select(ProjectMessage, AppUser).join(AppUser, AppUser.id == ProjectMessage.user_id)
             .where(ProjectMessage.project_id == project_id))
    if since is not None:
        condition = ProjectMessage.created_at >= since
        if after_id:
            condition = or_(ProjectMessage.created_at > since,
                            and_(ProjectMessage.created_at == since, ProjectMessage.id > after_id))
        return session.execute(query.where(condition).order_by(ProjectMessage.created_at, ProjectMessage.id).limit(limit)).all()
    return list(reversed(session.execute(query.order_by(ProjectMessage.created_at.desc(), ProjectMessage.id.desc()).limit(limit)).all()))


def insert(session, project_id, actor_id, body, message_id):
    values = dict(project_id=project_id, user_id=actor_id, body=body)
    if message_id: values['id'] = message_id
    message = ProjectMessage(**values)
    session.add(message)
    session.flush()
    return message
