import base64
import hashlib
import hmac
import json
import math
import mimetypes
import secrets
from html import escape
from io import BytesIO
from datetime import date, datetime, time, timedelta, timezone
from functools import wraps
from pathlib import Path
from uuid import uuid4
from urllib.parse import urlsplit

import boto3
import stripe
from botocore.exceptions import BotoCoreError, ClientError
from PIL import Image, UnidentifiedImageError
from flask import Blueprint, current_app, g, jsonify, request, send_file, send_from_directory, session
from flask_limiter.errors import RateLimitExceeded
from flask_limiter.util import get_remote_address
from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import case, func, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import joinedload
from werkzeug.exceptions import RequestEntityTooLarge
from werkzeug.utils import secure_filename

from .emails import (
    send_activation_email,
    send_booking_confirmation_email,
    send_internal_booking_notification,
    send_appointment_status_update_email,
    send_email_verification_email,
    send_password_changed_email,
    send_password_reset_email,
    send_signup_email,
)

from .config import db
from .extensions import limiter
from .models import (
    AdminAccount,
    AdminActivityLog,
    AppointmentAsset,
    AppointmentPayment,
    ClientAccount,
    AccountActivationToken,
    EmailVerificationToken,
    ClientDocument,
    Consultation,
    GalleryItem,
    SystemSetting,
    StudioAvailabilityBlock,
    StudioClosure,
    StudioWorkingHour,
    TattooAppointment,
    TattooCategory,
    Testimonial,
    UserNotification,
    SessionOption,
    StoredUpload,
    PasswordResetRequest,
)
from .status_helpers import format_status_label

api_bp = Blueprint("api", __name__)

WEEK_DAYS = (
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
)

MINIMUM_APPOINTMENT_DURATION_MINUTES = 60

DEFAULT_OPERATING_HOURS = [
    {
        "day": "monday",
        "is_open": True,
        "open_time": "10:00",
        "close_time": "18:00",
        "minimum_duration_minutes": MINIMUM_APPOINTMENT_DURATION_MINUTES,
    },
    {
        "day": "tuesday",
        "is_open": True,
        "open_time": "10:00",
        "close_time": "18:00",
        "minimum_duration_minutes": MINIMUM_APPOINTMENT_DURATION_MINUTES,
    },
    {
        "day": "wednesday",
        "is_open": True,
        "open_time": "10:00",
        "close_time": "18:00",
        "minimum_duration_minutes": MINIMUM_APPOINTMENT_DURATION_MINUTES,
    },
    {
        "day": "thursday",
        "is_open": True,
        "open_time": "10:00",
        "close_time": "18:00",
        "minimum_duration_minutes": MINIMUM_APPOINTMENT_DURATION_MINUTES,
    },
    {
        "day": "friday",
        "is_open": True,
        "open_time": "10:00",
        "close_time": "18:00",
        "minimum_duration_minutes": MINIMUM_APPOINTMENT_DURATION_MINUTES,
    },
    {
        "day": "saturday",
        "is_open": True,
        "open_time": "10:00",
        "close_time": "16:00",
        "minimum_duration_minutes": MINIMUM_APPOINTMENT_DURATION_MINUTES,
    },
    {
        "day": "sunday",
        "is_open": False,
        "open_time": "10:00",
        "close_time": "14:00",
        "minimum_duration_minutes": MINIMUM_APPOINTMENT_DURATION_MINUTES,
    },
]

HOURLY_RATE_SETTING_KEY = "studio_hourly_rate_cents"
DEFAULT_HOURLY_RATE_CENTS = 20000
BOOKING_FEE_SETTING_KEY = "booking_fee_percent"
DEFAULT_BOOKING_FEE_PERCENT = 20
MINIMUM_BOOKING_FEE_PERCENT = 20

ALLOWED_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
ALLOWED_IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_UPLOAD_EXTENSIONS = ALLOWED_IMAGE_EXTENSIONS | {"pdf", "txt", "doc", "docx"}
UPLOAD_RATE_LIMIT_MESSAGE = "Too many uploads. Please wait a moment and try again."

DAY_TO_INDEX = {day: index for index, day in enumerate(WEEK_DAYS)}
INDEX_TO_DAY = {index: day for day, index in DAY_TO_INDEX.items()}
NON_BLOCKING_APPOINTMENT_STATUSES = {"cancelled", "cancelled_by_client", "declined", "no_show"}
DEFAULT_SLOT_INTERVAL_MINUTES = 60
MINIMUM_APPOINTMENT_DURATION_MINUTES = 60

ACTIVATION_TOKEN_TTL = timedelta(hours=24)
EMAIL_VERIFICATION_TTL = timedelta(minutes=30)
PASSWORD_RESET_TTL = timedelta(minutes=30)
VERIFICATION_CODE_LENGTH = 6
PASSWORD_MIN_LENGTH = 8

PLACEMENT_BASE_MINUTES = {
    "finger": 60,
    "wrist": 60,
    "ankle": 75,
    "forearm": 90,
    "upper_arm": 120,
    "shoulder": 120,
    "hand": 120,
    "calf": 120,
    "thigh": 150,
    "rib": 150,
    "neck": 150,
    "chest": 180,
    "back": 240,
    "full_sleeve": 300,
}

CSRF_EXEMPT_ENDPOINTS = {
    "api.auth_login",
    "api.auth_register",
    "api.auth_csrf",
    "api.stripe_webhook",
}

SIZE_MULTIPLIERS = {
    "small": 1.0,  # up to palm-sized
    "medium": 1.5,  # hand-sized to quarter sleeve
    "large": 2.0,  # half sleeve / medium panel
    "xl": 3.0,  # full back / large format
}

class MediaStorageError(Exception):
    pass


class StripePaymentError(Exception):
    pass


class StripePaymentPendingError(StripePaymentError):
    pass


def _stripe_get(value, key, default=None):
    if value is None:
        return default
    if isinstance(value, dict):
        return value.get(key, default)
    return getattr(value, key, default)


def _use_s3_uploads() -> bool:
    return bool(current_app.config.get("UPLOADS_S3_BUCKET"))


def _build_s3_key(filename: str) -> str:
    prefix = (current_app.config.get("UPLOADS_S3_PREFIX") or "").strip().strip("/")
    if prefix:
        return f"{prefix.rstrip('/')}/{filename}"
    return filename


def _make_s3_client():
    """Build a boto3 S3 client wired for Cloudflare R2 (or plain AWS S3).

    R2 requires an explicit endpoint_url and uses Access Key / Secret Key
    stored in the R2_* env vars (mapped to UPLOADS_S3_* in config.py).
    """
    kwargs: dict = {
        "region_name": current_app.config.get("UPLOADS_S3_REGION") or None,
    }
    endpoint_url = current_app.config.get("UPLOADS_S3_ENDPOINT_URL")
    if endpoint_url:
        kwargs["endpoint_url"] = endpoint_url
    access_key = current_app.config.get("UPLOADS_S3_ACCESS_KEY_ID")
    secret_key = current_app.config.get("UPLOADS_S3_SECRET_ACCESS_KEY")
    if access_key and secret_key:
        kwargs["aws_access_key_id"] = access_key
        kwargs["aws_secret_access_key"] = secret_key
    return boto3.client("s3", **kwargs)


def _get_upload_root() -> Path:
    upload_dir = Path(current_app.config["UPLOAD_FOLDER"])
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir.resolve()


def _persist_upload_record(safe_name: str, content: bytes, content_type: str) -> bool:
    """Persist the upload bytes in the database so redeploys remain intact."""
    existing = StoredUpload.query.filter_by(filename=safe_name).one_or_none()
    if existing:
        if existing.data == content and existing.content_type == content_type:
            return False
        existing.data = content
        existing.content_type = content_type
        return True
    db.session.add(
        StoredUpload(
            filename=safe_name,
            content_type=content_type,
            data=content,
        )
    )
    return True


def _with_cache_headers(response, *, seconds: int = 31536000, immutable: bool = True):
    """
    Attach aggressive cache headers for static-ish assets (e.g., uploads).
    Uses long-lived public cache with optional immutable flag so browsers and CDNs
    avoid re-fetching unchanged resources.
    """
    if not response:
        return response
    directives = [f"max-age={int(seconds)}", "public"]
    if immutable:
        directives.append("immutable")
    response.headers["Cache-Control"] = ", ".join(directives)
    return response


def _optimize_image_bytes(raw_bytes: bytes, filename: str, content_type: str | None, *, max_edge: int = 1600):
    """
    Compress and downscale image bytes while keeping quality acceptable.
    - Downscale to a max edge size.
    - Re-encode with sane quality/optimization flags.
    Falls back to original payload on failure.
    """
    if not raw_bytes:
        return raw_bytes, content_type
    try:
        with Image.open(BytesIO(raw_bytes)) as image:
            image_format = (image.format or "").upper()
            target_format = "JPEG" if image_format in {"JPEG", "JPG", "JPE"} else image_format or "JPEG"
            # Ensure RGB for formats that do not support alpha cleanly.
            if target_format == "JPEG":
                if image.mode in {"RGBA", "P", "LA"}:
                    background = Image.new("RGB", image.size, (255, 255, 255))
                    background.paste(image.convert("RGBA"), mask=image.convert("RGBA").split()[-1])
                    image = background
                elif image.mode != "RGB":
                    image = image.convert("RGB")
            else:
                if image.mode not in {"RGB", "RGBA"}:
                    image = image.convert("RGBA")

            image.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
            buffer = BytesIO()
            save_kwargs = {}
            new_content_type = content_type or "application/octet-stream"

            if target_format == "JPEG":
                save_kwargs = {"format": "JPEG", "optimize": True, "progressive": True, "quality": 82}
                new_content_type = "image/jpeg"
            elif target_format == "WEBP":
                save_kwargs = {"format": "WEBP", "quality": 80, "method": 6}
                new_content_type = "image/webp"
            elif target_format == "PNG":
                save_kwargs = {"format": "PNG", "optimize": True}
                new_content_type = "image/png"
            else:
                # Unsupported/unknown format; return as-is.
                return raw_bytes, content_type

            image.save(buffer, **save_kwargs)
            optimized = buffer.getvalue()
            # Keep the smaller of the two to avoid regressions.
            if len(optimized) < len(raw_bytes):
                return optimized, new_content_type
            return raw_bytes, content_type
    except (UnidentifiedImageError, OSError):
        return raw_bytes, content_type


def _prepare_upload_payload(file_storage, safe_name: str) -> tuple[bytes, str]:
    file_storage.stream.seek(0)
    raw_payload = file_storage.read()
    file_storage.stream.seek(0)
    content_type = file_storage.mimetype or "application/octet-stream"
    extension = Path(safe_name).suffix.lower().lstrip(".")
    if extension in ALLOWED_IMAGE_EXTENSIONS:
        optimized, new_content_type = _optimize_image_bytes(raw_payload, safe_name, content_type)
        return optimized, new_content_type or content_type
    return raw_payload, content_type


def _store_media_locally(file_storage, safe_name: str):
    upload_dir = _get_upload_root()
    destination = upload_dir / safe_name
    payload, content_type = _prepare_upload_payload(file_storage, safe_name)
    destination.write_bytes(payload)
    _persist_upload_record(safe_name, payload, content_type)
    return safe_name, f"/api/uploads/{safe_name}"


def _public_s3_url(bucket: str, key: str) -> str:
    explicit_base = current_app.config.get("UPLOADS_PUBLIC_BASE_URL")
    if explicit_base:
        return f"{explicit_base.rstrip('/')}/{key}"
    region = current_app.config.get("UPLOADS_S3_REGION") or ""
    if region and region.lower() != "us-east-1":
        return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"
    return f"https://{bucket}.s3.amazonaws.com/{key}"


def _store_media_s3(file_storage, safe_name: str):
    bucket = current_app.config.get("UPLOADS_S3_BUCKET")
    if not bucket:
        raise MediaStorageError("S3 bucket not configured.")
    key = _build_s3_key(safe_name)
    payload, content_type = _prepare_upload_payload(file_storage, safe_name)
    extra_args = {"ContentType": content_type or "application/octet-stream"}
    # R2 does not support ACLs — only set ACL when explicitly configured.
    acl = current_app.config.get("UPLOADS_S3_ACL") or ""
    if acl:
        extra_args["ACL"] = acl
    s3_client = _make_s3_client()
    try:
        s3_client.upload_fileobj(BytesIO(payload), bucket, key, ExtraArgs=extra_args)
    except (BotoCoreError, ClientError) as exc:
        raise MediaStorageError(str(exc)) from exc
    # Always persist a DB record so the Flask proxy can serve private files
    # without streaming from R2 on every request (avoids public bucket URLs).
    _persist_upload_record(safe_name, payload, content_type or "application/octet-stream")
    # Return the /api/uploads/ proxy URL — private assets must never expose a
    # direct R2 URL; the serve_uploaded_file route enforces access control.
    return key, f"/api/uploads/{safe_name}"


def store_uploaded_media(file_storage, safe_name: str):
    if _use_s3_uploads():
        return _store_media_s3(file_storage, safe_name)
    return _store_media_locally(file_storage, safe_name)


def _cleanup_upload_target(target):
    if not target:
        return
    mode = target.get("mode")
    if mode == "local":
        path = target.get("path")
        if path:
            Path(path).unlink(missing_ok=True)
    elif mode == "s3":
        bucket = current_app.config.get("UPLOADS_S3_BUCKET")
        key = target.get("key")
        if not bucket or not key:
            return
        try:
            _make_s3_client().delete_object(Bucket=bucket, Key=key)
        except (BotoCoreError, ClientError):
            current_app.logger.warning("Unable to delete orphaned upload %s from bucket %s", key, bucket)


IDENTITY_ENCRYPTION_PREFIX = "enc::"


def _identity_cipher():
    cached = getattr(current_app, "_identity_cipher", None)
    if cached is False:
        return None
    if cached:
        return cached
    secret = current_app.config.get("IDENTITY_ENCRYPTION_KEY") or current_app.config.get("SECRET_KEY")
    if not secret:
        current_app._identity_cipher = False
        return None
    digest = hashlib.sha256(str(secret).encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(digest)
    try:
        cipher = Fernet(key)
    except (ValueError, TypeError):
        current_app._identity_cipher = False
        return None
    current_app._identity_cipher = cipher
    return cipher


def encrypt_identity_value(value: str | None) -> str | None:
    if not value:
        return value
    cipher = _identity_cipher()
    if not cipher:
        return value
    if value.startswith(IDENTITY_ENCRYPTION_PREFIX):
        return value
    token = cipher.encrypt(value.encode("utf-8"))
    return f"{IDENTITY_ENCRYPTION_PREFIX}{token.decode('utf-8')}"


def decrypt_identity_value(value: str | None) -> str | None:
    if not value:
        return value
    if not value.startswith(IDENTITY_ENCRYPTION_PREFIX):
        return value
    cipher = _identity_cipher()
    if not cipher:
        return None
    token = value[len(IDENTITY_ENCRYPTION_PREFIX):].encode("utf-8")
    try:
        return cipher.decrypt(token).decode("utf-8")
    except InvalidToken:
        current_app.logger.warning("Unable to decrypt identity asset with configured key.")
        return None


def _stripe_payments_active() -> bool:
    if current_app.config.get("STRIPE_FAKE_PAYMENTS"):
        return True
    return bool(current_app.config.get("STRIPE_SECRET_KEY"))


def _stripe_public_enabled() -> bool:
    if current_app.config.get("STRIPE_FAKE_PAYMENTS"):
        return False
    return bool(current_app.config.get("STRIPE_PUBLISHABLE_KEY"))


def _payment_currency() -> str:
    return (current_app.config.get("STRIPE_CURRENCY") or "USD").upper()


def _payment_country_code() -> str:
    return (current_app.config.get("STRIPE_COUNTRY_CODE") or "US").upper()


def _stripe_client():
    api_key = current_app.config.get("STRIPE_SECRET_KEY")
    if not api_key:
        raise StripePaymentError("Stripe payments are not configured.")
    stripe.api_key = api_key
    return stripe


def _public_client_base_url() -> str:
    configured = (current_app.config.get("CLIENT_BASE_URL") or "").strip().rstrip("/")
    if configured:
        return configured
    return request.host_url.rstrip("/")


def create_stripe_checkout_session(
    *,
    appointment: TattooAppointment,
    amount_cents: int,
    currency: str,
    note: str,
    contact_email: str | None,
    pay_full_amount: bool,
) -> dict:
    charge_amount = max(1, int(amount_cents or 0))
    if current_app.config.get("STRIPE_FAKE_PAYMENTS"):
        return {
            "id": f"cs_demo_{secrets.token_hex(6)}",
            "url": f"{_public_client_base_url()}/booking/confirmation?appointment_id={appointment.id}&payment=demo",
            "payment_status": "paid",
            "payment_intent": f"pi_demo_{secrets.token_hex(6)}",
            "amount_total": charge_amount,
            "currency": currency.lower(),
        }

    base_url = _public_client_base_url()
    checkout = _stripe_client().checkout.Session.create(
        mode="payment",
        ui_mode="embedded",
        return_url=f"{base_url}/booking/confirmation?appointment_id={appointment.id}&session_id={{CHECKOUT_SESSION_ID}}",
        client_reference_id=str(appointment.id),
        customer_email=contact_email or None,
        payment_intent_data={
            "metadata": {
                "appointment_id": str(appointment.id),
                "reference_code": appointment.reference_code or "",
                "pay_full_amount": "true" if pay_full_amount else "false",
            }
        },
        metadata={
            "appointment_id": str(appointment.id),
            "reference_code": appointment.reference_code or "",
        },
        line_items=[
            {
                "quantity": 1,
                "price_data": {
                    "currency": currency.lower(),
                    "unit_amount": charge_amount,
                    "product_data": {
                        "name": note,
                        "description": appointment.session_option.name if appointment.session_option and appointment.session_option.name else "Nail appointment",
                    },
                },
            }
        ],
    )
    return checkout


def _latest_identity_assets_for_client(client: ClientAccount):
    if not client or not hasattr(client, "appointment_assets"):
        return {}
    query = client.appointment_assets
    if hasattr(query, "filter"):
        candidates = (
            query.filter(
                AppointmentAsset.kind.in_(["id_front", "id_back"]),
                AppointmentAsset.file_url.isnot(None),
            )
            .order_by(AppointmentAsset.created_at.desc())
            .all()
        )
    else:
        candidates = [
            asset
            for asset in query
            if asset.kind in {"id_front", "id_back"} and getattr(asset, "file_url", None)
        ]
        candidates.sort(key=lambda asset: asset.created_at or datetime.min, reverse=True)
    found = {}
    for asset in candidates:
        if asset.kind not in found:
            found[asset.kind] = asset.file_url
        if len(found) == 2:
            break
    return found


def parse_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "t", "yes", "y"}


def generate_reference_code():
    prefix = datetime.utcnow().strftime("APT%Y%m%d")
    for _ in range(5):
        candidate = f"{prefix}-{secrets.token_hex(2).upper()}"
        if not TattooAppointment.query.filter_by(reference_code=candidate).first():
            return candidate
    return f"{prefix}-{int(datetime.utcnow().timestamp())}"


def set_session(role: str, identifier: int):
    session["role"] = role
    session["user_id"] = identifier
    session.permanent = True
    issue_csrf_token()


def clear_session():
    session.pop("role", None)
    session.pop("user_id", None)
    session.pop("csrf_token", None)


def issue_csrf_token():
    token = secrets.token_urlsafe(32)
    session["csrf_token"] = token
    return token


def get_csrf_token():
    token = session.get("csrf_token")
    if not token:
        token = issue_csrf_token()
    return token


def get_current_admin():
    if session.get("role") != "admin":
        return None
    admin_id = session.get("user_id")
    if not admin_id:
        return None
    return AdminAccount.query.get(admin_id)


def get_current_user():
    role = session.get("role")
    identifier = session.get("user_id")
    if role == "admin":
        return AdminAccount.query.get(identifier)
    if role == "user":
        return ClientAccount.query.get(identifier)
    return None


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        admin = get_current_admin()
        if not admin:
            return jsonify({"error": "Unauthorized"}), 401
        g.current_admin = admin
        try:
            return fn(*args, **kwargs)
        finally:
            g.pop("current_admin", None)

    return wrapper


def user_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = get_current_user()
        if not user or session.get("role") != "user":
            return jsonify({"error": "Unauthorized"}), 401
        g.current_user = user
        try:
            return fn(*args, **kwargs)
        finally:
            g.pop("current_user", None)

    return wrapper


def _admin_upload_limit_key():
    admin = getattr(g, "current_admin", None)
    if admin and getattr(admin, "id", None):
        return f"admin:{admin.id}"
    return get_remote_address()


def _client_upload_limit_key():
    user = getattr(g, "current_user", None)
    if user and getattr(user, "id", None):
        return f"user:{user.id}"
    return get_remote_address()


def serialize_admin(admin):
    if not admin:
        return None
    return {
        "id": admin.id,
        "name": admin.name,
        "email": admin.email,
        "last_login_at": admin.last_login_at.isoformat() if admin.last_login_at else None,
    }


def serialize_category(category):
    return {
        "id": category.id,
        "name": category.name,
        "description": category.description,
        "is_active": category.is_active,
        "created_at": category.created_at.isoformat() if category.created_at else None,
        "updated_at": category.updated_at.isoformat() if category.updated_at else None,
    }


def serialize_gallery_item(item):
    return {
        "id": item.id,
        "image_url": item.image_url,
        "alt": item.alt,
        "caption": item.caption,
        "is_published": item.is_published,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "category": serialize_category(item.category) if item.category else None,
        "uploaded_by": serialize_admin(item.uploaded_by) if item.uploaded_by else None,
    }


def serialize_notification(notification):
    return {
        "id": notification.id,
        "title": notification.title,
        "body": notification.body,
        "category": notification.category,
        "is_read": notification.is_read,
        "created_at": notification.created_at.isoformat() if notification.created_at else None,
    }


from zoneinfo import ZoneInfo

NYC_TZ = ZoneInfo("America/New_York")


def _nyc_now_naive() -> datetime:
    """Return the current New York local time as a naive datetime."""
    return datetime.now(NYC_TZ).replace(tzinfo=None)


def _normalize_schedule_datetime(value: datetime | None) -> datetime | None:
    """Normalize schedule datetimes to the naive NYC format stored in the DB."""
    if value is None:
        return None
    if value.tzinfo is not None:
        return value.astimezone(NYC_TZ).replace(tzinfo=None)
    return value

def _format_status_schedule_label(dt):
    if not dt:
        return None
    try:
        # Naive datetimes from the DB are in NYC local time
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=NYC_TZ)
        dt = dt.astimezone(NYC_TZ)
        return dt.strftime("%A, %B %d %Y at %I:%M %p")
    except Exception:
        pass
    return dt.strftime("%A, %B %d %Y at %I:%M %p")


DEFAULT_PREFERENCES = {
    "email_reminders": True,
    "sms_reminders": False,
    "aftercare_emails": True,
}


def _client_preferences_key(user_id: int) -> str:
    return f"client_preferences:{user_id}"


def _load_client_preferences(user: ClientAccount) -> dict:
    if not user:
        return DEFAULT_PREFERENCES.copy()
    stored = load_json_setting(_client_preferences_key(user.id), {})
    return {
        key: bool(stored.get(key, DEFAULT_PREFERENCES.get(key, False)))
        for key in DEFAULT_PREFERENCES.keys()
    }


def _save_client_preferences(user: ClientAccount, updates: dict) -> dict:
    if not user:
        return DEFAULT_PREFERENCES.copy()
    key = _client_preferences_key(user.id)
    current = _load_client_preferences(user)
    merged = {**current, **{k: bool(v) for k, v in updates.items() if k in DEFAULT_PREFERENCES}}
    setting = upsert_json_setting(
        key,
        merged,
        description=f"Client preferences for user {user.id}",
    )
    return merged


def serialize_activity(log):
    return {
        "id": log.id,
        "action": log.action,
        "details": log.details,
        "ip_address": log.ip_address,
        "created_at": log.created_at.isoformat() if log.created_at else None,
        "admin": serialize_admin(log.admin),
    }


def serialize_setting(setting):
    return {
        "id": setting.id,
        "key": setting.key,
        "value": setting.value,
        "description": setting.description,
        "is_editable": setting.is_editable,
        "updated_at": setting.updated_at.isoformat() if setting.updated_at else None,
    }


def serialize_session_option(option):
    if not option:
        return None
    return {
        "id": option.id,
        "name": option.name,
        "tagline": option.tagline,
        "description": option.description,
        "category": option.category,
        "duration_minutes": option.duration_minutes,
        "price_cents": option.price_cents,
        "is_active": bool(option.is_active),
        "created_at": option.created_at.isoformat() if option.created_at else None,
        "updated_at": option.updated_at.isoformat() if option.updated_at else None,
    }


def load_active_session_options():
    return (
        SessionOption.query.filter(SessionOption.is_active.is_(True))
        .order_by(SessionOption.duration_minutes.asc())
        .all()
    )


def calculate_booking_fee_amount(total_cents: int, percent: int) -> int:
    if total_cents <= 0:
        return 0
    percent_value = max(percent, MINIMUM_BOOKING_FEE_PERCENT)
    fee = math.ceil(total_cents * percent_value / 100.0)
    return min(total_cents, max(fee, 1))


def load_booking_fee_percent() -> int:
    raw_value = load_json_setting(BOOKING_FEE_SETTING_KEY, DEFAULT_BOOKING_FEE_PERCENT)
    try:
        value = int(raw_value)
    except (TypeError, ValueError):
        value = DEFAULT_BOOKING_FEE_PERCENT
    return max(value, MINIMUM_BOOKING_FEE_PERCENT)


def sync_checkout_payment_for_appointment(
    appointment: TattooAppointment,
    checkout_session_id: str | None,
    *,
    checkout_session: dict | None = None,
):
    if not appointment or not checkout_session_id:
        raise StripePaymentError("Stripe session is required.")

    existing_payment = next(
        (
            payment
            for payment in (appointment.payments or [])
            if payment.provider == "stripe" and payment.provider_payment_id == checkout_session_id
        ),
        None,
    )

    if existing_payment and existing_payment.status == "paid":
        if appointment.status == "awaiting_payment":
            appointment.status = "pending"
        return existing_payment

    if current_app.config.get("STRIPE_FAKE_PAYMENTS"):
        if existing_payment and existing_payment.status == "paid":
            return existing_payment
        amount_cents = existing_payment.amount_cents if existing_payment else 0
        if not existing_payment:
            existing_payment = AppointmentPayment(
                appointment=appointment,
                provider="stripe",
                provider_payment_id=checkout_session_id,
                amount_cents=amount_cents,
                currency=_payment_currency(),
                status="paid",
                note="Stripe demo payment",
            )
            db.session.add(existing_payment)
        else:
            existing_payment.status = "paid"
        appointment.status = "pending"
        return existing_payment

    checkout = checkout_session or _stripe_client().checkout.Session.retrieve(checkout_session_id)
    if str(checkout.get("client_reference_id") or "") != str(appointment.id):
        raise StripePaymentError("Stripe session does not match this appointment.")

    payment_intent_id = checkout.get("payment_intent")
    payment_intent = _stripe_client().PaymentIntent.retrieve(payment_intent_id) if payment_intent_id else None
    payment_intent_status = _stripe_get(payment_intent, "status") if payment_intent else None
    checkout_payment_status = (checkout.get("payment_status") or "").lower()
    checkout_status = (checkout.get("status") or "").lower()

    if checkout_payment_status != "paid" and payment_intent_status != "succeeded":
        if checkout_status == "expired" or payment_intent_status in {"canceled", "requires_payment_method"}:
            if existing_payment:
                existing_payment.status = "failed"
            raise StripePaymentError("Stripe payment was not completed.")
        raise StripePaymentPendingError("Stripe payment is still processing.")

    amount_total = int(checkout.get("amount_total") or 0)
    receipt_url = None
    charges_container = _stripe_get(payment_intent, "charges")
    charges = _stripe_get(charges_container, "data", []) or []
    if charges:
        first_charge = charges[0]
        receipt_url = _stripe_get(first_charge, "receipt_url")

    if not existing_payment:
        existing_payment = AppointmentPayment(
            appointment=appointment,
            provider="stripe",
            provider_payment_id=checkout_session_id,
            status="paid",
            amount_cents=amount_total,
            currency=(checkout.get("currency") or _payment_currency()).upper(),
            receipt_url=receipt_url,
            note="Stripe Checkout payment",
        )
        db.session.add(existing_payment)
    else:
        existing_payment.status = "paid"
        existing_payment.amount_cents = amount_total or existing_payment.amount_cents
        existing_payment.currency = (checkout.get("currency") or existing_payment.currency or _payment_currency()).upper()
        existing_payment.receipt_url = receipt_url or existing_payment.receipt_url
        existing_payment.note = existing_payment.note or "Stripe Checkout payment"

    if appointment.status == "awaiting_payment":
        appointment.status = "pending"

    return existing_payment


def _load_appointment_for_payment(appointment_id: int | str | None):
    if appointment_id in {None, ""}:
        return None
    try:
        normalized_id = int(appointment_id)
    except (TypeError, ValueError):
        return None
    return TattooAppointment.query.options(
        joinedload(TattooAppointment.client),
        joinedload(TattooAppointment.assigned_admin),
        joinedload(TattooAppointment.assets).joinedload(AppointmentAsset.admin_uploader),
        joinedload(TattooAppointment.assets).joinedload(AppointmentAsset.client_uploader),
        joinedload(TattooAppointment.payments),
        joinedload(TattooAppointment.session_option),
    ).get(normalized_id)


def _notify_for_paid_appointment(appointment: TattooAppointment, payment: AppointmentPayment):
    booking_fee_percent = load_booking_fee_percent()
    session_price_cents = appointment.session_option.price_cents if appointment.session_option else calculate_session_price_cents(appointment.duration_minutes)
    charge_amount = payment.amount_cents
    pay_full_amount = charge_amount >= session_price_cents if session_price_cents else False
    send_booking_confirmation_email(
        appointment,
        charge_amount_cents=charge_amount,
        session_price_cents=session_price_cents,
        booking_fee_percent=booking_fee_percent,
        pay_full_amount=pay_full_amount,
        receipt_url=payment.receipt_url,
    )
    send_internal_booking_notification(
        appointment,
        charge_amount_cents=charge_amount,
        session_price_cents=session_price_cents,
        booking_fee_percent=booking_fee_percent,
        pay_full_amount=pay_full_amount,
        receipt_url=payment.receipt_url,
    )


def _hash_activation_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def _verify_code(code: str, hashed: str | None) -> bool:
    if not code or not hashed:
        return False
    return hmac.compare_digest(_hash_code(code), hashed)


def _generate_numeric_code(length: int = VERIFICATION_CODE_LENGTH) -> str:
    alphabet = "0123456789"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _create_activation_token(client: ClientAccount) -> str:
    token = secrets.token_urlsafe(32)
    record = AccountActivationToken(
        client_account=client,
        token_hash=_hash_activation_token(token),
        expires_at=datetime.utcnow() + ACTIVATION_TOKEN_TTL,
    )
    db.session.add(record)
    return token


def _consume_activation_token(token: str):
    if not token:
        return None
    token_hash = _hash_activation_token(token)
    record = (
        AccountActivationToken.query.options(joinedload(AccountActivationToken.client_account))
        .filter_by(token_hash=token_hash, used_at=None)
        .first()
    )
    if not record or record.expires_at < datetime.utcnow():
        return None
    return record


def _issue_email_verification_token(client: ClientAccount, purpose: str = "verify_email"):
    if not client.email:
        return None, None
    tokens = client.email_verification_tokens.all() if hasattr(client.email_verification_tokens, "all") else client.email_verification_tokens
    now = datetime.utcnow()
    for token in tokens or []:
        if not token.is_consumed():
            token.mark_consumed(now)
    code = _generate_numeric_code()
    record = EmailVerificationToken(
        client_account=client,
        email=(client.email or "").strip().lower(),
        purpose=purpose,
        code_hash=_hash_code(code),
        expires_at=now + EMAIL_VERIFICATION_TTL,
    )
    db.session.add(record)
    return record, code


def _verify_email_token(email: str, code: str, purpose: str = "verify_email"):
    normalized = (email or "").strip().lower()
    if not normalized or not code:
        return None
    candidates = (
        EmailVerificationToken.query.options(joinedload(EmailVerificationToken.client_account))
        .filter(
            EmailVerificationToken.email == normalized,
            EmailVerificationToken.purpose == purpose,
            EmailVerificationToken.consumed_at.is_(None),
        )
        .order_by(EmailVerificationToken.created_at.desc())
        .all()
    )
    now = datetime.utcnow()
    for token in candidates:
        if token.is_expired(now=now):
            continue
        if _verify_code(code, token.code_hash):
            return token
    return None


def _issue_password_reset_request(client: ClientAccount, *, request_ip: str | None = None, user_agent: str | None = None):
    if not client.email:
        return None, None
    requests_qs = (
        client.password_reset_requests.all()
        if hasattr(client.password_reset_requests, "all")
        else client.password_reset_requests
    )
    now = datetime.utcnow()
    for request_record in requests_qs or []:
        if not request_record.is_consumed() and not request_record.is_expired(now=now):
            request_record.mark_consumed(now)
    code = _generate_numeric_code()
    record = PasswordResetRequest(
        client_account=client,
        code_hash=_hash_code(code),
        requested_ip=request_ip,
        requested_user_agent=(user_agent or "")[:255] if user_agent else None,
        expires_at=now + PASSWORD_RESET_TTL,
    )
    db.session.add(record)
    return record, code


def _verify_password_reset(email: str, code: str):
    normalized = (email or "").strip().lower()
    if not normalized or not code:
        return None
    candidates = (
        PasswordResetRequest.query.options(joinedload(PasswordResetRequest.client_account))
        .join(ClientAccount)
        .filter(
            func.lower(ClientAccount.email) == normalized,
            PasswordResetRequest.consumed_at.is_(None),
        )
        .order_by(PasswordResetRequest.created_at.desc())
        .all()
    )
    now = datetime.utcnow()
    for request_record in candidates:
        if request_record.is_expired(now=now):
            continue
        if _verify_code(code, request_record.code_hash):
            return request_record
    return None


def load_hourly_rate_cents() -> int:
    raw_rate = load_json_setting(HOURLY_RATE_SETTING_KEY, DEFAULT_HOURLY_RATE_CENTS)
    try:
        value = int(raw_rate)
    except (TypeError, ValueError):
        return DEFAULT_HOURLY_RATE_CENTS
    if value <= 0:
        return DEFAULT_HOURLY_RATE_CENTS
    return value


def calculate_session_price_cents(duration_minutes: int | None) -> int:
    if not duration_minutes or duration_minutes <= 0:
        return 0
    option = SessionOption.query.filter_by(duration_minutes=duration_minutes, is_active=True).first()
    if option:
        return option.price_cents
    rate = load_hourly_rate_cents()
    total = math.ceil(rate * duration_minutes / 60.0)
    return max(0, total)


def _serialize_asset_file_url(asset: AppointmentAsset):
    raw_url = decrypt_identity_value(asset.file_url) if asset.kind in {"id_front", "id_back"} else asset.file_url
    owner_id = asset.uploaded_by_client_id or (asset.appointment.client_id if asset.appointment else None)
    if owner_id:
        url = _normalize_private_upload_url(raw_url)
        if url and not url.startswith("data:"):
            return f"{url}?asset={asset.id}"
        return url
    return raw_url


def serialize_appointment(appointment, *, include_assets=True):
    client = appointment.client
    assigned_admin = appointment.assigned_admin
    session_option_data = serialize_session_option(appointment.session_option) if appointment.session_option else None
    pricing_duration_minutes = (
        appointment.session_option.duration_minutes
        if appointment.session_option
        else (appointment.suggested_duration_minutes or appointment.duration_minutes)
    )
    session_price_cents = (
        appointment.session_option.price_cents
        if appointment.session_option
        else calculate_session_price_cents(pricing_duration_minutes)
    )
    assets = []
    if include_assets:
        assets = [
            {
                "id": asset.id,
                "kind": asset.kind,
                "file_url": _serialize_asset_file_url(asset),
                "note_text": asset.note_text,
                "is_visible_to_client": asset.is_visible_to_client,
                "created_at": asset.created_at.isoformat() if asset.created_at else None,
                "uploaded_by_admin": serialize_admin(asset.admin_uploader) if asset.admin_uploader else None,
                "uploaded_by_client": {
                    "id": asset.client_uploader.id,
                    "display_name": asset.client_uploader.display_name,
                    "email": asset.client_uploader.email,
                }
                if asset.client_uploader
                else None,
            }
            for asset in appointment.assets
        ]
    return {
        "id": appointment.id,
        "reference_code": appointment.reference_code,
        "status": appointment.status,
        "created_at": appointment.created_at.isoformat() if appointment.created_at else None,
        "updated_at": appointment.updated_at.isoformat() if appointment.updated_at else None,
        "scheduled_start": appointment.scheduled_start.isoformat() if appointment.scheduled_start else None,
        "scheduled_end": appointment.scheduled_end.isoformat() if appointment.scheduled_end else None,
        "duration_minutes": appointment.duration_minutes,
        "suggested_duration_minutes": appointment.suggested_duration_minutes,
        "client_description": appointment.client_description,
        "contact_name": appointment.contact_name,
        "contact_email": appointment.contact_email,
        "contact_phone": appointment.contact_phone,
        "tattoo_placement": appointment.tattoo_placement,
        "tattoo_size": appointment.tattoo_size,
        "placement_notes": appointment.placement_notes,
        "terms_agreed_at": appointment.terms_agreed_at.isoformat() if appointment.terms_agreed_at else None,
        "contact": {
            "name": appointment.display_contact_name,
            "email": appointment.display_contact_email,
            "phone": appointment.display_contact_phone,
        },
        "tattoo": {
            "placement": appointment.tattoo_placement,
            "size": appointment.tattoo_size,
            "notes": appointment.placement_notes,
        },
        "service": {
            "name": session_option_data["name"] if session_option_data else None,
            "notes": appointment.client_description,
        },
        "product": session_option_data,
        "session_option": session_option_data,
        "session_price_cents": session_price_cents,
        "client": {
            "id": client.id,
            "display_name": client.display_name,
            "email": client.email,
            "phone": client.phone,
            "is_guest": client.is_guest,
            "role": client.role,
        }
        if client
        else {
            "display_name": appointment.guest_name,
            "email": appointment.guest_email,
            "phone": appointment.guest_phone,
            "is_guest": True,
        },
        "assigned_admin": serialize_admin(assigned_admin) if assigned_admin else None,
        "assets": assets,
        "pricing": {
            "hourly_rate_cents": load_hourly_rate_cents(),
            "total_cents": session_price_cents,
            "currency": _payment_currency(),
            "booking_fee_percent": load_booking_fee_percent(),
        },
        "has_identity_documents": appointment.has_identity_documents(),
        "payments": [
            {
                "id": payment.id,
                "provider": payment.provider,
                "status": payment.status,
                "amount_cents": payment.amount_cents,
                "currency": payment.currency,
                "receipt_url": payment.receipt_url,
                "note": payment.note,
                "created_at": payment.created_at.isoformat() if payment.created_at else None,
            }
            for payment in appointment.payments
        ],
    }


def serialize_user_profile(user: ClientAccount):
    return {
        "id": user.id,
        "display_name": user.display_name,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "phone": user.phone,
        "role": user.role,
        "email_verified": bool(user.email_verified_at),
        "email_verified_at": user.email_verified_at.isoformat() if user.email_verified_at else None,
        "has_identity_documents": user.has_identity_documents() if hasattr(user, "has_identity_documents") else False,
        "last_password_change_at": user.last_password_change_at.isoformat() if user.last_password_change_at else None,
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "preferences": _load_client_preferences(user),
    }


def serialize_client_document(document: ClientDocument):
    file_url = _normalize_private_upload_url(document.file_url)
    return {
        "id": f"document-{document.id}",
        "kind": document.kind,
        "title": document.title or document.kind.replace("_", " ").title(),
        "notes": document.notes,
        "file_url": file_url,
        "created_at": document.created_at.isoformat() if document.created_at else None,
        "source": "you",
    }


def serialize_visible_asset(asset: AppointmentAsset):
    appointment_ref = asset.appointment.reference_code or f"#{asset.appointment.id}" if asset.appointment else None
    file_url = _serialize_asset_file_url(asset)
    return {
        "id": f"asset-{asset.id}",
        "kind": asset.kind,
        "title": asset.note_text or asset.kind.replace("_", " ").title(),
        "file_url": file_url,
        "notes": asset.note_text,
        "created_at": asset.created_at.isoformat() if asset.created_at else None,
        "source": "studio",
        "appointment_reference": appointment_ref,
        "uploaded_by_admin": serialize_admin(asset.admin_uploader) if asset.admin_uploader else None,
    }


def _documents_for_user(user: ClientAccount):
    client_documents = user.documents.order_by(ClientDocument.created_at.desc()).all()
    shared_assets = (
        AppointmentAsset.query.options(
            joinedload(AppointmentAsset.admin_uploader),
            joinedload(AppointmentAsset.appointment),
        )
        .join(TattooAppointment)
        .filter(
            TattooAppointment.client_id == user.id,
            AppointmentAsset.is_visible_to_client.is_(True),
            AppointmentAsset.file_url.isnot(None),
        )
        .order_by(AppointmentAsset.created_at.desc())
        .all()
    )
    return (
        [serialize_client_document(doc) for doc in client_documents],
        [serialize_visible_asset(asset) for asset in shared_assets],
    )


def log_admin_activity(admin: AdminAccount, action: str, details: str | None = None, ip_address: str | None = None):
    if not admin:
        return
    log = AdminActivityLog(admin=admin, action=action, details=details, ip_address=ip_address)
    db.session.add(log)


@api_bp.before_app_request
def enforce_csrf_protection():
    if request.method in {"GET", "HEAD", "OPTIONS"}:
        return
    endpoint = request.endpoint or ""
    if endpoint in CSRF_EXEMPT_ENDPOINTS:
        return
    token = session.get("csrf_token")
    header_token = request.headers.get("X-CSRF-Token")
    if not token or not header_token or not hmac.compare_digest(token, header_token):
        return jsonify({"error": "Invalid or missing CSRF token."}), 400


def allowed_file(filename: str, *, allowed_extensions: set[str] | None = None) -> bool:
    if not filename:
        return False
    base_name = Path(filename).name
    if not base_name or "." not in base_name:
        return False
    extension = base_name.rsplit(".", 1)[1].lower()
    permitted = allowed_extensions if allowed_extensions is not None else ALLOWED_UPLOAD_EXTENSIONS
    return extension in permitted


def is_valid_image_file(file_storage) -> bool:
    stream = getattr(file_storage, "stream", file_storage)
    try:
        stream.seek(0)
    except (AttributeError, OSError):
        pass
    try:
        with Image.open(stream) as image:
            image.verify()
            mime = Image.MIME.get(image.format)
            if not mime:
                return False
            return mime.lower() in ALLOWED_IMAGE_MIME_TYPES
    except (UnidentifiedImageError, OSError):
        return False
    finally:
        try:
            stream.seek(0)
        except (AttributeError, OSError):
            pass


def _extract_upload_filename(value: str | None) -> str | None:
    if not value:
        return None
    try:
        parsed = urlsplit(value)
    except ValueError:
        parsed = None
    path = (parsed.path if parsed else value) or value
    candidate = path.rsplit("/", 1)[-1] if "/" in path else path
    sanitized = secure_filename(candidate)
    return sanitized or None


def _normalize_private_upload_url(value: str | None) -> str | None:
    if not value or value.startswith("data:") or value.startswith(IDENTITY_ENCRYPTION_PREFIX):
        return value
    filename = _extract_upload_filename(value)
    if not filename:
        return value
    return f"/api/uploads/{filename}"


def _resolve_upload_access_control(filename: str | None) -> dict | None:
    """
    Determine who may fetch an uploaded file.
    Returns:
        {"public": True} for public files (e.g., published gallery items)
        {"admin_only": True} for files that should only be visible to admins
        {"client_id": <id>} when a specific client owns the file
    """
    safe_name = secure_filename(filename or "")
    if not safe_name:
        return None
    path_variants = {safe_name, f"/api/uploads/{safe_name}"}
    like_pattern = f"%/{safe_name}"

    try:
        gallery_item = GalleryItem.query.filter(
            or_(GalleryItem.image_url.in_(path_variants), GalleryItem.image_url.like(like_pattern))
        ).first()
    except SQLAlchemyError:
        gallery_item = None
    if gallery_item:
        if gallery_item.is_published:
            return {"public": True}
        return {"admin_only": True}

    try:
        document = ClientDocument.query.filter(
            or_(ClientDocument.file_url.in_(path_variants), ClientDocument.file_url.like(like_pattern))
        ).first()
    except SQLAlchemyError:
        document = None
    if document:
        return {"client_id": document.client_id}

    asset_id = request.args.get("asset", type=int) if request else None

    if asset_id:
        asset = AppointmentAsset.query.options(joinedload(AppointmentAsset.appointment)).get(asset_id)
    else:
        asset = (
            AppointmentAsset.query.options(joinedload(AppointmentAsset.appointment))
            .filter(
                or_(
                    AppointmentAsset.file_url.in_(path_variants),
                    AppointmentAsset.file_url.like(like_pattern),
                )
            )
            .first()
        )

    if asset:
        # Use the correct column name from the AppointmentAsset model.
        owner_id = asset.uploaded_by_client_id or (asset.appointment.client_id if asset.appointment else None)
        if owner_id:
            return {"client_id": owner_id}
        return {"admin_only": True}
    return None


@api_bp.errorhandler(RequestEntityTooLarge)
def handle_large_upload(_: RequestEntityTooLarge):
    return jsonify({"error": "Image is too large. Max size is 10MB."}), 413


@api_bp.errorhandler(RateLimitExceeded)
def handle_rate_limit(exc: RateLimitExceeded):
    message = exc.description or UPLOAD_RATE_LIMIT_MESSAGE
    return jsonify({"error": message}), 429


def load_json_setting(key: str, default):
    setting = SystemSetting.query.filter_by(key=key).first()
    if not setting or setting.value is None:
        return default
    try:
        return json.loads(setting.value)
    except (TypeError, json.JSONDecodeError):
        return default


def upsert_json_setting(key: str, value, *, description: str | None = None) -> SystemSetting:
    setting = SystemSetting.query.filter_by(key=key).first()
    if not setting:
        setting = SystemSetting(key=key, description=description, value=json.dumps(value))
        db.session.add(setting)
    else:
        setting.value = json.dumps(value)
        if description and description != setting.description and not setting.description:
            setting.description = description
    return setting


def parse_iso_datetime(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return _normalize_schedule_datetime(value)
    if not isinstance(value, str):
        return None
    try:
        return _normalize_schedule_datetime(datetime.fromisoformat(value))
    except ValueError:
        if value.endswith("Z"):
            try:
                return _normalize_schedule_datetime(datetime.fromisoformat(f"{value[:-1]}+00:00"))
            except ValueError:
                return None
        return None


def _coerce_time(value, default: time) -> time:
    if isinstance(value, time):
        return value
    if not value or not isinstance(value, str):
        return default
    try:
        hours, minutes = value.split(":")
        return time(hour=int(hours), minute=int(minutes))
    except (ValueError, TypeError):
        return default


def _coerce_minimum_duration(value, default: int = MINIMUM_APPOINTMENT_DURATION_MINUTES) -> int:
    if isinstance(value, int):
        minutes = value
    else:
        try:
            minutes = int(value)
        except (TypeError, ValueError):
            return default
    if minutes < default:
        minutes = default
    if minutes % DEFAULT_SLOT_INTERVAL_MINUTES != 0:
        blocks = math.ceil(minutes / DEFAULT_SLOT_INTERVAL_MINUTES)
        minutes = blocks * DEFAULT_SLOT_INTERVAL_MINUTES
    return minutes


def _minimum_duration_for_weekday(weekday: int, *, hours_map=None) -> int:
    lookup = hours_map or fetch_working_hours_map()
    if not lookup:
        return MINIMUM_APPOINTMENT_DURATION_MINUTES
    entry = lookup.get(weekday)
    if not entry:
        return MINIMUM_APPOINTMENT_DURATION_MINUTES
    return _coerce_minimum_duration(entry.get("minimum_duration_minutes"))


def _working_hours_from_records(records):
    result = {}
    for record in records:
        result[record.weekday] = {
            "day": INDEX_TO_DAY.get(record.weekday, WEEK_DAYS[record.weekday % 7]),
            "is_open": record.is_open,
            "open_time": record.opens_at,
            "close_time": record.closes_at,
            "minimum_duration_minutes": _coerce_minimum_duration(record.minimum_duration_minutes),
        }
    return result


def fetch_working_hours_map():
    records = StudioWorkingHour.query.order_by(StudioWorkingHour.weekday.asc()).all()
    if records:
        return _working_hours_from_records(records)

    legacy_hours = load_json_setting("studio_operating_hours", DEFAULT_OPERATING_HOURS)
    result = {}
    for entry in legacy_hours:
        day = entry.get("day")
        if day not in DAY_TO_INDEX:
            continue
        weekday = DAY_TO_INDEX[day]
        result[weekday] = {
            "day": day,
            "is_open": bool(entry.get("is_open", True)),
            "open_time": _coerce_time(entry.get("open_time"), time(hour=10)),
            "close_time": _coerce_time(entry.get("close_time"), time(hour=18)),
            "minimum_duration_minutes": _coerce_minimum_duration(entry.get("minimum_duration_minutes")),
        }
    return result


def fetch_working_hours_json():
    hours = fetch_working_hours_map()
    if not hours:
        return []
    output = []
    for weekday in range(7):
        if weekday in hours:
            record = hours[weekday]
            output.append(
                {
                    "day": record["day"],
                    "is_open": record["is_open"],
                    "open_time": record["open_time"].strftime("%H:%M"),
                    "close_time": record["close_time"].strftime("%H:%M"),
                    "minimum_duration_minutes": _coerce_minimum_duration(record.get("minimum_duration_minutes")),
                }
            )
        else:
            output.append(
                {
                    "day": INDEX_TO_DAY.get(weekday, WEEK_DAYS[weekday % 7]),
                    "is_open": False,
                    "open_time": "00:00",
                    "close_time": "00:00",
                    "minimum_duration_minutes": MINIMUM_APPOINTMENT_DURATION_MINUTES,
                }
            )
    return output


def fetch_closure_dates():
    closures = StudioClosure.query.order_by(StudioClosure.date.asc()).all()
    if closures:
        return {closure.date for closure in closures}
    legacy_days_off = load_json_setting("studio_days_off", [])
    parsed = set()
    for value in legacy_days_off:
        try:
            parsed.add(date.fromisoformat(value))
        except ValueError:
            continue
    return parsed


def serialize_closure(closure: StudioClosure | None):
    if not closure:
        return None
    return {
        "id": closure.id,
        "date": closure.date.isoformat(),
        "reason": closure.reason,
    }


def sync_closure_setting():
    db.session.flush()
    closure_dates = [entry.date.isoformat() for entry in StudioClosure.query.order_by(StudioClosure.date.asc()).all()]
    upsert_json_setting(
        "studio_days_off",
        closure_dates,
        description="Dates when the studio does not accept appointments."
    )


def calculate_suggested_duration_minutes(placement: str | None, size: str | None) -> int:
    placement_key = (placement or "").strip().lower()
    size_key = (size or "").strip().lower()
    base_minutes = PLACEMENT_BASE_MINUTES.get(placement_key, 120)
    multiplier = SIZE_MULTIPLIERS.get(size_key, 1.0)
    blocks = max(1, math.ceil((base_minutes * multiplier) / DEFAULT_SLOT_INTERVAL_MINUTES))
    suggested = int(blocks * DEFAULT_SLOT_INTERVAL_MINUTES)
    if suggested < MINIMUM_APPOINTMENT_DURATION_MINUTES:
        suggested = MINIMUM_APPOINTMENT_DURATION_MINUTES
    return suggested


def _slot_overlaps(start: datetime, end: datetime, intervals):
    for blocked_start, blocked_end in intervals:
        if start < blocked_end and end > blocked_start:
            return True
    return False


def collect_blocked_intervals(day_start: datetime, day_end: datetime, *, ignore_appointment_id: int | None = None):
    intervals = []

    non_blocking_statuses = tuple(NON_BLOCKING_APPOINTMENT_STATUSES)

    appointment_query = TattooAppointment.query.with_entities(
        TattooAppointment.id,
        TattooAppointment.scheduled_start,
        TattooAppointment.duration_minutes,
    ).filter(
        TattooAppointment.scheduled_start.isnot(None),
        TattooAppointment.duration_minutes.isnot(None),
        TattooAppointment.scheduled_start < day_end,
    )

    if non_blocking_statuses:
        appointment_query = appointment_query.filter(TattooAppointment.status.notin_(non_blocking_statuses))

    if ignore_appointment_id is not None:
        appointment_query = appointment_query.filter(TattooAppointment.id != ignore_appointment_id)

    lookback_start = day_start - timedelta(hours=12)
    appointment_query = appointment_query.filter(TattooAppointment.scheduled_start >= lookback_start)

    for _, start, duration_minutes in appointment_query:
        if not start or duration_minutes is None:
            continue
        if duration_minutes <= 0:
            continue
        end = start + timedelta(minutes=duration_minutes)
        if end <= day_start or start >= day_end:
            continue
        intervals.append((start, end))

    block_rows = StudioAvailabilityBlock.query.with_entities(
        StudioAvailabilityBlock.start,
        StudioAvailabilityBlock.end,
    ).filter(
        StudioAvailabilityBlock.end > day_start,
        StudioAvailabilityBlock.start < day_end,
    )
    intervals.extend([(start, end) for start, end in block_rows])

    return intervals


def build_available_slots(
    target_date: date,
    duration_minutes: int | None,
    *,
    ignore_appointment_id: int | None = None,
    minimum_duration_minutes: int | None = None,
    allow_shorter_than_weekday_minimum: bool = False,
    hours_map=None,
):
    hours_map = hours_map or fetch_working_hours_map()
    weekday = target_date.weekday()
    window = hours_map.get(weekday)
    if not window or not window.get("is_open"):
        return [], None

    closures = fetch_closure_dates()
    if target_date in closures:
        return [], None

    open_time: time = window["open_time"]
    close_time: time = window["close_time"]
    if close_time <= open_time:
        return [], None

    day_start = datetime.combine(target_date, open_time)
    day_end = datetime.combine(target_date, close_time)

    slot_interval = timedelta(minutes=DEFAULT_SLOT_INTERVAL_MINUTES)
    weekday_minimum = _minimum_duration_for_weekday(weekday, hours_map=hours_map)
    if minimum_duration_minutes is not None:
        weekday_minimum = max(weekday_minimum, _coerce_minimum_duration(minimum_duration_minutes))
    requested_duration_minutes = duration_minutes if duration_minutes is not None else weekday_minimum
    if not allow_shorter_than_weekday_minimum:
        requested_duration_minutes = max(requested_duration_minutes, weekday_minimum)
    if requested_duration_minutes % DEFAULT_SLOT_INTERVAL_MINUTES != 0:
        requested_duration_minutes = (
            (requested_duration_minutes // DEFAULT_SLOT_INTERVAL_MINUTES) + 1
        ) * DEFAULT_SLOT_INTERVAL_MINUTES
    slot_duration = timedelta(minutes=requested_duration_minutes)

    blocked_intervals = collect_blocked_intervals(day_start, day_end, ignore_appointment_id=ignore_appointment_id)
    now = _nyc_now_naive()

    slots = []
    cursor = day_start
    while cursor + slot_duration <= day_end:
        slot_end = cursor + slot_duration
        if cursor < now:
            cursor += slot_interval
            continue
        if not _slot_overlaps(cursor, slot_end, blocked_intervals):
            slots.append(
                {
                    "start": cursor,
                    "end": slot_end,
                }
            )
        cursor += slot_interval

    return slots, {
        "day": window["day"],
        "open_time": open_time.strftime("%H:%M"),
        "close_time": close_time.strftime("%H:%M"),
        "minimum_duration_minutes": weekday_minimum,
    }


@api_bp.route("/api/gallery/categories", methods=["GET"])
def list_gallery_categories():
    include_inactive = parse_bool(request.args.get("include_inactive"), default=False)
    query = TattooCategory.query.order_by(TattooCategory.name.asc())
    if not include_inactive:
        query = query.filter_by(is_active=True)
    categories = query.all()
    return jsonify([serialize_category(category) for category in categories])


def _parse_pagination(default_per_page: int = 24):
    page = request.args.get("page", type=int) or 1
    per_page = request.args.get("per_page", type=int) or default_per_page
    page = page if page > 0 else 1
    per_page = max(1, min(per_page, 100))
    return page, per_page


@api_bp.route("/api/gallery", methods=["GET"])
def list_gallery():
    category_id = request.args.get("category_id", type=int)
    category_name = request.args.get("category", type=str)
    include_unpublished = parse_bool(request.args.get("include_unpublished"), default=False)

    base_query = GalleryItem.query

    if not include_unpublished:
        base_query = base_query.filter(GalleryItem.is_published.is_(True))

    if category_id:
        base_query = base_query.filter(GalleryItem.category_id == category_id)
    elif category_name:
        category_name = category_name.strip()
        if category_name:
            base_query = base_query.join(GalleryItem.category).filter(func.lower(TattooCategory.name) == category_name.lower())

    page, per_page = _parse_pagination()
    total = base_query.count()

    items = (
        base_query.options(joinedload(GalleryItem.category), joinedload(GalleryItem.uploaded_by))
        .order_by(GalleryItem.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    total_pages = math.ceil(total / per_page) if per_page else 1

    return jsonify(
        {
            "items": [serialize_gallery_item(item) for item in items],
            "meta": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "pages": total_pages,
            },
        }
    )


@api_bp.route("/api/testimonials", methods=["GET"])
def list_testimonials():
    items = Testimonial.query.order_by(Testimonial.id.asc()).all()
    return jsonify(
        [
            {
                "id": item.id,
                "name": item.name,
                "quote": item.quote,
                "rating": item.rating,
            }
            for item in items
        ]
    )


@api_bp.route("/api/consultations", methods=["POST"])
@limiter.limit("3 per minute")
def create_consultation():
    payload = request.get_json(silent=True) or {}
    required_fields = ("name", "email", "placement", "description")
    errors = []

    for field in required_fields:
        value = (payload.get(field) or "").strip()
        if not value:
            errors.append({"field": field, "message": "This field is required."})

    if errors:
        return jsonify({"errors": errors}), 400

    consultation = Consultation(
        name=payload["name"].strip(),
        email=payload["email"].strip(),
        phone=(payload.get("phone") or "").strip() or None,
        preferred_date=(payload.get("preferred_date") or "").strip() or None,
        placement=payload["placement"].strip(),
        description=payload["description"].strip(),
    )

    db.session.add(consultation)
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to process request"}), 500

    return jsonify({"id": consultation.id, "status": "received"}), 201


@api_bp.route("/api/availability/config", methods=["GET"])
def public_availability_config():
    operating_hours = fetch_working_hours_json()
    closures = sorted({closure.isoformat() for closure in fetch_closure_dates()})
    return jsonify(
        {
            "operating_hours": operating_hours,
            "closures": closures,
            "slot_interval_minutes": DEFAULT_SLOT_INTERVAL_MINUTES,
            "minimum_duration_minutes": MINIMUM_APPOINTMENT_DURATION_MINUTES,
        }
    )


@api_bp.route("/api/availability", methods=["GET"])
def public_availability_slots():
    date_raw = request.args.get("date", type=str)
    if not date_raw:
        return jsonify({"error": "Query parameter 'date' is required (YYYY-MM-DD)."}), 400
    try:
        target_date = date.fromisoformat(date_raw)
    except ValueError:
        return jsonify({"error": "Invalid date format; use YYYY-MM-DD."}), 400

    duration_param = request.args.get("duration_minutes", type=int)
    session_option_id_raw = request.args.get("session_option_id")
    session_option = None
    is_free_consultation = False
    if session_option_id_raw is not None:
        try:
            session_option_id = int(session_option_id_raw)
        except (TypeError, ValueError):
            return jsonify({"error": "session_option_id must be a whole number."}), 400
        session_option = SessionOption.query.filter_by(id=session_option_id, is_active=True).first()
        if not session_option:
            return jsonify({"error": "Session option not found."}), 404
        is_free_consultation = session_option.price_cents == 0

    placement = request.args.get("placement")
    size = request.args.get("size")

    working_hours_map = fetch_working_hours_map()
    weekday = target_date.weekday()
    day_minimum = _minimum_duration_for_weekday(weekday, hours_map=working_hours_map)
    day_label = INDEX_TO_DAY.get(weekday, "this day").capitalize()

    duration_minutes = None
    if session_option:
        duration_minutes = session_option.duration_minutes
    else:
        duration_minutes = duration_param or calculate_suggested_duration_minutes(placement, size)
        if duration_minutes % DEFAULT_SLOT_INTERVAL_MINUTES != 0:
            duration_minutes = int(
                round(duration_minutes / DEFAULT_SLOT_INTERVAL_MINUTES) * DEFAULT_SLOT_INTERVAL_MINUTES
            )

    slots, window = build_available_slots(
        target_date,
        duration_minutes,
        minimum_duration_minutes=day_minimum,
        hours_map=working_hours_map,
        allow_shorter_than_weekday_minimum=True,
    )
    return jsonify(
        {
            "date": target_date.isoformat(),
            "duration_minutes": duration_minutes,
            "slot_interval_minutes": DEFAULT_SLOT_INTERVAL_MINUTES,
            "minimum_duration_minutes": day_minimum,
            "working_window": window,
            "slots": [
                {
                    "start": slot["start"].isoformat(),
                    "end": slot["end"].isoformat(),
                }
                for slot in slots
            ],
            "fully_booked": window is not None and not slots,
            "is_closed": window is None,
        }
    )


@api_bp.route("/api/appointments/suggest-duration", methods=["GET"])
def suggest_duration():
    placement = request.args.get("placement")
    size = request.args.get("size")
    suggested_minutes = calculate_suggested_duration_minutes(placement, size)
    return jsonify(
        {
            "suggested_duration_minutes": suggested_minutes,
            "suggested_duration_hours": round(suggested_minutes / 60.0, 2),
        }
    )


@api_bp.route("/api/auth/register", methods=["POST"])
@limiter.limit("5 per minute")
def register_account():
    payload = request.get_json(silent=True) or {}
    first_name = (payload.get("first_name") or "").strip()
    last_name = (payload.get("last_name") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    phone = (payload.get("phone") or "").strip() or None
    password = payload.get("password") or ""

    errors = []
    if not email:
        errors.append({"field": "email", "message": "Email is required."})
    if not password or len(password) < PASSWORD_MIN_LENGTH:
        errors.append({"field": "password", "message": f"Password must be at least {PASSWORD_MIN_LENGTH} characters."})

    duplicate_client = ClientAccount.query.filter(func.lower(ClientAccount.email) == email).first()
    duplicate_admin = AdminAccount.query.filter(func.lower(AdminAccount.email) == email).first()
    if duplicate_client or duplicate_admin:
        errors.append({"field": "email", "message": "An account with this email already exists."})

    if errors:
        return jsonify({"errors": errors}), 400

    client = ClientAccount(
        first_name=first_name or None,
        last_name=last_name or None,
        email=email,
        phone=phone,
        is_guest=False,
        role="user",
        last_login_at=datetime.utcnow(),
    )
    client.set_password(password)

    db.session.add(client)
    db.session.flush()

    verification_code = None
    if client.email:
        _token, verification_code = _issue_email_verification_token(client)
        if verification_code and not send_signup_email(client, verification_code):
            db.session.rollback()
            return jsonify({"error": "Unable to send verification email right now."}), 503

    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to create account."}), 500

    set_session("user", client.id)
    csrf_token = get_csrf_token()

    return jsonify(
        {
            "role": "user",
            "redirect_to": "/portal/dashboard",
            "profile": serialize_user_profile(client),
            "csrf_token": csrf_token,
            "email_verification_required": not bool(client.email_verified_at),
        }
    ), 201


@api_bp.route("/api/auth/activation-request", methods=["POST"])
@limiter.limit("5 per minute")
def activation_request():
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip().lower()
    if not email:
        return jsonify({"error": "Email is required."}), 400

    client = ClientAccount.query.filter(func.lower(ClientAccount.email) == email).first()
    if not client or not client.is_guest:
        return jsonify({"status": "ok"}), 200

    token = _create_activation_token(client)
    if not send_activation_email(client, token):
        db.session.rollback()
        return jsonify({"error": "Unable to send activation email right now."}), 500

    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to save activation request."}), 500

    return jsonify({"status": "sent"}), 200


@api_bp.route("/api/auth/activate", methods=["POST"])
@limiter.limit("5 per minute")
def activate_account():
    payload = request.get_json(silent=True) or {}
    token = (payload.get("token") or "").strip()
    password = payload.get("password") or ""
    if not token or not password:
        return jsonify({"error": "Token and password are required."}), 400
    if len(password) < PASSWORD_MIN_LENGTH:
        return jsonify({"error": f"Password must be at least {PASSWORD_MIN_LENGTH} characters."}), 400

    token_record = _consume_activation_token(token)
    if not token_record:
        return jsonify({"error": "Invalid or expired activation token."}), 400

    client = token_record.client_account
    if not client:
        return jsonify({"error": "Invalid activation token."}), 400

    client.set_password(password)
    client.is_guest = False
    client.role = client.role or "user"
    client.last_login_at = datetime.utcnow()
    if not client.email_verified_at:
        client.mark_email_verified()
    token_record.used_at = datetime.utcnow()

    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to activate account right now."}), 500

    set_session("user", client.id)
    csrf_token = get_csrf_token()

    return jsonify(
        {
            "role": "user",
            "redirect_to": "/portal/dashboard",
            "profile": serialize_user_profile(client),
            "csrf_token": csrf_token,
        }
    )


@api_bp.route("/api/auth/email/verify-request", methods=["POST"])
@limiter.limit("6 per hour")
def request_email_verification():
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip().lower()
    if not email:
        return jsonify({"error": "Email is required."}), 400

    client = ClientAccount.query.filter(func.lower(ClientAccount.email) == email).first()
    if not client:
        return jsonify({"status": "ok"}), 202
    if client.email_verified_at:
        return jsonify({"status": "already_verified"}), 200

    _token, code = _issue_email_verification_token(client)
    if not code or not send_email_verification_email(
        client,
        code,
        expires_minutes=int(EMAIL_VERIFICATION_TTL.total_seconds() // 60),
    ):
        db.session.rollback()
        return jsonify({"error": "Unable to send verification email right now."}), 503

    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to save verification request."}), 500

    return jsonify({"status": "sent"}), 202


@api_bp.route("/api/auth/email/verify", methods=["POST"])
@limiter.limit("10 per hour")
def confirm_email_verification():
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip().lower()
    code = (payload.get("code") or "").strip()
    if not email or not code:
        return jsonify({"error": "Email and verification code are required."}), 400

    token_record = _verify_email_token(email, code)
    if not token_record:
        return jsonify({"error": "Invalid or expired verification code."}), 400

    client = token_record.client_account
    token_record.mark_consumed(datetime.utcnow())
    client.mark_email_verified()

    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to verify email right now."}), 500

    response = {"status": "verified"}
    if session.get("role") == "user" and session.get("user_id") == client.id:
        response["profile"] = serialize_user_profile(client)
        response["csrf_token"] = get_csrf_token()
    return jsonify(response), 200


@api_bp.route("/api/auth/forgot-password", methods=["POST"])
@limiter.limit("5 per hour")
def forgot_password():
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip().lower()
    if not email:
        return jsonify({"error": "Email is required."}), 400

    client = ClientAccount.query.filter(func.lower(ClientAccount.email) == email).first()
    if not client:
        return jsonify({"status": "ok"}), 202

    if not client.email_verified_at:
        _token, code = _issue_email_verification_token(client)
        if code and not send_email_verification_email(
            client,
            code,
            expires_minutes=int(EMAIL_VERIFICATION_TTL.total_seconds() // 60),
        ):
            db.session.rollback()
            return jsonify({"error": "Unable to send verification email right now."}), 503
        try:
            db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()
            return jsonify({"error": "Unable to start verification right now."}), 500
        return jsonify({"status": "verify_email"}), 202

    request_record, code = _issue_password_reset_request(
        client,
        request_ip=request.remote_addr,
        user_agent=request.headers.get("User-Agent"),
    )
    if not code or not send_password_reset_email(
        client,
        code,
        expires_minutes=int(PASSWORD_RESET_TTL.total_seconds() // 60),
    ):
        db.session.rollback()
        return jsonify({"error": "Unable to send reset email right now."}), 503

    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to process password reset right now."}), 500

    return jsonify({"status": "sent"}), 202


@api_bp.route("/api/auth/forgot-password/confirm", methods=["POST"])
@limiter.limit("10 per hour")
def forgot_password_confirm():
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip().lower()
    code = (payload.get("code") or "").strip()
    new_password = (payload.get("new_password") or "").strip()
    if not email or not code or not new_password:
        return jsonify({"error": "Email, verification code, and new password are required."}), 400
    if len(new_password) < PASSWORD_MIN_LENGTH:
        return jsonify({"error": f"Password must be at least {PASSWORD_MIN_LENGTH} characters."}), 400

    request_record = _verify_password_reset(email, code)
    if not request_record:
        return jsonify({"error": "Invalid or expired verification code."}), 400

    client = request_record.client_account
    request_record.mark_consumed(datetime.utcnow())
    client.set_password(new_password)
    if not client.email_verified_at:
        client.mark_email_verified()

    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to update password right now."}), 500

    send_password_changed_email(client)
    set_session("user", client.id)
    csrf_token = get_csrf_token()
    return (
        jsonify(
            {
                "status": "updated",
                "role": "user",
                "redirect_to": "/portal/dashboard",
                "profile": serialize_user_profile(client),
                "csrf_token": csrf_token,
            }
        ),
        200,
    )


@api_bp.route("/api/auth/login", methods=["POST"])
@limiter.limit("10 per minute")
def auth_login():
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    admin = AdminAccount.query.filter(func.lower(AdminAccount.email) == email).first()
    if admin and admin.check_password(password):
        admin.last_login_at = datetime.utcnow()
        set_session("admin", admin.id)
        log_admin_activity(admin, "login", details="Administrator authenticated.", ip_address=request.remote_addr)
        try:
            db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()
            return jsonify({"error": "Unable to establish session."}), 500
        csrf_token = get_csrf_token()
        return jsonify(
            {
                "role": "admin",
                "redirect_to": "/dashboard/admin",
                "admin": serialize_admin(admin),
                "csrf_token": csrf_token,
            }
        )

    client = ClientAccount.query.filter(func.lower(ClientAccount.email) == email).first()
    if client and client.check_password(password):
        client.last_login_at = datetime.utcnow()
        set_session("user", client.id)
        try:
            db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()
            return jsonify({"error": "Unable to establish session."}), 500
        csrf_token = get_csrf_token()
        return jsonify(
            {
                "role": "user",
                "redirect_to": "/portal/dashboard",
                "profile": serialize_user_profile(client),
                "csrf_token": csrf_token,
            }
        )

    return jsonify({"error": "Invalid credentials."}), 401


@api_bp.route("/api/auth/session", methods=["GET"])
def auth_session():
    role = session.get("role")
    identifier = session.get("user_id")
    if not role or not identifier:
        return jsonify({"role": None, "account": None}), 401

    if role == "admin":
        admin = AdminAccount.query.get(identifier)
        if not admin:
            clear_session()
            return jsonify({"role": None, "account": None}), 401
        return jsonify({"role": "admin", "account": serialize_admin(admin), "csrf_token": get_csrf_token()})

    if role == "user":
        user = ClientAccount.query.get(identifier)
        if not user:
            clear_session()
            return jsonify({"role": None, "account": None}), 401
        return jsonify({"role": "user", "account": serialize_user_profile(user), "csrf_token": get_csrf_token()})

    clear_session()
    return jsonify({"role": None, "account": None}), 401


@api_bp.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    clear_session()
    return jsonify({"status": "logged_out"})


@api_bp.route("/api/auth/csrf", methods=["GET"])
def auth_csrf():
    token = get_csrf_token()
    response = jsonify({"csrf_token": token})
    response.headers["Cache-Control"] = "no-store"
    return response


@api_bp.route("/api/account/password", methods=["POST"])
@user_required
@limiter.limit("5 per hour")
def update_account_password():
    payload = request.get_json(silent=True) or {}
    current_password = (payload.get("current_password") or "").strip()
    new_password = (payload.get("new_password") or "").strip()

    if not current_password or not g.current_user.check_password(current_password):
        return jsonify({"error": "Current password is invalid."}), 403
    if len(new_password) < PASSWORD_MIN_LENGTH:
        return jsonify({"error": f"Password must be at least {PASSWORD_MIN_LENGTH} characters."}), 400
    if new_password == current_password:
        return jsonify({"error": "New password must differ from the current password."}), 400

    user = g.current_user
    user.set_password(new_password)

    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to update password right now."}), 500

    send_password_changed_email(user)
    return jsonify({"status": "updated"}), 200


@api_bp.route("/api/uploads/<path:filename>", methods=["GET"])
def serve_uploaded_file(filename):
    upload_dir = _get_upload_root()
    safe_name = secure_filename(filename)
    if not safe_name:
        return jsonify({"error": "File not found."}), 404

    access = _resolve_upload_access_control(safe_name)
    if access:
        role = session.get("role")
        requester_id = session.get("user_id")
        if access.get("public"):
            pass
        elif access.get("admin_only"):
            if role != "admin":
                return jsonify({"error": "File not found."}), 404
        else:
            owner_client_id = access.get("client_id")
            if not (
                role == "admin"
                or (role == "user" and requester_id == owner_client_id)
            ):
                return jsonify({"error": "File not found."}), 404

    stored = StoredUpload.query.filter_by(filename=safe_name).one_or_none()
    if stored:
        return _with_cache_headers(
            send_file(
                BytesIO(stored.data),
                mimetype=stored.content_type or "application/octet-stream",
                download_name=safe_name,
                as_attachment=False,
            )
        )

    target = upload_dir / safe_name
    try:
        target_resolved = target.resolve(strict=True)
    except OSError:
        return jsonify({"error": "File not found."}), 404
    if target_resolved.parent != upload_dir:
        return jsonify({"error": "File not found."}), 404
    if not target_resolved.is_file():
        return jsonify({"error": "File not found."}), 404

    # Backfill locally stored uploads into the database so future deployments keep them.
    try:
        payload = target_resolved.read_bytes()
        guessed_type = mimetypes.guess_type(safe_name)[0] or "application/octet-stream"
        if _persist_upload_record(safe_name, payload, guessed_type):
            db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.warning("Unable to persist upload %s into database cache.", safe_name)
    except OSError:
        current_app.logger.warning("Unable to read upload %s for persistence.", safe_name)

    return _with_cache_headers(send_from_directory(str(upload_dir), safe_name, as_attachment=False))


@api_bp.route("/api/admin/uploads/<path:filename>/download", methods=["GET"])
@admin_required
def admin_download_file(filename):
    """Force-download a private upload for authenticated admins.

    This endpoint is used by the admin portal's download button so that
    images / documents are saved to disk rather than opened inline in the
    browser.  It always requires an active admin session.
    """
    upload_dir = _get_upload_root()
    safe_name = secure_filename(filename)
    if not safe_name:
        return jsonify({"error": "File not found."}), 404

    # Serve from the DB blob cache first (works across dynos / redeploys).
    stored = StoredUpload.query.filter_by(filename=safe_name).one_or_none()
    if stored:
        return send_file(
            BytesIO(stored.data),
            mimetype=stored.content_type or "application/octet-stream",
            download_name=safe_name,
            as_attachment=True,
        )

    # Fall back to local filesystem.
    target = upload_dir / safe_name
    try:
        target_resolved = target.resolve(strict=True)
    except OSError:
        return jsonify({"error": "File not found."}), 404
    if target_resolved.parent != upload_dir or not target_resolved.is_file():
        return jsonify({"error": "File not found."}), 404

    return send_from_directory(str(upload_dir), safe_name, as_attachment=True)


@api_bp.route("/api/admin/uploads", methods=["POST"])
@admin_required
@limiter.limit("10 per minute", key_func=get_remote_address, error_message=UPLOAD_RATE_LIMIT_MESSAGE)
@limiter.limit("60 per hour", key_func=_admin_upload_limit_key, error_message=UPLOAD_RATE_LIMIT_MESSAGE)
def admin_upload_media():
    if "file" not in request.files:
        return jsonify({"error": "No file provided."}), 400

    file = request.files["file"]
    if not file or file.filename == "":
        return jsonify({"error": "Empty file."}), 400

    if not allowed_file(file.filename, allowed_extensions=ALLOWED_UPLOAD_EXTENSIONS):
        return jsonify({"error": "Unsupported file type."}), 415

    extension = Path(file.filename).suffix.lower().lstrip('.')
    if not extension:
        return jsonify({"error": "Unsupported file type."}), 415

    if extension in ALLOWED_IMAGE_EXTENSIONS and not is_valid_image_file(file):
        return jsonify({"error": "Unsupported file type."}), 415
    unique_name = f"{uuid4().hex}.{extension}"
    safe_name = secure_filename(unique_name)

    cleanup_target = None
    try:
        stored_name, file_url = store_uploaded_media(file, safe_name)
        if _use_s3_uploads():
            cleanup_target = {"mode": "s3", "key": stored_name}
        else:
            cleanup_target = {"mode": "local", "path": Path(current_app.config["UPLOAD_FOLDER"]) / stored_name}
    except MediaStorageError as exc:
        current_app.logger.error("Upload failed: %s", exc)
        return jsonify({"error": "Unable to store upload."}), 500

    admin: AdminAccount = g.current_admin
    try:
        log_admin_activity(
            admin,
            "upload_create",
            details=f"Uploaded media {stored_name}",
            ip_address=request.remote_addr,
        )
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        _cleanup_upload_target(cleanup_target)
        return jsonify({"error": "Unable to store upload."}), 500

    return jsonify({"filename": stored_name, "url": file_url}), 201


@api_bp.route("/api/payments/config", methods=["GET"])
def payment_configuration():
    enabled = _stripe_public_enabled()
    return jsonify(
        {
            "stripe": {
                "enabled": enabled,
                "demo_mode": bool(current_app.config.get("STRIPE_FAKE_PAYMENTS")),
                "requires_payment": _stripe_payments_active(),
                "publishable_key": current_app.config.get("STRIPE_PUBLISHABLE_KEY") if enabled else None,
                "booking_fee_percent": load_booking_fee_percent(),
                "minimum_booking_fee_percent": MINIMUM_BOOKING_FEE_PERCENT,
                "supports_full_payment": True,
                "currency": _payment_currency(),
                "country_code": _payment_country_code(),
            }
        }
    )


@api_bp.route("/api/pricing/hourly-rate", methods=["GET"])
def pricing_hourly_rate():
    return jsonify(
        {
            "hourly_rate_cents": load_hourly_rate_cents(),
            "currency": _payment_currency(),
            "booking_fee_percent": load_booking_fee_percent(),
            "session_options": [serialize_session_option(option) for option in load_active_session_options()],
        }
    )


@api_bp.route("/api/pricing/session-options", methods=["GET"])
def pricing_session_options():
    options = load_active_session_options()
    return jsonify([serialize_session_option(option) for option in options])


@api_bp.route("/api/pricing/estimate", methods=["GET"])
def pricing_estimate():
    session_option_id = request.args.get("session_option_id")
    session_option = None
    if session_option_id is not None:
        try:
            option_id = int(session_option_id)
        except (TypeError, ValueError):
            return jsonify({"error": "session_option_id must be a whole number."}), 400
        session_option = SessionOption.query.filter_by(id=option_id, is_active=True).first()
        if not session_option:
            return jsonify({"error": "Session option not found."}), 404

    duration_param = request.args.get("duration_minutes")
    total_cents = 0
    duration_minutes = None
    if session_option:
        duration_minutes = session_option.duration_minutes
        total_cents = session_option.price_cents
    else:
        if duration_param is None:
            return jsonify({"error": "duration_minutes is required."}), 400
        try:
            duration_minutes = int(duration_param)
        except (TypeError, ValueError):
            return jsonify({"error": "duration_minutes must be a number."}), 400
        if duration_minutes <= 0:
            return jsonify({"error": "duration_minutes must be greater than zero."}), 400
        total_cents = calculate_session_price_cents(duration_minutes)

    return jsonify(
        {
            "duration_minutes": duration_minutes,
            "total_cents": total_cents,
            "hourly_rate_cents": load_hourly_rate_cents(),
            "session_option": serialize_session_option(session_option) if session_option else None,
            "currency": _payment_currency(),
        }
    )


@api_bp.route("/api/admin/session", methods=["GET"])
@admin_required
def admin_session():
    admin = get_current_admin()
    return jsonify({"role": "admin", "account": serialize_admin(admin)})


@api_bp.route("/api/dashboard/user", methods=["GET"])
@user_required
def user_dashboard():
    user: ClientAccount = g.current_user

    notifications = (
        user.notifications.order_by(UserNotification.created_at.desc()).limit(10).all()
        if hasattr(user, "notifications")
        else []
    )

    appointments = (
        user.appointments.options(
            joinedload(TattooAppointment.assigned_admin),
            joinedload(TattooAppointment.assets),
            joinedload(TattooAppointment.payments),
        )
        .order_by(TattooAppointment.created_at.desc())
        .limit(10)
        .all()
    )

    unread_count = sum(1 for note in notifications if not note.is_read)
    documents, shared_documents = _documents_for_user(user)

    return jsonify(
        {
            "profile": serialize_user_profile(user),
            "notifications": {
                "items": [serialize_notification(note) for note in notifications],
                "unread_count": unread_count,
            },
            "appointments": [serialize_appointment(appointment) for appointment in appointments],
            "documents": documents,
            "shared_documents": shared_documents,
            "recent_actions": [
                {
                    "label": "Update profile",
                    "path": "/account/profile",
                },
                {
                    "label": "Upload inspiration",
                    "path": "/account/inspiration",
                },
                {
                    "label": "View documents",
                    "path": "/account/documents",
                },
            ],
        }
    )


@api_bp.route("/api/account/profile", methods=["PATCH"])
@user_required
def update_account_profile():
    user = g.current_user
    payload = request.get_json(silent=True) or {}

    if "first_name" in payload:
        first_name = (payload.get("first_name") or "").strip()
        user.first_name = first_name or None
    if "last_name" in payload:
        last_name = (payload.get("last_name") or "").strip()
        user.last_name = last_name or None
    if "phone" in payload:
        phone = (payload.get("phone") or "").strip()
        user.phone = phone or None
    if "email" in payload:
        email_value = (payload.get("email") or "").strip()
        if email_value:
            conflict = (
                ClientAccount.query.filter(func.lower(ClientAccount.email) == email_value.lower())
                .filter(ClientAccount.id != user.id)
                .first()
            )
            if conflict:
                return jsonify({"error": "Email already in use."}), 400
        user.email = email_value or None

    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to update profile."}), 500

    return jsonify(serialize_user_profile(user))


@api_bp.route("/api/account", methods=["DELETE"])
@user_required
def delete_account():
    user = g.current_user

    try:
        AppointmentAsset.query.filter_by(uploaded_by_client_id=user.id).update(
            {"uploaded_by_client_id": None}, synchronize_session=False
        )
        TattooAppointment.query.filter_by(client_id=user.id).update(
            {"client_id": None}, synchronize_session=False
        )
        UserNotification.query.filter_by(user_id=user.id).delete(synchronize_session=False)

        db.session.delete(user)
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to delete account."}), 500

    clear_session()
    return jsonify({"status": "deleted"})


@api_bp.route("/api/account/preferences", methods=["GET", "PATCH"])
@user_required
def account_preferences():
    user = g.current_user
    if request.method == "GET":
        return jsonify(_load_client_preferences(user))

    payload = request.get_json(silent=True) or {}
    updates = {
        key: payload[key]
        for key in DEFAULT_PREFERENCES.keys()
        if key in payload
    }
    if not updates:
        return jsonify(_load_client_preferences(user))

    try:
        preferences = _save_client_preferences(user, updates)
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to save preferences."}), 500

    return jsonify(preferences)


@api_bp.route("/api/account/documents", methods=["GET"])
@user_required
def account_documents():
    user = g.current_user
    documents, shared_documents = _documents_for_user(user)
    return jsonify({"documents": documents, "shared_documents": shared_documents})


@api_bp.route("/api/account/documents", methods=["POST"])
@user_required
@limiter.limit("10 per minute", key_func=get_remote_address, error_message=UPLOAD_RATE_LIMIT_MESSAGE)
@limiter.limit("30 per hour", key_func=_client_upload_limit_key, error_message=UPLOAD_RATE_LIMIT_MESSAGE)
def upload_account_document():
    user = g.current_user

    if "file" not in request.files:
        return jsonify({"error": "Choose a file to upload."}), 400

    file = request.files["file"]
    if not file or not file.filename:
        return jsonify({"error": "Choose a file to upload."}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "Unsupported file type."}), 415

    extension = Path(file.filename).suffix.lower().lstrip('.')
    if not extension:
        return jsonify({"error": "Unsupported file type."}), 415
    if extension in ALLOWED_IMAGE_EXTENSIONS and not is_valid_image_file(file):
        return jsonify({"error": "Unsupported file type."}), 415
    kind = (request.form.get("kind") or "inspiration").strip().lower()
    if kind not in {"inspiration", "document"}:
        kind = "document"

    title = (request.form.get("title") or "").strip() or None
    notes = (request.form.get("notes") or "").strip() or None

    unique_name = f"{uuid4().hex}.{extension}"
    safe_name = secure_filename(unique_name)

    cleanup_target = None
    try:
        stored_name, _stored_url = store_uploaded_media(file, safe_name)
        file_url = f"/api/uploads/{safe_name}"
        if _use_s3_uploads():
            cleanup_target = {"mode": "s3", "key": stored_name}
        else:
            cleanup_target = {
                "mode": "local",
                "path": Path(current_app.config["UPLOAD_FOLDER"]) / stored_name,
            }
    except MediaStorageError:
        return jsonify({"error": "Unable to store upload."}), 500

    document = ClientDocument(
        client=user,
        file_url=file_url,
        kind=kind,
        title=title,
        notes=notes,
    )
    db.session.add(document)
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        _cleanup_upload_target(cleanup_target)
        return jsonify({"error": "Unable to save inspiration."}), 500

    return jsonify(serialize_client_document(document)), 201


@api_bp.route("/api/dashboard/admin", methods=["GET"])
@admin_required
def admin_dashboard():
    admin: AdminAccount = g.current_admin

    client_totals = db.session.execute(
        select(
            func.count(ClientAccount.id),
            func.coalesce(
                func.sum(
                    case((ClientAccount.is_guest.is_(True), 1), else_=0)
                ),
                0,
            ),
        )
    ).one()
    total_users = int(client_totals[0] or 0)
    total_guests = int(client_totals[1] or 0)

    total_admins = int(db.session.execute(select(func.count(AdminAccount.id))).scalar_one() or 0)

    appointment_totals = db.session.execute(
        select(
            func.count(TattooAppointment.id),
            func.coalesce(
                func.sum(case((TattooAppointment.status == "pending", 1), else_=0)),
                0,
            ),
        )
    ).one()
    total_appointments = int(appointment_totals[0] or 0)
    pending_appointments = int(appointment_totals[1] or 0)

    published_gallery = int(
        db.session.execute(select(func.count(GalleryItem.id)).where(GalleryItem.is_published.is_(True))).scalar_one() or 0
    )

    recent_activity = (
        AdminActivityLog.query.options(joinedload(AdminActivityLog.admin))
        .order_by(AdminActivityLog.created_at.desc())
        .limit(10)
        .all()
    )

    recent_users = (
        ClientAccount.query.order_by(ClientAccount.created_at.desc()).limit(10).all()
    )

    settings = SystemSetting.query.order_by(SystemSetting.key.asc()).all()

    appointment_status_rows = db.session.execute(
        select(TattooAppointment.status, func.count(TattooAppointment.id)).group_by(TattooAppointment.status)
    ).all()

    gallery_by_category_rows = db.session.execute(
        select(TattooCategory.name, func.count(GalleryItem.id))
        .join(GalleryItem, GalleryItem.category_id == TattooCategory.id, isouter=True)
        .group_by(TattooCategory.id)
    ).all()

    gallery_preview = (
        GalleryItem.query.options(joinedload(GalleryItem.category), joinedload(GalleryItem.uploaded_by))
        .order_by(GalleryItem.created_at.desc())
        .limit(20)
        .all()
    )

    return jsonify(
        {
            "admin": serialize_admin(admin),
            "overview": {
                "total_users": total_users,
                "total_guests": total_guests,
                "total_admins": total_admins,
                "total_appointments": total_appointments,
                "pending_appointments": pending_appointments,
                "published_gallery_items": published_gallery,
            },
            "user_management": {
                "recent_users": [serialize_user_profile(user) for user in recent_users],
                "available_roles": ["user", "staff", "vip"],
            },
            "activity_tracking": [serialize_activity(entry) for entry in recent_activity],
            "analytics": {
                "appointments_by_status": {status or "unspecified": int(count or 0) for status, count in appointment_status_rows},
                "gallery_items_by_category": {
                    name or "Uncategorized": int(count or 0) for name, count in gallery_by_category_rows
                },
            },
            "content_control": {
                "categories": [serialize_category(category) for category in TattooCategory.query.all()],
                "gallery_items": [serialize_gallery_item(item) for item in gallery_preview],
            },
            "system_settings": [serialize_setting(setting) for setting in settings],
        }
    )


@api_bp.route("/api/admin/schedule", methods=["GET"])
@admin_required
def admin_get_schedule():
    operating_hours = fetch_working_hours_json()
    days_off = sorted({value.isoformat() for value in fetch_closure_dates()})
    closures = [serialize_closure(closure) for closure in StudioClosure.query.order_by(StudioClosure.date.asc()).all()]
    return jsonify({"operating_hours": operating_hours, "days_off": days_off, "closures": closures})


@api_bp.route("/api/admin/schedule", methods=["PUT"])
@admin_required
def admin_update_schedule():
    payload = request.get_json(silent=True) or {}
    operating_hours = payload.get("operating_hours")
    days_off = payload.get("days_off")

    if not isinstance(operating_hours, list):
        return jsonify({"error": "operating_hours must be a list."}), 400
    if not isinstance(days_off, list):
        return jsonify({"error": "days_off must be a list."}), 400

    normalised_hours = []
    working_hour_updates = []
    seen_days = set()
    for entry in operating_hours:
        if not isinstance(entry, dict):
            return jsonify({"error": "Each operating hour entry must be an object."}), 400
        day = entry.get("day")
        if day not in WEEK_DAYS:
            return jsonify({"error": f"Invalid day provided: {day}."}), 400
        if day in seen_days:
            return jsonify({"error": f"Duplicate day provided: {day}."}), 400
        seen_days.add(day)
        is_open = bool(entry.get("is_open"))
        open_time = (entry.get("open_time") or "").strip() or "10:00"
        close_time = (entry.get("close_time") or "").strip() or "18:00"
        for label, value in (("open_time", open_time), ("close_time", close_time)):
            if len(value) != 5 or value[2] != ":":
                return jsonify({"error": f"{label} must use HH:MM 24h format."}), 400
            try:
                hours, minutes = value.split(":")
                hour_i, minute_i = int(hours), int(minutes)
            except (TypeError, ValueError):
                return jsonify({"error": f"{label} must use HH:MM 24h format."}), 400
            if not (0 <= hour_i < 24 and 0 <= minute_i < 60):
                return jsonify({"error": f"{label} must be a valid time."}), 400
        if is_open and open_time >= close_time:
            return jsonify({"error": f"close_time must be after open_time for {day}."}), 400
        weekday_index = DAY_TO_INDEX[day]
        open_time_obj = _coerce_time(open_time, time(hour=10))
        close_time_obj = _coerce_time(close_time, time(hour=18))
        minimum_duration = _coerce_minimum_duration(entry.get("minimum_duration_minutes"))
        working_hour_updates.append(
            {
                "weekday": weekday_index,
                "is_open": is_open,
                "open_time": open_time_obj,
                "close_time": close_time_obj,
                "minimum_duration_minutes": minimum_duration,
                "day": day,
                "open_time_str": open_time,
                "close_time_str": close_time,
            }
        )
        normalised_hours.append(
            {
                "day": day,
                "is_open": is_open,
                "open_time": open_time,
                "close_time": close_time,
                "minimum_duration_minutes": minimum_duration,
            }
        )

    normalised_days_off = []
    seen_dates = set()
    closure_dates = set()
    for value in days_off:
        if not isinstance(value, str):
            return jsonify({"error": "days_off must only include ISO date strings."}), 400
        value = value.strip()
        try:
            parsed = date.fromisoformat(value)
        except ValueError:
            return jsonify({"error": f"Invalid day off {value}; use YYYY-MM-DD."}), 400
        iso_value = parsed.isoformat()
        if iso_value in seen_dates:
            continue
        seen_dates.add(iso_value)
        normalised_days_off.append(iso_value)
        closure_dates.add(parsed)

    normalised_hours.sort(key=lambda entry: DAY_TO_INDEX.get(entry["day"], 0))
    normalised_days_off.sort()

    existing_hours = {record.weekday: record for record in StudioWorkingHour.query.all()}
    provided_weekdays = set()
    for update in working_hour_updates:
        weekday = update["weekday"]
        provided_weekdays.add(weekday)
        record = existing_hours.get(weekday)
        if not record:
            record = StudioWorkingHour(weekday=weekday)
            db.session.add(record)
        record.is_open = update["is_open"]
        record.opens_at = update["open_time"]
        record.closes_at = update["close_time"]
        record.minimum_duration_minutes = update["minimum_duration_minutes"]
    for weekday, record in existing_hours.items():
        if weekday not in provided_weekdays:
            record.is_open = False

    existing_closures = {closure.date: closure for closure in StudioClosure.query.all()}
    for closure_date in closure_dates:
        if closure_date not in existing_closures:
            db.session.add(StudioClosure(date=closure_date))
    for closure_date, closure in existing_closures.items():
        if closure_date not in closure_dates:
            db.session.delete(closure)

    upsert_json_setting(
        "studio_operating_hours",
        normalised_hours,
        description="Defines weekly opening hours for the studio.",
    )
    upsert_json_setting(
        "studio_days_off",
        normalised_days_off,
        description="Dates when the studio does not accept appointments.",
    )

    admin: AdminAccount = g.current_admin

    try:
        log_admin_activity(
            admin,
            "schedule_update",
            details=f"Updated schedule with {len(normalised_hours)} day entries and {len(normalised_days_off)} days off.",
            ip_address=request.remote_addr,
        )
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to update schedule."}), 500

    closures = [serialize_closure(closure) for closure in StudioClosure.query.order_by(StudioClosure.date.asc()).all()]
    return jsonify(
        {
            "operating_hours": normalised_hours,
            "days_off": normalised_days_off,
            "closures": closures,
        }
    )


@api_bp.route("/api/admin/schedule/closures", methods=["POST"])
@admin_required
def admin_create_closure():
    payload = request.get_json(silent=True) or {}
    date_raw = (payload.get("date") or "").strip()
    if not date_raw:
        return jsonify({"error": "Date is required."}), 400
    try:
        parsed_date = date.fromisoformat(date_raw)
    except ValueError:
        return jsonify({"error": "Invalid date format; use YYYY-MM-DD."}), 400
    if StudioClosure.query.filter_by(date=parsed_date).first():
        return jsonify({"error": "A closure already exists for that date."}), 409
    reason = (payload.get("reason") or "").strip() or None
    closure = StudioClosure(date=parsed_date, reason=reason)
    db.session.add(closure)
    try:
        sync_closure_setting()
        admin: AdminAccount = g.current_admin
        log_admin_activity(
            admin,
            "closure_create",
            details=f"Created closure on {parsed_date.isoformat()}"
            + (f" with reason '{reason}'." if reason else "."),
            ip_address=request.remote_addr,
        )
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to create closure."}), 500
    return jsonify(serialize_closure(closure)), 201


@api_bp.route("/api/admin/schedule/closures/<int:closure_id>", methods=["PATCH"])
@admin_required
def admin_update_closure(closure_id):
    closure = StudioClosure.query.get_or_404(closure_id)
    payload = request.get_json(silent=True) or {}
    updated_fields = []
    date_raw = payload.get("date")
    if date_raw is not None:
        normalized = date_raw.strip()
        if not normalized:
            return jsonify({"error": "Date cannot be empty."}), 400
        try:
            new_date = date.fromisoformat(normalized)
        except ValueError:
            return jsonify({"error": "Invalid date format; use YYYY-MM-DD."}), 400
        if new_date != closure.date:
            if (
                StudioClosure.query.filter(
                    StudioClosure.date == new_date,
                    StudioClosure.id != closure.id
                ).first()
            ):
                return jsonify({"error": "Another closure already exists for that date."}), 409
            closure.date = new_date
            updated_fields.append("date")
    if "reason" in payload:
        new_reason = (payload.get("reason") or "").strip() or None
        if new_reason != closure.reason:
            closure.reason = new_reason
            updated_fields.append("reason")
    if not updated_fields:
        return jsonify(serialize_closure(closure))
    try:
        sync_closure_setting()
        admin: AdminAccount = g.current_admin
        log_admin_activity(
            admin,
            "closure_update",
            details=f"Updated closure #{closure.id}.",
            ip_address=request.remote_addr,
        )
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to update closure."}), 500
    return jsonify(serialize_closure(closure))


@api_bp.route("/api/admin/schedule/closures/<int:closure_id>", methods=["DELETE"])
@admin_required
def admin_delete_closure(closure_id):
    closure = StudioClosure.query.get_or_404(closure_id)
    db.session.delete(closure)
    try:
        sync_closure_setting()
        admin: AdminAccount = g.current_admin
        log_admin_activity(
            admin,
            "closure_delete",
            details=f"Removed closure on {closure.date.isoformat()}.",
            ip_address=request.remote_addr,
        )
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to delete closure."}), 500
    return '', 204


@api_bp.route("/api/admin/settings/hourly-rate", methods=["PUT"])
@admin_required
def admin_update_hourly_rate():
    payload = request.get_json(silent=True) or {}
    hourly_rate_value = payload.get("hourly_rate_cents")
    if hourly_rate_value is None:
        return jsonify({"error": "hourly_rate_cents is required."}), 400
    try:
        hourly_rate_cents = int(hourly_rate_value)
    except (TypeError, ValueError):
        return jsonify({"error": "hourly_rate_cents must be a whole number."}), 400
    if hourly_rate_cents <= 0:
        return jsonify({"error": "hourly_rate_cents must be greater than zero."}), 400

    setting = upsert_json_setting(
        HOURLY_RATE_SETTING_KEY,
        hourly_rate_cents,
        description="Studio billing hourly rate in cents."
    )
    admin: AdminAccount = g.current_admin
    log_admin_activity(
        admin,
        "hourly_rate_update",
        details=f"Updated hourly rate to {hourly_rate_cents} cents.",
        ip_address=request.remote_addr,
    )

    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to save hourly rate."}), 500

    return jsonify(
        {
            "hourly_rate_cents": hourly_rate_cents,
            "currency": _payment_currency(),
        }
    )


@api_bp.route("/api/admin/pricing/session-options", methods=["GET"])
@admin_required
def admin_list_session_options():
    options = SessionOption.query.order_by(SessionOption.duration_minutes.asc()).all()
    return jsonify([serialize_session_option(option) for option in options])


@api_bp.route("/api/admin/pricing/session-options", methods=["POST"])
@admin_required
def admin_create_session_option():
    payload = request.get_json(silent=True) or {}
    name = (payload.get("name") or "").strip() or None
    tagline = (payload.get("tagline") or "").strip() or None
    description = (payload.get("description") or "").strip() or None
    category = (payload.get("category") or "").strip() or None
    duration_raw = payload.get("duration_minutes")
    price_raw = payload.get("price_cents")
    is_active = parse_bool(payload.get("is_active"), default=True)

    errors = []
    try:
        duration_minutes = int(duration_raw)
    except (TypeError, ValueError):
        errors.append("duration_minutes must be a whole number.")
        duration_minutes = None
    try:
        price_cents = int(price_raw)
    except (TypeError, ValueError):
        errors.append("price_cents must be a whole number.")
        price_cents = None
    if duration_minutes is None or duration_minutes <= 0:
        errors.append("duration_minutes must be greater than zero.")
    if price_cents is None or price_cents < 0:
        errors.append("price_cents must be zero or greater.")

    if errors:
        return jsonify({"errors": errors}), 400

    option = SessionOption(
        name=name,
        tagline=tagline,
        description=description,
        category=category,
        duration_minutes=duration_minutes,
        price_cents=price_cents,
        is_active=is_active,
    )
    db.session.add(option)
    admin: AdminAccount = g.current_admin
    try:
        log_admin_activity(
            admin,
            "session_option_create",
            details=f"Created session option {duration_minutes}m at {price_cents} cents.",
            ip_address=request.remote_addr,
        )
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to create session option."}), 500

    return jsonify(serialize_session_option(option)), 201


@api_bp.route("/api/admin/pricing/session-options/<int:option_id>", methods=["PATCH"])
@admin_required
def admin_update_session_option(option_id):
    option = SessionOption.query.get_or_404(option_id)
    payload = request.get_json(silent=True) or {}
    name = payload.get("name")
    duration_raw = payload.get("duration_minutes")
    price_raw = payload.get("price_cents")
    is_active = payload.get("is_active")

    if name is not None:
        option.name = name.strip() or None
    if "tagline" in payload:
        option.tagline = (payload["tagline"] or "").strip() or None
    if "description" in payload:
        option.description = (payload["description"] or "").strip() or None
    if "category" in payload:
        option.category = (payload["category"] or "").strip() or None
    if duration_raw is not None:
        try:
            duration_minutes = int(duration_raw)
        except (TypeError, ValueError):
            return jsonify({"error": "duration_minutes must be a whole number."}), 400
        if duration_minutes <= 0:
            return jsonify({"error": "duration_minutes must be greater than zero."}), 400
        option.duration_minutes = duration_minutes
    if price_raw is not None:
        try:
            price_cents = int(price_raw)
        except (TypeError, ValueError):
            return jsonify({"error": "price_cents must be a whole number."}), 400
        if price_cents < 0:
            return jsonify({"error": "price_cents must be zero or greater."}), 400
        option.price_cents = price_cents
    if is_active is not None:
        option.is_active = bool(is_active)

    admin: AdminAccount = g.current_admin
    try:
        log_admin_activity(
            admin,
            "session_option_update",
            details=f"Updated session option {option.id}.",
            ip_address=request.remote_addr,
        )
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to update session option."}), 500

    return jsonify(serialize_session_option(option))


@api_bp.route("/api/admin/pricing/session-options/<int:option_id>", methods=["DELETE"])
@admin_required
def admin_delete_session_option(option_id):
    option = SessionOption.query.get_or_404(option_id)
    db.session.delete(option)
    admin: AdminAccount = g.current_admin
    try:
        log_admin_activity(
            admin,
            "session_option_delete",
            details=f"Deleted session option {option.id}.",
            ip_address=request.remote_addr,
        )
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to delete session option."}), 500

    return jsonify({"status": "deleted"})


@api_bp.route("/api/admin/pricing/booking-fee", methods=["PUT"])
@admin_required
def admin_update_booking_fee():
    payload = request.get_json(silent=True) or {}
    raw_value = payload.get("booking_fee_percent")
    try:
        percent = int(raw_value)
    except (TypeError, ValueError):
        return jsonify({"error": "booking_fee_percent must be a whole number."}), 400
    if percent < MINIMUM_BOOKING_FEE_PERCENT:
        return jsonify({"error": f"booking_fee_percent must be at least {MINIMUM_BOOKING_FEE_PERCENT}%."}), 400

    setting = upsert_json_setting(
        BOOKING_FEE_SETTING_KEY,
        percent,
        description="Percentage of a session price collected when booking.",
    )
    admin: AdminAccount = g.current_admin
    try:
        log_admin_activity(
            admin,
            "booking_fee_update",
            details=f"Updated booking fee to {percent}%.",
            ip_address=request.remote_addr,
        )
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to update booking fee."}), 500

    return jsonify({"booking_fee_percent": load_booking_fee_percent()})


@api_bp.route("/api/admin/users", methods=["GET"])
@admin_required
def admin_list_users():
    role = request.args.get("role")
    query = ClientAccount.query
    if role:
        query = query.filter(func.lower(ClientAccount.role) == role.lower())
    users = query.order_by(ClientAccount.created_at.desc()).all()
    return jsonify([serialize_user_profile(user) for user in users])


@api_bp.route("/api/admin/users/<int:user_id>/role", methods=["PATCH"])
@admin_required
def admin_update_user_role(user_id):
    payload = request.get_json(silent=True) or {}
    new_role = (payload.get("role") or "").strip().lower()
    if not new_role:
        return jsonify({"error": "Role is required."}), 400

    user = ClientAccount.query.get_or_404(user_id)
    previous_role = user.role
    user.role = new_role

    admin: AdminAccount = g.current_admin

    try:
        log_admin_activity(
            admin,
            "role_assignment",
            details=f"Changed user {user.email} role from {previous_role} to {new_role}",
            ip_address=request.remote_addr,
        )
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to update role."}), 500

    return jsonify(serialize_user_profile(user))


@api_bp.route("/api/admin/users/<int:user_id>/notifications", methods=["POST"])
@admin_required
def admin_create_user_notification(user_id):
    payload = request.get_json(silent=True) or {}
    title = (payload.get("title") or "").strip()
    body = (payload.get("body") or "").strip()
    category = (payload.get("category") or "").strip() or "general"

    if not title or not body:
        return jsonify({"error": "Title and body are required."}), 400

    user = ClientAccount.query.get_or_404(user_id)

    notification = UserNotification(user=user, title=title, body=body, category=category)
    db.session.add(notification)

    admin: AdminAccount = g.current_admin

    try:
        log_admin_activity(
            admin,
            "notification",
            details=f"Sent notification '{title}' to {user.email}",
            ip_address=request.remote_addr,
        )
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to send notification."}), 500

    return jsonify(serialize_notification(notification)), 201


@api_bp.route("/api/admin/users/<int:user_id>/notifications/<int:notification_id>", methods=["PATCH"])
@admin_required
def admin_update_user_notification(user_id, notification_id):
    notification = UserNotification.query.filter_by(user_id=user_id, id=notification_id).first()
    if not notification:
        return jsonify({"error": "Notification not found."}), 404

    payload = request.get_json(silent=True) or {}

    if "title" in payload:
        title = (payload.get("title") or "").strip()
        if not title:
            return jsonify({"error": "Title cannot be empty."}), 400
        notification.title = title

    if "body" in payload:
        body = (payload.get("body") or "").strip()
        if not body:
            return jsonify({"error": "Body cannot be empty."}), 400
        notification.body = body

    if "category" in payload:
        notification.category = (payload.get("category") or "").strip() or "general"

    if "is_read" in payload:
        notification.is_read = parse_bool(payload.get("is_read"), default=notification.is_read)

    admin: AdminAccount = g.current_admin

    try:
        log_admin_activity(
            admin,
            "notification_update",
            details=f"Updated notification {notification.id} for user_id={user_id}",
            ip_address=request.remote_addr,
        )
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to update notification."}), 500

    return jsonify(serialize_notification(notification))


@api_bp.route("/api/admin/users/<int:user_id>/notifications/<int:notification_id>", methods=["DELETE"])
@admin_required
def admin_delete_user_notification(user_id, notification_id):
    notification = UserNotification.query.filter_by(user_id=user_id, id=notification_id).first()
    if not notification:
        return jsonify({"error": "Notification not found."}), 404

    db.session.delete(notification)

    admin: AdminAccount = g.current_admin

    try:
        log_admin_activity(
            admin,
            "notification_delete",
            details=f"Removed notification {notification.id} for user_id={user_id}",
            ip_address=request.remote_addr,
        )
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to delete notification."}), 500

    return jsonify({"status": "deleted"})


@api_bp.route("/api/admin/admins", methods=["GET"])
@admin_required
def admin_list_admins():
    admins = AdminAccount.query.order_by(AdminAccount.name.asc()).all()
    return jsonify([serialize_admin(admin) for admin in admins])


@api_bp.route("/api/admin/categories", methods=["GET"])
@admin_required
def admin_list_categories():
    categories = (
        TattooCategory.query.options(joinedload(TattooCategory.gallery_items))
        .order_by(TattooCategory.created_at.desc())
        .all()
    )
    return jsonify(
        [
            {
                **serialize_category(category),
                "gallery_item_count": len(category.gallery_items),
            }
            for category in categories
        ]
    )


@api_bp.route("/api/admin/categories", methods=["POST"])
@admin_required
def admin_create_category():
    payload = request.get_json(silent=True) or {}
    name = (payload.get("name") or "").strip()
    description = (payload.get("description") or "").strip() or None
    is_active = parse_bool(payload.get("is_active"), default=True)

    if not name:
        return jsonify({"error": "Name is required."}), 400

    existing = TattooCategory.query.filter(func.lower(TattooCategory.name) == name.lower()).first()
    if existing:
        return jsonify({"error": "Category name already exists."}), 400

    category = TattooCategory(name=name, description=description, is_active=is_active)
    db.session.add(category)

    admin: AdminAccount = g.current_admin

    try:
        log_admin_activity(
            admin,
            "category_create",
            details=f"Created category {name}",
            ip_address=request.remote_addr,
        )
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to create category."}), 500

    return jsonify(serialize_category(category)), 201


@api_bp.route("/api/admin/categories/<int:category_id>", methods=["PATCH"])
@admin_required
def admin_update_category(category_id):
    category = TattooCategory.query.get_or_404(category_id)
    payload = request.get_json(silent=True) or {}

    if "name" in payload:
        name = (payload.get("name") or "").strip()
        if not name:
            return jsonify({"error": "Name cannot be empty."}), 400
        duplicate = (
            TattooCategory.query.filter(
                func.lower(TattooCategory.name) == name.lower(), TattooCategory.id != category.id
            ).first()
        )
        if duplicate:
            return jsonify({"error": "Another category already uses that name."}), 400
        category.name = name

    if "description" in payload:
        category.description = (payload.get("description") or "").strip() or None

    if "is_active" in payload:
        category.is_active = parse_bool(payload.get("is_active"), default=category.is_active)

    admin: AdminAccount = g.current_admin

    try:
        log_admin_activity(
            admin,
            "category_update",
            details=f"Updated category {category.id}",
            ip_address=request.remote_addr,
        )
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to update category."}), 500

    return jsonify(serialize_category(category))


@api_bp.route("/api/admin/categories/<int:category_id>", methods=["DELETE"])
@admin_required
def admin_delete_category(category_id):
    category = TattooCategory.query.get_or_404(category_id)

    db.session.delete(category)
    admin: AdminAccount = g.current_admin

    try:
        log_admin_activity(
            admin,
            "category_delete",
            details=f"Deleted category {category.id}",
            ip_address=request.remote_addr,
        )
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to delete category."}), 500

    return jsonify({"status": "deleted"})


@api_bp.route("/api/admin/gallery", methods=["POST"])
@admin_required
def admin_create_gallery_item():
    payload = request.get_json(silent=True) or {}
    category_id = payload.get("category_id")
    admin_id = payload.get("uploaded_by_admin_id")
    image_url = (payload.get("image_url") or "").strip()
    alt = (payload.get("alt") or "").strip()
    caption = (payload.get("caption") or "").strip() or None
    is_published = parse_bool(payload.get("is_published"), default=True)

    if not category_id or not image_url or not alt or not admin_id:
        return jsonify({"error": "Category, uploader, image URL, and alt text are required."}), 400

    category = TattooCategory.query.get(category_id)
    if not category:
        return jsonify({"error": "Category not found."}), 404

    admin_uploader = AdminAccount.query.get(admin_id)
    if not admin_uploader:
        return jsonify({"error": "Admin not found."}), 404

    item = GalleryItem(
        category=category,
        uploaded_by=admin_uploader,
        image_url=image_url,
        alt=alt,
        caption=caption,
        is_published=is_published,
    )

    db.session.add(item)
    acting_admin: AdminAccount = g.current_admin

    try:
        log_admin_activity(
            acting_admin,
            "gallery_create",
            details=f"Published gallery item {image_url}",
            ip_address=request.remote_addr,
        )
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to create gallery item."}), 500

    return jsonify(serialize_gallery_item(item)), 201


@api_bp.route("/api/admin/gallery/<int:item_id>", methods=["PATCH"])
@admin_required
def admin_update_gallery_item(item_id):
    item = GalleryItem.query.options(joinedload(GalleryItem.category), joinedload(GalleryItem.uploaded_by)).get_or_404(
        item_id
    )
    payload = request.get_json(silent=True) or {}

    if "category_id" in payload:
        category = TattooCategory.query.get(payload.get("category_id"))
        if not category:
            return jsonify({"error": "Category not found."}), 404
        item.category = category

    if "uploaded_by_admin_id" in payload:
        admin_uploader = AdminAccount.query.get(payload.get("uploaded_by_admin_id"))
        if not admin_uploader:
            return jsonify({"error": "Admin not found."}), 404
        item.uploaded_by = admin_uploader

    if "image_url" in payload:
        image_url = (payload.get("image_url") or "").strip()
        if not image_url:
            return jsonify({"error": "Image URL cannot be empty."}), 400
        item.image_url = image_url

    if "alt" in payload:
        alt = (payload.get("alt") or "").strip()
        if not alt:
            return jsonify({"error": "Alt text cannot be empty."}), 400
        item.alt = alt

    if "caption" in payload:
        item.caption = (payload.get("caption") or "").strip() or None

    if "is_published" in payload:
        item.is_published = parse_bool(payload.get("is_published"), default=item.is_published)

    acting_admin: AdminAccount = g.current_admin

    try:
        log_admin_activity(
            acting_admin,
            "gallery_update",
            details=f"Updated gallery item {item.id}",
            ip_address=request.remote_addr,
        )
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to update gallery item."}), 500

    return jsonify(serialize_gallery_item(item))


@api_bp.route("/api/admin/gallery/<int:item_id>", methods=["DELETE"])
@admin_required
def admin_delete_gallery_item(item_id):
    item = GalleryItem.query.get_or_404(item_id)

    db.session.delete(item)
    acting_admin: AdminAccount = g.current_admin

    try:
        log_admin_activity(
            acting_admin,
            "gallery_delete",
            details=f"Removed gallery item {item.id}",
            ip_address=request.remote_addr,
        )
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to delete gallery item."}), 500

    return jsonify({"status": "deleted"})


@api_bp.route("/api/admin/appointments", methods=["POST"])
@admin_required
def admin_create_appointment():
    payload = request.get_json(silent=True) or {}

    client_id = payload.get("client_id")
    guest_name = (payload.get("guest_name") or "").strip()
    guest_email = (payload.get("guest_email") or "").strip()
    guest_phone = (payload.get("guest_phone") or "").strip() or None
    contact_name = (payload.get("contact_name") or "").strip()
    contact_email = (payload.get("contact_email") or "").strip()
    contact_phone = (payload.get("contact_phone") or "").strip() or None
    client_description = (payload.get("client_description") or "").strip() or None
    status = (payload.get("status") or "pending").strip() or "pending"
    tattoo_placement = (payload.get("tattoo_placement") or "").strip()
    tattoo_size = (payload.get("tattoo_size") or "").strip()
    placement_notes = (payload.get("placement_notes") or "").strip()

    scheduled_start_raw = payload.get("scheduled_start")
    scheduled_start = parse_iso_datetime(scheduled_start_raw)
    if scheduled_start_raw and not scheduled_start:
        return jsonify({"error": "Invalid scheduled_start; use ISO 8601."}), 400
    if scheduled_start and (scheduled_start.minute % DEFAULT_SLOT_INTERVAL_MINUTES != 0 or scheduled_start.second or scheduled_start.microsecond):
        return jsonify({"error": "Start time must align with the hour."}), 400

    start_minimum_duration = MINIMUM_APPOINTMENT_DURATION_MINUTES
    start_day_label = None
    start_hours_map = None
    if scheduled_start:
        start_hours_map = fetch_working_hours_map()
        start_weekday = scheduled_start.date().weekday()
        start_minimum_duration = _minimum_duration_for_weekday(start_weekday, hours_map=start_hours_map)
        start_day_label = INDEX_TO_DAY.get(start_weekday, "this day").capitalize()

    duration_minutes = payload.get("duration_minutes")
    if duration_minutes is not None:
        try:
            duration_minutes = int(duration_minutes)
        except (TypeError, ValueError):
            return jsonify({"error": "duration_minutes must be an integer."}), 400

    suggested_duration = calculate_suggested_duration_minutes(tattoo_placement, tattoo_size) if (tattoo_placement or tattoo_size) else None
    if duration_minutes is None and suggested_duration is not None:
        duration_minutes = suggested_duration

    assigned_admin_id = payload.get("assigned_admin_id")
    assigned_admin = None
    if assigned_admin_id is not None:
        if assigned_admin_id == "":
            assigned_admin_id = None
        if assigned_admin_id is not None:
            assigned_admin = AdminAccount.query.get(assigned_admin_id)
            if not assigned_admin:
                return jsonify({"error": "Assigned admin not found."}), 404

    client_account = None
    if client_id:
        client_account = ClientAccount.query.get(client_id)
        if not client_account:
            return jsonify({"error": "Client not found."}), 404

    if duration_minutes is not None:
        if duration_minutes < start_minimum_duration:
            label = f" on {start_day_label}" if start_day_label else ""
            hours_label = start_minimum_duration / 60
            hours_display = (
                f"{int(hours_label)} hour{'s' if hours_label != 1 else ''}"
                if hours_label.is_integer()
                else f"{hours_label:.1f} hours"
            )
            return (
                jsonify(
                    {
                        "error": f"Minimum session length{label} is {hours_display}.",
                    }
                ),
                400,
            )
        if duration_minutes % DEFAULT_SLOT_INTERVAL_MINUTES != 0:
            return jsonify({"error": "Duration must use whole-hour increments."}), 400

    if scheduled_start and duration_minutes:
        available_slots, _window = build_available_slots(
            scheduled_start.date(),
            duration_minutes,
            minimum_duration_minutes=start_minimum_duration,
            hours_map=start_hours_map,
        )
        slot_available = any(
            abs(int((slot["start"] - scheduled_start).total_seconds())) < 60 for slot in available_slots
        )
        if not slot_available:
            return jsonify({"error": "Selected time slot is unavailable."}), 409

    if not client_account:
        if not guest_name and not contact_name:
            return jsonify({"error": "Provide either client_id or guest contact."}), 400
        if not guest_email and not contact_email:
            return jsonify({"error": "Guest email is required."}), 400

    if client_account:
        if not contact_name:
            contact_name = client_account.display_name
        if not contact_email:
            contact_email = client_account.email or guest_email
        if not contact_phone:
            contact_phone = client_account.phone or guest_phone
    else:
        if not contact_name:
            contact_name = guest_name
        if not contact_email:
            contact_email = guest_email
        if not contact_phone:
            contact_phone = guest_phone

    if not client_account:
        if not guest_name:
            guest_name = contact_name
        if not guest_email:
            guest_email = contact_email
        if not guest_phone:
            guest_phone = contact_phone

    appointment = TattooAppointment(
        reference_code=generate_reference_code(),
        client=client_account,
        guest_name=guest_name or None,
        guest_email=guest_email or None,
        guest_phone=guest_phone,
        client_description=client_description,
        status=status,
        scheduled_start=scheduled_start,
        duration_minutes=duration_minutes,
        assigned_admin=assigned_admin,
        contact_name=contact_name or None,
        contact_email=contact_email or None,
        contact_phone=contact_phone or None,
        tattoo_placement=tattoo_placement or None,
        tattoo_size=tattoo_size or None,
        placement_notes=placement_notes or None,
        suggested_duration_minutes=suggested_duration,
    )

    db.session.add(appointment)

    admin: AdminAccount = g.current_admin

    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to create appointment."}), 500

    appointment = (
        TattooAppointment.query.options(
            joinedload(TattooAppointment.client),
            joinedload(TattooAppointment.assigned_admin),
            joinedload(TattooAppointment.assets).joinedload(AppointmentAsset.admin_uploader),
            joinedload(TattooAppointment.assets).joinedload(AppointmentAsset.client_uploader),
            joinedload(TattooAppointment.payments),
        )
        .get(appointment.id)
    )

    try:
        log_admin_activity(
            admin,
            "appointment_create",
            details=f"Created appointment {appointment.reference_code or appointment.id}",
            ip_address=request.remote_addr,
        )
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()

    return jsonify(serialize_appointment(appointment)), 201


@api_bp.route("/api/admin/appointments/<int:appointment_id>", methods=["DELETE"])
@admin_required
def admin_delete_appointment(appointment_id):
    appointment = TattooAppointment.query.get_or_404(appointment_id)
    reference_code = appointment.reference_code or str(appointment.id)

    db.session.delete(appointment)
    admin: AdminAccount = g.current_admin

    try:
        log_admin_activity(
            admin,
            "appointment_delete",
            details=f"Deleted appointment {reference_code}",
            ip_address=request.remote_addr,
        )
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to delete appointment."}), 500

    return jsonify({"status": "deleted"})


@api_bp.route("/api/appointments", methods=["POST"])
def create_appointment():
    payload = request.get_json(silent=True) or {}
    errors = []
    signup_verification_code = None

    payments_active = _stripe_payments_active()

    client_account_id = payload.get("client_account_id")
    create_account = parse_bool(payload.get("create_account"), default=False)
    password = payload.get("password")

    first_name = (payload.get("first_name") or "").strip()
    last_name = (payload.get("last_name") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    phone = (payload.get("phone") or "").strip() or None

    contact_name = (payload.get("contact_name") or "").strip()
    contact_email_override = (payload.get("contact_email") or "").strip()
    contact_phone_override = (payload.get("contact_phone") or "").strip() or None

    inspiration_urls = payload.get("inspiration_urls") or []
    description = (payload.get("notes") or payload.get("description") or "").strip()

    if inspiration_urls and not isinstance(inspiration_urls, list):
        errors.append({"field": "inspiration_urls", "message": "Inspiration URLs must be a list of strings."})
    else:
        inspiration_urls = [url for url in inspiration_urls if isinstance(url, str) and url.strip()]

    if client_account_id:
        client_account = ClientAccount.query.get(client_account_id)
        if not client_account:
            errors.append({"field": "client_account_id", "message": "Client account not found."})
    else:
        client_account = None

    scheduled_start_raw = payload.get("scheduled_start")
    scheduled_start = parse_iso_datetime(scheduled_start_raw)
    if not scheduled_start:
        errors.append({"field": "scheduled_start", "message": "Please choose a session date and start time."})
    elif scheduled_start.minute % DEFAULT_SLOT_INTERVAL_MINUTES != 0 or scheduled_start.second or scheduled_start.microsecond:
        errors.append({"field": "scheduled_start", "message": "Start time must align with the hour."})
    elif scheduled_start < _nyc_now_naive():
        errors.append({"field": "scheduled_start", "message": "Select a future time slot."})

    booking_hours_map = None
    booking_minimum_duration = MINIMUM_APPOINTMENT_DURATION_MINUTES
    booking_day_label = None
    if scheduled_start:
        booking_hours_map = fetch_working_hours_map()
        booking_weekday = scheduled_start.date().weekday()
        booking_minimum_duration = _minimum_duration_for_weekday(booking_weekday, hours_map=booking_hours_map)
        booking_day_label = INDEX_TO_DAY.get(booking_weekday, "this day").capitalize()

    session_option_id = payload.get("session_option_id")
    session_option = None
    if session_option_id is not None and session_option_id != "":
        try:
            session_option_id = int(session_option_id)
        except (TypeError, ValueError):
            errors.append({"field": "session_option_id", "message": "Session option must be a whole number."})
        else:
            option = SessionOption.query.get(session_option_id)
            if not option or not option.is_active:
                errors.append({"field": "session_option_id", "message": "Session option not found."})
            else:
                session_option = option

    if not session_option:
        errors.append({"field": "session_option_id", "message": "Please choose a nail service."})

    if not client_account:
        if not first_name:
            errors.append({"field": "first_name", "message": "First name is required."})
        if not last_name:
            errors.append({"field": "last_name", "message": "Last name is required."})
        if not email:
            errors.append({"field": "email", "message": "Email is required."})
        if not phone:
            errors.append({"field": "phone", "message": "Phone number is required."})
        if create_account and (not password or len(password) < PASSWORD_MIN_LENGTH):
            errors.append({"field": "password", "message": f"Password must be at least {PASSWORD_MIN_LENGTH} characters."})

    if errors:
        return jsonify({"errors": errors}), 400

    if not client_account:
        existing_client = ClientAccount.query.filter(func.lower(ClientAccount.email) == email).first()
        if existing_client:
            client_account = existing_client
            if create_account and password:
                client_account.set_password(password)
                client_account.is_guest = False
                client_account.role = client_account.role or "user"
            if first_name and not client_account.first_name:
                client_account.first_name = first_name
            if last_name and not client_account.last_name:
                client_account.last_name = last_name
            if phone and not client_account.phone:
                client_account.phone = phone
        else:
            client_account = ClientAccount(
                first_name=first_name or None,
                last_name=last_name or None,
                email=email,
                phone=phone,
                is_guest=not create_account,
                role="user",
            )
            if create_account and password:
                client_account.set_password(password)
            db.session.add(client_account)
            db.session.flush()
    else:
        email = client_account.email or email
        phone = client_account.phone or phone

    if client_account and create_account and password and client_account.email and not client_account.email_verified_at:
        _token, signup_verification_code = _issue_email_verification_token(client_account)

    resolved_contact_name = contact_name or None
    resolved_contact_email = contact_email_override or None
    resolved_contact_phone = contact_phone_override or None

    if client_account:
        if not resolved_contact_name:
            resolved_contact_name = client_account.display_name
        if not resolved_contact_email:
            resolved_contact_email = client_account.email or email
        if not resolved_contact_phone:
            resolved_contact_phone = client_account.phone or phone
    else:
        resolved_contact_email = resolved_contact_email or email
        resolved_contact_phone = resolved_contact_phone or phone

    suggested_duration = session_option.duration_minutes if session_option else None
    duration_minutes = suggested_duration

    if scheduled_start and duration_minutes and not errors:
        available_slots, _window = build_available_slots(
            scheduled_start.date(),
            duration_minutes,
            minimum_duration_minutes=duration_minutes if session_option else booking_minimum_duration,
            hours_map=booking_hours_map,
            allow_shorter_than_weekday_minimum=True,
        )
        slot_available = any(
            abs(int((slot["start"] - scheduled_start).total_seconds())) < 60 for slot in available_slots
        )
        if not slot_available:
            errors.append(
                {
                    "field": "scheduled_start",
                    "message": "The selected time is unavailable. Please choose another slot.",
                }
            )

    if errors:
        return jsonify({"errors": errors}), 400

    contact_name_value = resolved_contact_name or " ".join(filter(None, [first_name, last_name]))
    display_contact_name = contact_name_value or (client_account.display_name if client_account else None)
    contact_email_value = resolved_contact_email or email or (client_account.email if client_account else None)
    contact_phone_value = resolved_contact_phone or phone or (client_account.phone if client_account else None)

    recommended_duration_minutes = (
        session_option.duration_minutes if session_option else (suggested_duration or duration_minutes)
    )
    booking_fee_percent = load_booking_fee_percent()
    session_price_cents = (
        session_option.price_cents if session_option else calculate_session_price_cents(recommended_duration_minutes)
    )
    pay_full_amount = parse_bool(payload.get("pay_full_amount"), default=False)
    charge_amount = session_price_cents if pay_full_amount else calculate_booking_fee_amount(session_price_cents, booking_fee_percent)

    requires_payment = charge_amount > 0
    if requires_payment:
        if not payments_active:
            return jsonify({"error": "Payments are currently unavailable. Please try again soon."}), 503

    if errors:
        return jsonify({"errors": errors}), 400

    payment_note = (
        f"{session_option.name or 'Nail appointment'} - full payment"
        if pay_full_amount
        else f"{session_option.name or 'Nail appointment'} - {booking_fee_percent}% deposit"
    )

    appointment = TattooAppointment(
        reference_code=generate_reference_code(),
        client=client_account,
        client_description=description or None,
        scheduled_start=scheduled_start,
        duration_minutes=duration_minutes,
        status="awaiting_payment" if requires_payment else "pending",
        placement_notes=description or None,
        suggested_duration_minutes=suggested_duration,
        session_option=session_option,
    )

    appointment.contact_name = display_contact_name
    appointment.contact_email = contact_email_value
    appointment.contact_phone = contact_phone_value

    if client_account and client_account.is_guest:
        appointment.guest_name = appointment.contact_name
        appointment.guest_email = appointment.contact_email
        appointment.guest_phone = appointment.contact_phone

    db.session.add(appointment)
    db.session.flush()

    assets = []

    for url in inspiration_urls:
        assets.append(
            AppointmentAsset(
                appointment=appointment,
                client_uploader=client_account,
                kind="inspiration_image",
                file_url=url.strip(),
                is_visible_to_client=True,
            )
        )

    if description:
        assets.append(
            AppointmentAsset(
                appointment=appointment,
                client_uploader=client_account,
                kind="description",
                note_text=description,
                is_visible_to_client=True,
            )
        )

    db.session.add_all(assets)
    receipt_url = None
    checkout_url = None
    checkout_session_id = None
    if requires_payment:
        try:
            checkout_session = create_stripe_checkout_session(
                appointment=appointment,
                amount_cents=charge_amount,
                currency=_payment_currency(),
                note=payment_note,
                contact_email=contact_email_value,
                pay_full_amount=pay_full_amount,
            )
        except StripePaymentError as exc:
            db.session.rollback()
            return jsonify({"error": str(exc)}), 503
        checkout_session_id = checkout_session.get("id")
        checkout_url = checkout_session.get("url")
        db.session.add(
            AppointmentPayment(
                appointment=appointment,
                provider="stripe",
                provider_payment_id=checkout_session_id or f"cs_pending_{secrets.token_hex(5)}",
                status="pending",
                amount_cents=charge_amount,
                currency=_payment_currency(),
                note=payment_note,
            )
        )

    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to create appointment."}), 500

    appointment = TattooAppointment.query.options(
        joinedload(TattooAppointment.client),
        joinedload(TattooAppointment.assigned_admin),
        joinedload(TattooAppointment.assets).joinedload(AppointmentAsset.admin_uploader),
        joinedload(TattooAppointment.assets).joinedload(AppointmentAsset.client_uploader),
        joinedload(TattooAppointment.payments),
    ).get(appointment.id)

    if not requires_payment:
        send_booking_confirmation_email(
            appointment,
            charge_amount_cents=charge_amount,
            session_price_cents=session_price_cents,
            booking_fee_percent=booking_fee_percent,
            pay_full_amount=pay_full_amount,
            receipt_url=receipt_url,
        )
        send_internal_booking_notification(
            appointment,
            charge_amount_cents=charge_amount,
            session_price_cents=session_price_cents,
            booking_fee_percent=booking_fee_percent,
            pay_full_amount=pay_full_amount,
            receipt_url=receipt_url,
        )
    if signup_verification_code and appointment.client:
        send_signup_email(appointment.client, signup_verification_code)

    return jsonify(
        {
            "appointment": serialize_appointment(appointment),
            "requires_payment": requires_payment,
            "checkout_url": checkout_url,
            "checkout_session_id": checkout_session_id,
            "checkout_client_secret": checkout_session.get("client_secret") if checkout_session else None,
        }
    ), 201


@api_bp.route("/api/payments/stripe/verify-session", methods=["POST"])
def verify_stripe_checkout_session():
    payload = request.get_json(silent=True) or {}
    appointment_id = payload.get("appointment_id")
    checkout_session_id = (payload.get("session_id") or "").strip()

    try:
        appointment_id = int(appointment_id)
    except (TypeError, ValueError):
        return jsonify({"error": "appointment_id must be a whole number."}), 400

    if not checkout_session_id:
        return jsonify({"error": "session_id is required."}), 400

    appointment = _load_appointment_for_payment(appointment_id)
    if not appointment:
        return jsonify({"error": "Appointment not found."}), 404

    had_paid_payment = any(payment.provider == "stripe" and payment.status == "paid" for payment in appointment.payments)
    try:
        payment = sync_checkout_payment_for_appointment(appointment, checkout_session_id)
        db.session.commit()
    except StripePaymentPendingError as exc:
        db.session.rollback()
        appointment = _load_appointment_for_payment(appointment_id)
        return (
            jsonify(
                {
                    "appointment": serialize_appointment(appointment) if appointment else None,
                    "payment_status": "processing",
                    "message": str(exc),
                }
            ),
            202,
        )
    except StripePaymentError as exc:
        db.session.rollback()
        return jsonify({"error": str(exc)}), 400
    except stripe.error.StripeError as exc:
        db.session.rollback()
        return jsonify({"error": str(exc)}), 400
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to verify payment right now."}), 500

    appointment = _load_appointment_for_payment(appointment.id)

    if payment and not had_paid_payment:
        _notify_for_paid_appointment(appointment, payment)

    return jsonify(serialize_appointment(appointment)), 200


@api_bp.route("/api/payments/stripe/webhook", methods=["POST"])
def stripe_webhook():
    payload = request.get_data(cache=False, as_text=False)
    signature = request.headers.get("Stripe-Signature", "")
    webhook_secret = (current_app.config.get("STRIPE_WEBHOOK_SECRET") or "").strip()

    try:
        if webhook_secret:
            event = stripe.Webhook.construct_event(payload, signature, webhook_secret)
        else:
            current_app.logger.warning("STRIPE_WEBHOOK_SECRET is not configured; accepting unsigned Stripe webhook payload.")
            event = json.loads(payload.decode("utf-8") or "{}")
    except ValueError:
        return jsonify({"error": "Invalid Stripe webhook payload."}), 400
    except stripe.error.SignatureVerificationError:
        return jsonify({"error": "Invalid Stripe webhook signature."}), 400

    event_type = event.get("type") or ""
    event_object = ((event.get("data") or {}).get("object")) or {}

    if event_type not in {"checkout.session.completed", "checkout.session.async_payment_succeeded"}:
        return jsonify({"received": True}), 200

    checkout_session_id = (event_object.get("id") or "").strip()
    appointment_id = event_object.get("client_reference_id") or (event_object.get("metadata") or {}).get("appointment_id")
    if not checkout_session_id or not appointment_id:
        current_app.logger.warning("Stripe webhook missing checkout session id or appointment id.")
        return jsonify({"received": True}), 200

    appointment = _load_appointment_for_payment(appointment_id)
    if not appointment:
        current_app.logger.warning("Stripe webhook referenced missing appointment %s.", appointment_id)
        return jsonify({"received": True}), 200

    had_paid_payment = any(payment.provider == "stripe" and payment.status == "paid" for payment in appointment.payments)
    try:
        payment = sync_checkout_payment_for_appointment(
            appointment,
            checkout_session_id,
            checkout_session=event_object,
        )
        db.session.commit()
    except StripePaymentPendingError:
        db.session.rollback()
        return jsonify({"received": True, "status": "processing"}), 200
    except (StripePaymentError, stripe.error.StripeError, SQLAlchemyError) as exc:
        db.session.rollback()
        current_app.logger.exception("Unable to finalize Stripe checkout session %s: %s", checkout_session_id, exc)
        return jsonify({"error": "Unable to process Stripe webhook."}), 500

    appointment = _load_appointment_for_payment(appointment.id)
    if payment and not had_paid_payment:
        _notify_for_paid_appointment(appointment, payment)

    return jsonify({"received": True}), 200


@api_bp.route("/api/admin/appointments", methods=["GET"])
@admin_required
def admin_list_appointments():
    status = request.args.get("status", type=str)
    page, per_page = _parse_pagination(default_per_page=25)

    query = TattooAppointment.query
    if status:
        query = query.filter(TattooAppointment.status == status)

    # Avoid an expensive full COUNT(*) for admin calendar loads in dev/prod.
    # Fetch one extra row to determine whether a next page exists.
    appointments_plus_one = (
        query.options(
            joinedload(TattooAppointment.client),
            joinedload(TattooAppointment.assigned_admin),
        )
        .order_by(TattooAppointment.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page + 1)
        .all()
    )
    has_next = len(appointments_plus_one) > per_page
    appointments = appointments_plus_one[:per_page]

    known_total = (page - 1) * per_page + len(appointments) + (1 if has_next else 0)
    total_pages = page + (1 if has_next else 0)


    return jsonify(
        {
            "items": [serialize_appointment(appointment, include_assets=False) for appointment in appointments],
            "meta": {
                "page": page,
                "per_page": per_page,
                "total": known_total,
                "pages": total_pages,
            },
        }
    )


@api_bp.route("/api/admin/appointments/<int:appointment_id>", methods=["GET"])
@admin_required
def admin_get_appointment(appointment_id):
    appointment = (
        TattooAppointment.query.options(
            joinedload(TattooAppointment.client),
            joinedload(TattooAppointment.assigned_admin),
            joinedload(TattooAppointment.assets).joinedload(AppointmentAsset.admin_uploader),
            joinedload(TattooAppointment.assets).joinedload(AppointmentAsset.client_uploader),
            joinedload(TattooAppointment.payments),
        )
        .get_or_404(appointment_id)
    )
    return jsonify(serialize_appointment(appointment))


@api_bp.route("/api/public/appointments/lookup", methods=["GET"])
@limiter.limit("10 per hour", key_func=get_remote_address)
def public_lookup_appointment():
    reference = (request.args.get("reference") or "").strip()
    contact_email = (request.args.get("email") or "").strip().lower()
    if not reference or not contact_email:
        return jsonify({"error": "Reference and contact email are required."}), 400

    appointment = (
        TattooAppointment.query.options(
            joinedload(TattooAppointment.client),
            joinedload(TattooAppointment.assigned_admin),
            joinedload(TattooAppointment.assets).joinedload(AppointmentAsset.admin_uploader),
            joinedload(TattooAppointment.assets).joinedload(AppointmentAsset.client_uploader),
            joinedload(TattooAppointment.payments),
        )
        .outerjoin(ClientAccount)
        .filter(
            TattooAppointment.reference_code == reference,
            or_(
                func.lower(TattooAppointment.contact_email) == contact_email,
                func.lower(TattooAppointment.guest_email) == contact_email,
                func.lower(ClientAccount.email) == contact_email,
            ),
        )
        .first()
    )
    if not appointment:
        return jsonify({"error": "Appointment not found."}), 404
    return jsonify(serialize_appointment(appointment))


@api_bp.route("/api/admin/appointments/<int:appointment_id>", methods=["PATCH"])
@admin_required
def admin_update_appointment(appointment_id):
    appointment = TattooAppointment.query.get_or_404(appointment_id)
    payload = request.get_json(silent=True) or {}

    previous_status = appointment.status
    previous_status_key = (previous_status or "").strip().lower()
    status_changed = False
    updated_status_label = None

    new_start = appointment.scheduled_start
    new_duration = appointment.duration_minutes
    new_placement = appointment.tattoo_placement
    new_size = appointment.tattoo_size
    new_notes = appointment.placement_notes
    requested_schedule_payload = "scheduled_start" in payload or "duration_minutes" in payload
    requested_start_change = "scheduled_start" in payload
    requested_duration_change = "duration_minutes" in payload

    if "status" in payload:
        status = (payload.get("status") or "").strip()
        if not status:
            return jsonify({"error": "Status cannot be empty."}), 400
        normalized_status = status.lower()
        if normalized_status != previous_status_key:
            status_changed = True
            updated_status_label = format_status_label(status)
        appointment.status = status

    if "scheduled_start" in payload:
        scheduled_start_raw = payload.get("scheduled_start")
        if scheduled_start_raw:
            parsed = parse_iso_datetime(scheduled_start_raw)
            if not parsed:
                return jsonify({"error": "Invalid datetime format (use ISO 8601)."}), 400
            if parsed.minute % DEFAULT_SLOT_INTERVAL_MINUTES != 0 or parsed.second or parsed.microsecond:
                return jsonify({"error": "Start time must align with the hour."}), 400
            new_start = parsed
        else:
            new_start = None

    reference_start = new_start if new_start is not None else appointment.scheduled_start
    schedule_hours_map = None
    schedule_minimum_duration = MINIMUM_APPOINTMENT_DURATION_MINUTES
    schedule_day_label = None
    if reference_start:
        schedule_hours_map = fetch_working_hours_map()
        schedule_weekday = reference_start.date().weekday()
        schedule_minimum_duration = _minimum_duration_for_weekday(schedule_weekday, hours_map=schedule_hours_map)
        schedule_day_label = INDEX_TO_DAY.get(schedule_weekday, "this day").capitalize()

    if "duration_minutes" in payload:
        duration = payload.get("duration_minutes")
        if duration is None:
            new_duration = None
        else:
            try:
                new_duration = int(duration)
            except (TypeError, ValueError):
                return jsonify({"error": "Duration must be an integer."}), 400
            if new_duration < schedule_minimum_duration:
                hours_value = schedule_minimum_duration / 60
                duration_desc = (
                    f"{int(hours_value)} hour{'s' if hours_value != 1 else ''}"
                    if hours_value.is_integer()
                    else f"{hours_value:.1f} hours"
                )
                return jsonify(
                    {
                        "error": f"Minimum session length on {schedule_day_label or 'this day'} is {duration_desc}."
                    }
                ), 400
            if new_duration % DEFAULT_SLOT_INTERVAL_MINUTES != 0:
                return jsonify({"error": "Duration must use whole-hour increments."}), 400

    if "assigned_admin_id" in payload:
        admin_id = payload.get("assigned_admin_id")
        if admin_id is None:
            appointment.assigned_admin = None
        else:
            assigned_admin = AdminAccount.query.get(admin_id)
            if not assigned_admin:
                return jsonify({"error": "Admin not found."}), 404
            appointment.assigned_admin = assigned_admin

    if "client_description" in payload:
        appointment.client_description = (payload.get("client_description") or "").strip() or None

    if "contact_name" in payload:
        appointment.contact_name = (payload.get("contact_name") or "").strip() or None
    if "contact_email" in payload:
        appointment.contact_email = (payload.get("contact_email") or "").strip() or None
    if "contact_phone" in payload:
        appointment.contact_phone = (payload.get("contact_phone") or "").strip() or None

    if "tattoo_placement" in payload:
        new_placement = (payload.get("tattoo_placement") or "").strip() or None
    if "tattoo_size" in payload:
        new_size = (payload.get("tattoo_size") or "").strip() or None
    if "placement_notes" in payload:
        new_notes = (payload.get("placement_notes") or "").strip() or None

    if "suggested_duration_minutes" in payload:
        suggested_value = payload.get("suggested_duration_minutes")
        if suggested_value is None:
            appointment.suggested_duration_minutes = None
        else:
            try:
                appointment.suggested_duration_minutes = int(suggested_value)
            except (TypeError, ValueError):
                return jsonify({"error": "Suggested duration must be an integer."}), 400

    existing_start_normalized = (
        appointment.scheduled_start.replace(second=0, microsecond=0) if appointment.scheduled_start else None
    )
    new_start_normalized = new_start.replace(second=0, microsecond=0) if new_start else None
    slot_start = new_start_normalized if new_start_normalized is not None else existing_start_normalized
    slot_duration = new_duration if new_duration is not None else appointment.duration_minutes
    schedule_changed = (
        requested_schedule_payload
        and slot_start is not None
        and slot_duration is not None
        and (
            (requested_start_change and new_start_normalized != existing_start_normalized)
            or (requested_duration_change and slot_duration != appointment.duration_minutes)
        )
    )

    if schedule_changed and slot_start and slot_duration:
        available_slots, _window = build_available_slots(
            slot_start.date(),
            slot_duration,
            ignore_appointment_id=appointment.id,
            minimum_duration_minutes=schedule_minimum_duration,
            hours_map=schedule_hours_map,
        )
        slot_available = any(abs(int((slot["start"] - slot_start).total_seconds())) < 60 for slot in available_slots)
        if not slot_available:
            return jsonify({"error": "Selected time slot is unavailable."}), 409

    appointment.scheduled_start = new_start
    appointment.duration_minutes = new_duration
    appointment.tattoo_placement = new_placement
    appointment.tattoo_size = new_size
    appointment.placement_notes = new_notes

    if (
        "suggested_duration_minutes" not in payload
        and (appointment.suggested_duration_minutes is None or "tattoo_placement" in payload or "tattoo_size" in payload)
    ):
        if new_placement or new_size:
            appointment.suggested_duration_minutes = calculate_suggested_duration_minutes(new_placement, new_size)

    if status_changed and appointment.client:
        reference_label = appointment.reference_code or f"Appointment #{appointment.id}"
        schedule_label = _format_status_schedule_label(appointment.scheduled_start)
        notification_parts = [f"{reference_label} is now {updated_status_label.lower()}."]
        if schedule_label:
            notification_parts.append(f"Scheduled for {schedule_label}.")
        notification_parts.append("Check your portal for the latest details.")
        notification = UserNotification(
            user=appointment.client,
            title=f"Appointment {updated_status_label}",
            body=" ".join(notification_parts),
            category="appointments",
        )
        db.session.add(notification)

    acting_admin: AdminAccount = g.current_admin

    try:
        log_admin_activity(
            acting_admin,
            "appointment_update",
            details=f"Updated appointment {appointment.id}",
            ip_address=request.remote_addr,
        )
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to update appointment."}), 500

    appointment = TattooAppointment.query.options(
        joinedload(TattooAppointment.client),
        joinedload(TattooAppointment.assigned_admin),
        joinedload(TattooAppointment.assets).joinedload(AppointmentAsset.admin_uploader),
        joinedload(TattooAppointment.assets).joinedload(AppointmentAsset.client_uploader),
        joinedload(TattooAppointment.payments),
    ).get(appointment.id)

    if status_changed:
        sent = send_appointment_status_update_email(
            appointment,
            status_label=updated_status_label,
        )
        if not sent:
            current_app.logger.debug(
                "Appointment status update email not sent for appointment %s; recipient missing or delivery failed.",
                appointment.id,
            )

    return jsonify(serialize_appointment(appointment))


@api_bp.route("/api/admin/appointments/<int:appointment_id>/assets", methods=["POST"])
@admin_required
def admin_create_appointment_asset(appointment_id):
    appointment = TattooAppointment.query.get_or_404(appointment_id)
    payload = request.get_json(silent=True) or {}

    kind = (payload.get("kind") or "").strip()
    file_url = (payload.get("file_url") or "").strip() or None
    note_text = (payload.get("note_text") or "").strip() or None
    is_visible = parse_bool(payload.get("is_visible_to_client"), default=True)
    uploaded_by_admin_id = payload.get("uploaded_by_admin_id")
    uploaded_by_client_id = payload.get("uploaded_by_client_id")

    if not kind:
        return jsonify({"error": "Kind is required."}), 400

    if not file_url and not note_text:
        return jsonify({"error": "Provide a file URL or note text."}), 400

    admin_uploader = None
    client_uploader = None

    if uploaded_by_admin_id:
        admin_uploader = AdminAccount.query.get(uploaded_by_admin_id)
        if not admin_uploader:
            return jsonify({"error": "Admin uploader not found."}), 404

    if uploaded_by_client_id:
        client_uploader = ClientAccount.query.get(uploaded_by_client_id)
        if not client_uploader:
            return jsonify({"error": "Client uploader not found."}), 404

    asset = AppointmentAsset(
        appointment=appointment,
        admin_uploader=admin_uploader,
        client_uploader=client_uploader,
        kind=kind,
        file_url=_normalize_private_upload_url(file_url) if file_url else None,
        note_text=note_text,
        is_visible_to_client=is_visible,
    )

    db.session.add(asset)
    acting_admin: AdminAccount = g.current_admin

    try:
        log_admin_activity(
            acting_admin,
            "asset_create",
            details=f"Added asset {kind} to appointment {appointment_id}",
            ip_address=request.remote_addr,
        )
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to create asset."}), 500

    asset = AppointmentAsset.query.options(
        joinedload(AppointmentAsset.admin_uploader),
        joinedload(AppointmentAsset.client_uploader),
    ).get(asset.id)

    return jsonify(
        {
            "id": asset.id,
            "kind": asset.kind,
            "file_url": _serialize_asset_file_url(asset),
            "note_text": asset.note_text,
            "is_visible_to_client": asset.is_visible_to_client,
            "created_at": asset.created_at.isoformat() if asset.created_at else None,
            "uploaded_by_admin": serialize_admin(asset.admin_uploader) if asset.admin_uploader else None,
            "uploaded_by_client": {
                "id": asset.client_uploader.id,
                "display_name": asset.client_uploader.display_name,
                "email": asset.client_uploader.email,
            }
            if asset.client_uploader
            else None,
        }
    ), 201


@api_bp.route("/api/admin/appointments/<int:appointment_id>/assets/<int:asset_id>", methods=["PATCH"])
@admin_required
def admin_update_appointment_asset(appointment_id, asset_id):
    asset = (
        AppointmentAsset.query.options(
            joinedload(AppointmentAsset.admin_uploader),
            joinedload(AppointmentAsset.client_uploader),
        )
        .filter_by(appointment_id=appointment_id, id=asset_id)
        .first()
    )

    if not asset:
        return jsonify({"error": "Asset not found."}), 404

    payload = request.get_json(silent=True) or {}

    if "kind" in payload:
        kind = (payload.get("kind") or "").strip()
        if not kind:
            return jsonify({"error": "Kind cannot be empty."}), 400
        asset.kind = kind

    if "file_url" in payload:
        asset.file_url = _normalize_private_upload_url((payload.get("file_url") or "").strip()) or None

    if "note_text" in payload:
        asset.note_text = (payload.get("note_text") or "").strip() or None

    if "is_visible_to_client" in payload:
        asset.is_visible_to_client = parse_bool(payload.get("is_visible_to_client"), default=asset.is_visible_to_client)

    if "uploaded_by_admin_id" in payload:
        admin_id = payload.get("uploaded_by_admin_id")
        if admin_id is None:
            asset.admin_uploader = None
        else:
            admin_uploader = AdminAccount.query.get(admin_id)
            if not admin_uploader:
                return jsonify({"error": "Admin uploader not found."}), 404
            asset.admin_uploader = admin_uploader

    if "uploaded_by_client_id" in payload:
        client_id = payload.get("uploaded_by_client_id")
        if client_id is None:
            asset.client_uploader = None
        else:
            client_uploader = ClientAccount.query.get(client_id)
            if not client_uploader:
                return jsonify({"error": "Client uploader not found."}), 404
            asset.client_uploader = client_uploader

    acting_admin: AdminAccount = g.current_admin

    try:
        log_admin_activity(
            acting_admin,
            "asset_update",
            details=f"Updated asset {asset.id} on appointment {appointment_id}",
            ip_address=request.remote_addr,
        )
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to update asset."}), 500

    return jsonify(
        {
            "id": asset.id,
            "kind": asset.kind,
            "file_url": _serialize_asset_file_url(asset),
            "note_text": asset.note_text,
            "is_visible_to_client": asset.is_visible_to_client,
            "created_at": asset.created_at.isoformat() if asset.created_at else None,
            "uploaded_by_admin": serialize_admin(asset.admin_uploader) if asset.admin_uploader else None,
            "uploaded_by_client": {
                "id": asset.client_uploader.id,
                "display_name": asset.client_uploader.display_name,
                "email": asset.client_uploader.email,
            }
            if asset.client_uploader
            else None,
        }
    )


@api_bp.route("/api/admin/appointments/<int:appointment_id>/assets/<int:asset_id>", methods=["DELETE"])
@admin_required
def admin_delete_appointment_asset(appointment_id, asset_id):
    asset = AppointmentAsset.query.filter_by(appointment_id=appointment_id, id=asset_id).first()
    if not asset:
        return jsonify({"error": "Asset not found."}), 404

    db.session.delete(asset)
    acting_admin: AdminAccount = g.current_admin

    try:
        log_admin_activity(
            acting_admin,
            "asset_delete",
            details=f"Removed asset {asset.id} from appointment {appointment_id}",
            ip_address=request.remote_addr,
        )
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to delete asset."}), 500

    return jsonify({"status": "deleted"})
