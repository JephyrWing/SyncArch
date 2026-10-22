"""멤버십 저장소입니다. 프로젝트 잠금을 획득한 서비스에서 변경합니다."""
from sqlalchemy import select

from ..models import AppUser, ProjectMember


def find_member(session, project_id, user_id, *, lock=False):
    query = select(ProjectMember).where(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id)
    return session.scalar(query.with_for_update() if lock else query)


def list_members(session, project_id):
    return session.execute(select(ProjectMember, AppUser).join(AppUser, AppUser.id == ProjectMember.user_id)
                           .where(ProjectMember.project_id == project_id)
                           .order_by(ProjectMember.role.desc(), AppUser.login_id)).all()


def insert_member(session, project_id, user_id, role):
    member = ProjectMember(project_id=project_id, user_id=user_id, role=role)
    session.add(member)
    session.flush()
    return member


def delete_member(session, member):
    session.delete(member)
