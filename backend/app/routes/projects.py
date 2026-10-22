"""프로젝트 HTTP 입출력입니다. 업무 판단과 DB 접근은 서비스에 위임합니다."""
from flask import Blueprint, g, jsonify, make_response, request
from flask_jwt_extended import get_jwt, jwt_required

from ..auth import actor_from_claims
from ..extensions import db
from ..schemas import project_schema as schema
from ..services import project_service as service

projects = Blueprint("projects", __name__, url_prefix="/api")


@projects.before_request
@jwt_required(locations=["headers"])
def authenticate():
    g.actor_id = actor_from_claims(get_jwt()).id


@projects.after_request
def no_store(response):
    if "Cache-Control" not in response.headers:
        response.headers["Cache-Control"] = "no-store"
    return response


@projects.get("/projects")
def list_projects():
    return jsonify(data=service.list_projects(db.session.session_factory, g.actor_id,
                                              schema.archive_filter(request.args.get("archived"))))


@projects.post("/projects")
def create_project():
    return jsonify(data=service.create_project(db.session.session_factory, g.actor_id,
                                               schema.project_input(request.get_json()))), 201


@projects.get("/projects/<project_id>/document")
def document(project_id):
    data = service.get_document(db.session.session_factory, g.actor_id, schema.identifier(project_id))
    etag = f'{data["project"]["id"]}:{data["version"]}'
    response = make_response("", 304) if request.if_none_match.contains_weak(etag) else jsonify(data=data)
    response.set_etag(etag)
    response.headers["Cache-Control"] = "private, no-cache"
    return response


@projects.post("/projects/<project_id>/clone")
def clone(project_id):
    fields = schema.clone_input(request.get_json())
    return jsonify(data=service.clone_project(db.session.session_factory, g.actor_id, schema.identifier(project_id),
        fields["sourceVersion"], fields["title"])), 201


@projects.patch("/projects/<project_id>/archive")
def archive(project_id):
    return jsonify(data=service.archive_project(db.session.session_factory, g.actor_id, schema.identifier(project_id),
                                                 schema.archive_input(request.get_json())))


@projects.get("/project-templates")
def templates():
    return jsonify(data=service.list_templates(db.session.session_factory, g.actor_id))


@projects.post("/project-templates/<template_id>/clone")
def clone_template(template_id):
    fields = schema.clone_input(request.get_json())
    return jsonify(data=service.clone_template(db.session.session_factory, g.actor_id, template_id,
        fields["sourceVersion"], fields["title"])), 201
