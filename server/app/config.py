import os
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlparse, unquote
from typing import Any, Dict

from flask import Flask
from flask_sqlalchemy import SQLAlchemy

_DEFAULT_POOL_RECYCLE_SECONDS = 600

db = SQLAlchemy()


def _int_from_env(name: str, default: int) -> int:
    """Attempt to parse an integer environment variable."""
    raw = os.getenv(name)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _engine_defaults(app: Flask) -> Dict[str, Any]:
    """Return the engine option defaults aligned with deployment repo."""
    # Flask-SQLAlchemy only sets `engine_options` after the extension initialises,
    # so default to an empty mapping when the attribute is absent during startup.
    options = dict(getattr(db, "engine_options", {}) or {})
    options.update(app.config.get("SQLALCHEMY_ENGINE_OPTIONS", {}))

    if not options.get("pool_pre_ping"):
        options["pool_pre_ping"] = True
    if "pool_recycle" not in options:
        options["pool_recycle"] = _int_from_env("SQLALCHEMY_POOL_RECYCLE", _DEFAULT_POOL_RECYCLE_SECONDS)
    if "pool_timeout" not in options:
        timeout = os.getenv("SQLALCHEMY_POOL_TIMEOUT")
        if timeout:
            try:
                options["pool_timeout"] = int(timeout)
            except ValueError:
                app.logger.warning(
                    "Invalid SQLALCHEMY_POOL_TIMEOUT=%r. Falling back to driver default.",
                    timeout,
                )
    return options


def _resolve_database_uri(app: Flask) -> str:
    """Determine the database URI and require the tredicy_db database."""
    # Prefer the platform-provided URL when both are present.
    # This avoids a stale DATABASE_URI loaded from a checked-in .env from
    # overriding the current deployment connection string.
    uri = os.getenv("DATABASE_URL") or os.getenv("DATABASE_URI")
    if not uri:
        raise RuntimeError("DATABASE_URL or DATABASE_URI must be set and point to the /tredicy_db database.")

    parsed = urlparse(uri)
    if parsed.scheme.startswith("sqlite"):
        if os.getenv("PYTEST_CURRENT_TEST"):
            return uri
        raise RuntimeError("SQLite DATABASE_URL/DATABASE_URI is only allowed during automated tests.")

    database_name = unquote(parsed.path.lstrip("/"))
    if database_name != "tredicy_db":
        raise RuntimeError(
            f"DATABASE_URL/DATABASE_URI must target the /tredicy_db database, got /{database_name or '<missing>'}."
        )

    return uri


def configure_app(app: Flask) -> SQLAlchemy:
    """
    Apply database settings, ensure SQLAlchemy engine defaults, and initialise the extension.
    Mirrors the bootstrap pattern used in the t3-full-stack-deployed project.
    """
    app.config["SQLALCHEMY_DATABASE_URI"] = _resolve_database_uri(app)
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config.setdefault("JSON_SORT_KEYS", False)
    app.config["FLASK_ENV"] = os.getenv("FLASK_ENV", "development")
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-key")
    app.config["IDENTITY_ENCRYPTION_KEY"] = os.getenv("IDENTITY_ENCRYPTION_KEY")
    if not app.config["IDENTITY_ENCRYPTION_KEY"] and app.config.get("FLASK_ENV") == "production":
        raise RuntimeError("IDENTITY_ENCRYPTION_KEY must be set in production.")
    app.secret_key = app.config["SECRET_KEY"]

    if app.config["FLASK_ENV"] == "production" and app.config["SECRET_KEY"] == "dev-secret-key":
        raise RuntimeError("SECRET_KEY must be configured in production environments.")

    app.config["SESSION_COOKIE_HTTPONLY"] = True
    secure_env = os.getenv("SESSION_COOKIE_SECURE")
    if secure_env is None:
        secure_cookie = app.config["FLASK_ENV"] == "production"
    else:
        secure_cookie = secure_env.lower() in {"1", "true", "yes"}
    app.config.setdefault("SESSION_COOKIE_SECURE", secure_cookie)

    same_site_env = os.getenv("SESSION_COOKIE_SAMESITE")
    if same_site_env:
        same_site_value = same_site_env
    elif app.config["FLASK_ENV"] == "production":
        same_site_value = "Strict"
    else:
        same_site_value = "Lax"
    app.config.setdefault("SESSION_COOKIE_SAMESITE", same_site_value)
    app.config.setdefault("PERMANENT_SESSION_LIFETIME", timedelta(days=int(os.getenv("SESSION_LIFETIME_DAYS", "7"))))

    engine_options = _engine_defaults(app)
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = engine_options

    uploads_dir = Path(os.getenv("UPLOAD_FOLDER", Path(__file__).resolve().parent.parent / "uploads"))
    uploads_dir.mkdir(parents=True, exist_ok=True)
    app.config["UPLOAD_FOLDER"] = str(uploads_dir)

    # Upload size ceiling — can be overridden via .env
    max_upload_bytes = _int_from_env("R2_UPLOAD_MAX_BYTES", 10 * 1024 * 1024)
    app.config.setdefault("MAX_CONTENT_LENGTH", max_upload_bytes)

    # Cloudflare R2 / S3-compatible storage
    # R2_* vars take precedence; UPLOADS_S3_* are kept for backwards compatibility.
    app.config["UPLOADS_S3_BUCKET"] = os.getenv("R2_BUCKET") or os.getenv("UPLOADS_S3_BUCKET")
    app.config["UPLOADS_S3_REGION"] = os.getenv("R2_REGION") or os.getenv("UPLOADS_S3_REGION") or "auto"
    app.config["UPLOADS_S3_PREFIX"] = os.getenv("UPLOADS_S3_PREFIX", "uploads")
    # R2 endpoint URL (e.g. https://<account_id>.r2.cloudflarestorage.com)
    app.config["UPLOADS_S3_ENDPOINT_URL"] = os.getenv("R2_ENDPOINT_URL") or os.getenv("UPLOADS_S3_ENDPOINT_URL")
    # R2 credentials (separate from general AWS creds so they don't conflict)
    app.config["UPLOADS_S3_ACCESS_KEY_ID"] = os.getenv("R2_ACCESS_KEY_ID") or os.getenv("AWS_ACCESS_KEY_ID")
    app.config["UPLOADS_S3_SECRET_ACCESS_KEY"] = os.getenv("R2_SECRET_ACCESS_KEY") or os.getenv("AWS_SECRET_ACCESS_KEY")
    # Public base URL for gallery images (publicly readable objects only).
    # Private reservation assets are served through the Flask proxy — leave this blank for them.
    app.config["UPLOADS_PUBLIC_BASE_URL"] = os.getenv("R2_PUBLIC_BASE_URL") or os.getenv("UPLOADS_PUBLIC_BASE_URL")
    # R2 does NOT support ACLs — keep this empty so boto3 doesn't send the ACL header.
    app.config["UPLOADS_S3_ACL"] = os.getenv("UPLOADS_S3_ACL", "")
    # Presigned URL TTL in seconds (used for admin download links to private objects)
    app.config["UPLOADS_SIGNED_URL_TTL"] = _int_from_env("R2_SIGNED_URL_TTL_SECONDS", 900)

    app.config["MAILGUN_DOMAIN"] = os.getenv("MAILGUN_DOMAIN")
    app.config["MAILGUN_API_KEY"] = os.getenv("MAILGUN_API_KEY")
    app.config["MAILGUN_FROM"] = os.getenv("MAILGUN_FROM") or os.getenv("MAILGUN_FROM_EMAIL")
    app.config["INTERNAL_BOOKING_NOTIFICATION_EMAIL"] = os.getenv(
        "INTERNAL_BOOKING_NOTIFICATION_EMAIL", "reservations@tredicisocial.com"
    )
    app.config["CLIENT_BASE_URL"] = os.getenv("CLIENT_BASE_URL")
    app.config["BRAND_NAME"] = os.getenv("BRAND_NAME", "Tredici Social")
    app.config["EMAIL_LOGO_URL"] = os.getenv("EMAIL_LOGO_URL")
    app.config["BOOKING_LOCATION_NAME"] = os.getenv("BOOKING_LOCATION_NAME") or app.config["BRAND_NAME"]

    db.init_app(app)

    return db
