"""멤버 관리 HTTP 경계입니다. actor/role은 요청 본문에서 받지 않습니다."""
from flask import Blueprint, g, jsonify, request
from flask_jwt_extended import get_jwt, jwt_required

from ..auth import actor_from_claims
from ..extensions import db
from ..schemas import project_schema as schema
from ..services import member_service as service

members = Blueprint("members", __name__, url_prefix="/api/projects")


@members.before_request
@jwt_required(locations=["headers"])
def authenticate():
    g.actor_id = actor_from_claims(get_jwt()).id


@members.after_request
def no_store(response):
    response.headers["Cache-Control"] = "no-store"
    return response


@members.get("/<project_id>/members")
def list_members(project_id):
    return jsonify(data=service.list_members(db.session.session_factory, g.actor_id, schema.identifier(project_id)))


@members.post("/<project_id>/members")
def add_member(project_id):
    return jsonify(data=service.add_member(db.session.session_factory, g.actor_id, schema.identifier(project_id),
                                            schema.member_input(request.get_json())))


@members.delete("/<project_id>/members/<user_id>")
def remove_member(project_id, user_id):
    service.remove_member(db.session.session_factory, g.actor_id, schema.identifier(project_id), schema.identifier(user_id))
    return "", 204
