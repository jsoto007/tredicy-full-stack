import os
from datetime import timedelta
from pathlib import Path
from typing import Any, Dict

from flask import Flask
from flask_sqlalchemy import SQLAlchemy

_DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "blackink_dev.db"
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
    """Determine the database URI, preferring DATABASE_URI and warning on legacy vars."""
    uri = os.getenv("DATABASE_URI")
    if uri:
        return uri

    legacy_uri = os.getenv("DATABASE_URL")
    if legacy_uri:
        app.logger.warning(
            "DATABASE_URL is deprecated; rename this variable to DATABASE_URI."
        )
        return legacy_uri

    return f"sqlite+pysqlite:///{_DEFAULT_DB_PATH}"


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
    app.secret_key = app.config["SECRET_KEY"]

    if app.config["FLASK_ENV"] == "production" and app.config["SECRET_KEY"] == "dev-secret-key":
        raise RuntimeError("SECRET_KEY must be configured in production environments.")

    app.config.setdefault("SESSION_COOKIE_HTTPONLY", True)
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
    app.config.setdefault("MAX_CONTENT_LENGTH", 10 * 1024 * 1024)  # 10 MB upload ceiling
    app.config["UPLOADS_S3_BUCKET"] = os.getenv("UPLOADS_S3_BUCKET")
    app.config["UPLOADS_S3_REGION"] = os.getenv("UPLOADS_S3_REGION")
    app.config["UPLOADS_S3_PREFIX"] = os.getenv("UPLOADS_S3_PREFIX", "uploads")
    app.config["UPLOADS_PUBLIC_BASE_URL"] = os.getenv("UPLOADS_PUBLIC_BASE_URL")
    app.config["UPLOADS_S3_ACL"] = os.getenv("UPLOADS_S3_ACL", "public-read")

    app.config["SQUARE_APPLICATION_ID"] = os.getenv("SQUARE_APPLICATION_ID")
    app.config["SQUARE_LOCATION_ID"] = os.getenv("SQUARE_LOCATION_ID")
    app.config["SQUARE_ACCESS_TOKEN"] = os.getenv("SQUARE_ACCESS_TOKEN")
    app.config["SQUARE_ENVIRONMENT"] = os.getenv("SQUARE_ENVIRONMENT", "sandbox").lower()
    app.config["SQUARE_DEPOSIT_AMOUNT_CENTS"] = max(1, _int_from_env("SQUARE_DEPOSIT_AMOUNT_CENTS", 10000))
    app.config["SQUARE_DEPOSIT_CURRENCY"] = (os.getenv("SQUARE_DEPOSIT_CURRENCY") or "USD").upper()
    if app.config["FLASK_ENV"] == "production":
        # Never use fake payments in production; real deposits must be charged.
        app.config["SQUARE_FAKE_PAYMENTS"] = False
    else:
        fake_flag = os.getenv("SQUARE_FAKE_PAYMENTS")
        if fake_flag is None:
            app.config["SQUARE_FAKE_PAYMENTS"] = True
        else:
            app.config["SQUARE_FAKE_PAYMENTS"] = fake_flag.strip().lower() in {"1", "true", "yes", "y"}

    app.config["MAILGUN_DOMAIN"] = os.getenv("MAILGUN_DOMAIN")
    app.config["MAILGUN_API_KEY"] = os.getenv("MAILGUN_API_KEY")
    app.config["MAILGUN_FROM"] = os.getenv("MAILGUN_FROM")
    app.config["INTERNAL_BOOKING_NOTIFICATION_EMAIL"] = os.getenv(
        "INTERNAL_BOOKING_NOTIFICATION_EMAIL", "jsoto@sotodev.com"
    )
    app.config["CLIENT_BASE_URL"] = os.getenv("CLIENT_BASE_URL")
    app.config["BRAND_NAME"] = os.getenv("BRAND_NAME", "Black Work NYC")
    app.config["EMAIL_LOGO_URL"] = os.getenv("EMAIL_LOGO_URL")
    app.config["BOOKING_LOCATION_NAME"] = os.getenv("BOOKING_LOCATION_NAME") or app.config["BRAND_NAME"]

    db.init_app(app)

    return db
