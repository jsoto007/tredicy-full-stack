from pathlib import Path

from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_migrate import Migrate
from dotenv import load_dotenv

from .config import configure_app, db
migrate = Migrate()


def create_app():
    load_dotenv()
    client_dist = Path(__file__).resolve().parent.parent.parent / "client" / "dist"
    static_folder = str(client_dist)

    app = Flask(
        __name__,
        static_url_path="",
        static_folder=static_folder,
        template_folder=static_folder,
    )
    app.config["CLIENT_DIST_PATH"] = static_folder
    app.config["CLIENT_BUILD_PRESENT"] = client_dist.exists()
    if not client_dist.exists():
        app.logger.warning(
            "Client build directory %s not found. API will work but SPA routes will 404 until built.",
            static_folder,
        )

    configure_app(app)
    migrate.init_app(app, db)

    from .routes import api_bp

    CORS(
        app,
        resources={r"/api/*": {"origins": ["http://127.0.0.1:5173"]}},
        supports_credentials=True,
    )

    with app.app_context():
        db.create_all()

    app.register_blueprint(api_bp)

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def _spa_fallback(path: str):
        if path.startswith("api/"):
            return {"error": "Not Found"}, 404

        static_dir = app.static_folder
        if not static_dir:
            return {"error": "client_build_missing"}, 404

        build_path = Path(static_dir)
        if not build_path.exists():
            app.logger.warning("Client build folder %s missing; returning 404 for %s", static_dir, path)
            return {"error": "client_build_missing"}, 404

        candidate = build_path / path
        if path and candidate.exists() and candidate.is_file():
            return send_from_directory(static_dir, path)

        index_file = build_path / "index.html"
        if not index_file.exists():
            app.logger.error("index.html not found in %s; returning 404 for %s", static_dir, path)
            return {"error": "client_index_missing"}, 404

        return send_from_directory(static_dir, "index.html")

    return app


# Expose a module-level Flask application so Gunicorn can import `app:app`
# even when the Procfile or hosting platform still references that target.
app = create_app()
