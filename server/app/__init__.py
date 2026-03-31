import os
from pathlib import Path

import click
from flask import Flask, request, send_from_directory
from flask_cors import CORS
from flask_migrate import Migrate
from dotenv import load_dotenv
from sqlalchemy import func

from .config import configure_app, db
from .extensions import limiter
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
    app.config.setdefault("RATELIMIT_STORAGE_URI", os.getenv("RATELIMIT_STORAGE_URI", "memory://"))
    limiter.init_app(app)
    migrate.init_app(app, db)

    from .routes import api_bp

    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": [
                    "http://127.0.0.1:5173",
                    "http://localhost:5173",
                ]
            }
        },
        supports_credentials=True,
    )

    if os.getenv("FLASK_RUN_CREATE_ALL", "").lower() in {"1", "true", "yes"}:
        with app.app_context():
            db.create_all()

    app.register_blueprint(api_bp)

    def _serve_client_asset(path: str):
        static_dir = app.static_folder
        if not static_dir:
            app.logger.error("CLIENT_DIST_PATH is not configured; failing over with 404")
            return None

        build_path = Path(static_dir)
        if not build_path.exists():
            app.logger.warning("Client build folder %s missing; cannot serve %s", static_dir, path)
            return None

        normalized_path = path.strip("/")
        if normalized_path:
            candidate = build_path / normalized_path
            if candidate.exists() and candidate.is_file():
                return send_from_directory(static_dir, normalized_path)
            # If the requested path looks like a direct asset (contains a dot) we should not
            # fall back to index.html because browsers expect an actual file for such requests.
            if "." in Path(normalized_path).name:
                return None

        index_file = build_path / "index.html"
        if not index_file.exists():
            app.logger.error("index.html not found in %s; cannot serve SPA shell for %s", static_dir, path)
            return None

        return send_from_directory(static_dir, "index.html")

    @app.route("/.well-known/apple-developer-merchantid-domain-association")
    def _apple_pay_domain_association():
        association_dir = Path(__file__).resolve().parent / "static" / ".well-known"
        association_file = association_dir / "apple-developer-merchantid-domain-association"
        if not association_file.exists():
            app.logger.warning("Apple Pay domain association file %s missing", association_file)
            return {"error": "domain_association_missing"}, 404
        return send_from_directory(str(association_dir), association_file.name)

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def _spa_fallback(path: str):
        if path.startswith("api/"):
            return {"error": "Not Found"}, 404

        response = _serve_client_asset(path)
        if response is not None:
            return response
        return {"error": "client_build_missing"}, 404

    @app.errorhandler(404)
    def _spa_handle_404(error):
        if request.path.startswith("/api/") or request.path == "/api":
            return error
        # Preserve 404s for HTTP methods other than safe navigations.
        if request.method not in {"GET", "HEAD"}:
            return error

        response = _serve_client_asset(request.path)
        if response is not None:
            # On HEAD requests Flask expects an empty response body, so we mutate the response.
            if request.method == "HEAD":
                response.set_data(b"")
            return response

        return error

    @app.cli.command("create-admin")
    @click.argument("name")
    @click.argument("email")
    @click.argument("password")
    def create_admin(name, email, password):
        """Create or update an admin account. Usage: flask create-admin NAME EMAIL PASSWORD"""
        from .models import AdminAccount
        existing = AdminAccount.query.filter_by(email=email).first()
        if existing:
            existing.name = name
            existing.set_password(password)
            db.session.commit()
            click.echo(f"Admin account updated: {email}")
        else:
            admin = AdminAccount(name=name, email=email)
            admin.set_password(password)
            db.session.add(admin)
            db.session.commit()
            click.echo(f"Admin account created: {email}")

    @app.cli.command("ensure-bootstrap-admin")
    def ensure_bootstrap_admin():
        """Create or update a bootstrap admin from ADMIN_BOOTSTRAP_* env vars."""
        from .models import AdminAccount

        name = (os.getenv("ADMIN_BOOTSTRAP_NAME") or "").strip()
        email = (os.getenv("ADMIN_BOOTSTRAP_EMAIL") or "").strip().lower()
        password = os.getenv("ADMIN_BOOTSTRAP_PASSWORD") or ""

        if not email or not password:
            click.echo("Skipping bootstrap admin: ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD are required.")
            return

        existing = AdminAccount.query.filter(func.lower(AdminAccount.email) == email).first()
        if existing:
            if name:
                existing.name = name
            existing.set_password(password)
            db.session.commit()
            click.echo(f"Bootstrap admin updated: {email}")
            return

        admin = AdminAccount(name=name or email.split("@", 1)[0].title(), email=email)
        admin.set_password(password)
        db.session.add(admin)
        db.session.commit()
        click.echo(f"Bootstrap admin created: {email}")

    @app.cli.command("optimize-uploads")
    @click.option("--max-edge", default=1600, show_default=True, type=int, help="Maximum image edge (px) when optimizing.")
    def optimize_uploads(max_edge: int):
        """
        Compress and downscale stored uploads in-place (database + local upload folder).
        Useful to shrink legacy assets after deploying image optimization.
        """
        from .models import StoredUpload
        from .routes import _get_upload_root, _optimize_image_bytes

        upload_dir = _get_upload_root()
        optimized = 0
        skipped = 0
        failed = 0

        for upload in StoredUpload.query.yield_per(50):
            original_bytes = upload.data or b""
            optimized_bytes, content_type = _optimize_image_bytes(
                original_bytes,
                upload.filename,
                upload.content_type,
                max_edge=max_edge,
            )
            if optimized_bytes is None:
                failed += 1
                continue
            if optimized_bytes != original_bytes or (content_type and content_type != upload.content_type):
                upload.data = optimized_bytes
                if content_type:
                    upload.content_type = content_type
                optimized += 1
                file_path = upload_dir / upload.filename
                try:
                    file_path.write_bytes(optimized_bytes)
                except OSError:
                    failed += 1
            else:
                skipped += 1

        db.session.commit()
        click.echo(f"Optimized: {optimized}, unchanged: {skipped}, failed: {failed}")

    return app


# Expose a module-level Flask application so Gunicorn can import `app:app`
# even when the Procfile or hosting platform still references that target.
app = create_app()
