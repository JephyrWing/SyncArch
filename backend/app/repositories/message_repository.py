"""프로젝트 채팅 저장소입니다. 커밋은 서비스에서만 수행합니다."""
from sqlalchemy import and_, or_, select

from ..models import AppUser, ProjectMessage


def _with_author(project_id):
    return (select(ProjectMessage, AppUser).join(AppUser, AppUser.id == ProjectMessage.user_id)
            .where(ProjectMessage.project_id == project_id))


def latest_messages(session, project_id, limit):
    """최근 limit개를 오래된 순으로 돌려줍니다."""
    rows = session.execute(_with_author(project_id)
                           .order_by(ProjectMessage.created_at.desc(), ProjectMessage.id.desc()).limit(limit)).all()
    return list(reversed(rows))


def messages_after(session, project_id, since, after_id, limit):
    """(시각, id) 순서로 커서 다음 메시지를 limit개까지 돌려줍니다.

    after_id가 없으면 예전 클라이언트처럼 since 시각을 포함해서 돌려줍니다.
    """
    if after_id is None:
        cursor = ProjectMessage.created_at >= since
    else:
        cursor = or_(ProjectMessage.created_at > since,
                     and_(ProjectMessage.created_at == since, ProjectMessage.id > after_id))
    return session.execute(_with_author(project_id).where(cursor)
                           .order_by(ProjectMessage.created_at, ProjectMessage.id).limit(limit)).all()


def find_by_client_id(session, project_id, user_id, client_id):
    return session.scalar(select(ProjectMessage).where(ProjectMessage.project_id == project_id,
                                                       ProjectMessage.user_id == user_id,
                                                       ProjectMessage.client_id == client_id))


def insert_message(session, project_id, user_id, body, client_id):
    message = ProjectMessage(project_id=project_id, user_id=user_id, body=body, client_id=client_id)
    session.add(message)
    session.flush()
    return message
