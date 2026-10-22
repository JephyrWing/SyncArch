from flask import Blueprint, current_app, jsonify

from ..services.health_service import check_health

health = Blueprint("health", __name__)


@health.get("/api/health")
def get_health():
    return jsonify(data=check_health())


@health.get("/api/release")
def get_release():
    response = jsonify(data={"revision": current_app.config["RELEASE_SHA"]})
    response.headers["Cache-Control"] = "no-store"
    return response
