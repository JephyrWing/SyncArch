"""초대 코드·접속 표시·채팅·API 명세 엑셀의 HTTP 경계입니다. actor는 요청 본문에서 받지 않습니다."""
import io

from flask import Blueprint, g, jsonify, request, send_file
from flask_jwt_extended import get_jwt, jwt_required

from ..auth import actor_from_claims
from ..extensions import db
from ..schemas import collab_schema
from ..schemas.project_schema import identifier
from ..services import api_spec_service, invite_service, message_service, presence_service

collaboration = Blueprint("collaboration", __name__, url_prefix="/api/projects")
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@collaboration.before_request
@jwt_required(locations=["headers"])
def authenticate():
    g.actor_id = actor_from_claims(get_jwt()).id


@collaboration.after_request
def no_store(response):
    response.headers["Cache-Control"] = "no-store"
    return response


@collaboration.get("/<project_id>/invite")
def invite(project_id):
    return jsonify(data=invite_service.get_invite(db.session.session_factory, g.actor_id, identifier(project_id)))


@collaboration.post("/<project_id>/invite")
def regenerate_invite(project_id):
    return jsonify(data=invite_service.regenerate_invite(db.session.session_factory, g.actor_id, identifier(project_id)))


@collaboration.post("/join")
def join():
    return jsonify(data=invite_service.join_by_code(db.session.session_factory, g.actor_id,
                                                    collab_schema.code_input(request.get_json())))


@collaboration.post("/<project_id>/presence")
def presence(project_id):
    step, tab_id = collab_schema.presence_input(request.get_json())
    return jsonify(data=presence_service.heartbeat(db.session.session_factory, g.actor_id, identifier(project_id),
                                                   step, tab_id))


@collaboration.delete("/<project_id>/presence")
def leave(project_id):
    presence_service.leave(g.actor_id, identifier(project_id), collab_schema.tab_input(request.args.get("tabId")))
    return "", 204


@collaboration.get("/<project_id>/messages")
def messages(project_id):
    since = collab_schema.since_input(request.args.get("since"))
    return jsonify(data=message_service.list_messages(db.session.session_factory, g.actor_id, identifier(project_id),
                                                      since, collab_schema.after_input(request.args.get('afterId'), since)))


@collaboration.post("/<project_id>/messages")
def post_message(project_id):
    body, message_id = collab_schema.message_input(request.get_json())
    return jsonify(data=message_service.post_message(db.session.session_factory, g.actor_id, identifier(project_id),
                                                     body, message_id)), 201


@collaboration.get("/<project_id>/api-spec.xlsx")
def api_spec(project_id):
    content, name = api_spec_service.api_spec_file(db.session.session_factory, g.actor_id, identifier(project_id))
    return send_file(io.BytesIO(content), mimetype=XLSX, as_attachment=True, download_name=name)
