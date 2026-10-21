"""문서 PUT와 활동/대시보드의 HTTP 경계입니다."""
from flask import Blueprint, g, jsonify, request
from flask_jwt_extended import get_jwt, jwt_required
from werkzeug.exceptions import BadRequest, RequestEntityTooLarge

from ..auth import actor_from_claims
from ..extensions import db
from ..schemas import document_schema as schema
from ..schemas.project_schema import identifier
from ..services import document_service as service

documents = Blueprint("documents", __name__, url_prefix="/api/projects")


@documents.before_request
@jwt_required(locations=["headers"])
def authenticate():
    g.actor_id = actor_from_claims(get_jwt()).id


@documents.after_request
def no_store(response):
    response.headers["Cache-Control"] = "no-store"
    return response


@documents.put("/<project_id>/document")
def save(project_id):
    request.max_content_length = schema.MAX_BYTES
    if len(request.get_data()) > schema.MAX_BYTES:
        raise RequestEntityTooLarge("문서는 JSON 인코딩 기준 1 MiB 이하여야 합니다.")
    try:
        value = request.get_json()
    except RecursionError:
        raise BadRequest("JSON 중첩이 너무 깊습니다.") from None
    fields, conversions = schema.save_input(value)
    result = service.save_document(db.session.session_factory, g.actor_id, identifier(project_id), fields, conversions)
    response = jsonify(data=result)
    response.set_etag(f'{project_id}:{result["version"]}')
    return response


@documents.get("/<project_id>/activity")
def activity(project_id):
    query = schema.activity_query(request.args)
    return jsonify(data=service.get_activity(db.session.session_factory, g.actor_id, identifier(project_id), **query))


@documents.get("/<project_id>/dashboard")
def dashboard(project_id):
    return jsonify(data=service.get_dashboard(db.session.session_factory, g.actor_id, identifier(project_id)))
