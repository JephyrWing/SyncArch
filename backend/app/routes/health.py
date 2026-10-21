from flask import Blueprint, jsonify

from ..services.health_service import check_health

health = Blueprint("health", __name__)


@health.get("/api/health")
def get_health():
    return jsonify(data=check_health())
