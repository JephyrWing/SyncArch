from pathlib import Path

from flask import abort, current_app, send_from_directory
from werkzeug.exceptions import NotFound


def serve_frontend(path=""):
    # SPA fallback must never turn missing API endpoints into a successful HTML response.
    if path == "api" or path.startswith("api/") or ".." in path.split("/"):
        abort(404)
    directory = Path(current_app.config["FRONTEND_DIST"])
    if path:
        try:
            return send_from_directory(directory, path)
        except NotFound:
            if Path(path).suffix:
                abort(404)
    return send_from_directory(directory, "index.html")


def register_frontend(app):
    app.add_url_rule("/", "frontend_index", serve_frontend)
    app.add_url_rule("/<path:path>", "frontend_path", serve_frontend)
