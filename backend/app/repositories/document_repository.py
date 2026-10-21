"""문서 CAS와 멱등 기록입니다. 트랜잭션 커밋은 서비스가 수행합니다."""
from sqlalchemy import select, update

from ..models import DocumentMutation, ProjectDocument


def find_mutation(session, project_id, mutation_id):
    return session.scalar(select(DocumentMutation).where(DocumentMutation.project_id == project_id,
        DocumentMutation.mutation_id == mutation_id).with_for_update())


def compare_and_swap(session, project_id, base_version, payload, actor_id, now):
    statement = (update(ProjectDocument).where(ProjectDocument.project_id == project_id,
        ProjectDocument.version == base_version).values(payload=payload, schema_version=2,
        version=base_version + 1, updated_by=actor_id, updated_at=now).execution_options(synchronize_session=False))
    return session.execute(statement).rowcount


def insert_mutation(session, *, project_id, mutation_id, actor_id, request_hash, result):
    mutation = DocumentMutation(project_id=project_id, mutation_id=mutation_id, actor_id=actor_id,
        request_hash=request_hash, result_version=result["version"], result_updated_at=result["updated_at_db"],
        result_data={k: v for k, v in result.items() if k != "updated_at_db"})
    session.add(mutation)
    session.flush()
    return mutation
