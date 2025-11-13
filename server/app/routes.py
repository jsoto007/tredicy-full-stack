import hmac
import json
import math
import secrets
from datetime import date, datetime, time, timedelta
from functools import wraps
from pathlib import Path
from uuid import uuid4

import boto3
import requests
from botocore.exceptions import BotoCoreError, ClientError
from flask import Blueprint, current_app, g, jsonify, request, send_from_directory, session
from sqlalchemy import case, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import joinedload
from werkzeug.utils import secure_filename

from .config import db
from .extensions import limiter
from .models import (
    AdminAccount,
    AdminActivityLog,
    AppointmentAsset,
    AppointmentPayment,
    ClientAccount,
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
)

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

DEFAULT_OPERATING_HOURS = [
    {"day": "monday", "is_open": True, "open_time": "10:00", "close_time": "18:00"},
    {"day": "tuesday", "is_open": True, "open_time": "10:00", "close_time": "18:00"},
    {"day": "wednesday", "is_open": True, "open_time": "10:00", "close_time": "18:00"},
    {"day": "thursday", "is_open": True, "open_time": "10:00", "close_time": "18:00"},
    {"day": "friday", "is_open": True, "open_time": "10:00", "close_time": "18:00"},
    {"day": "saturday", "is_open": True, "open_time": "10:00", "close_time": "16:00"},
    {"day": "sunday", "is_open": False, "open_time": "10:00", "close_time": "14:00"},
]

ALLOWED_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp", "heic", "heif"}
ALLOWED_UPLOAD_EXTENSIONS = ALLOWED_IMAGE_EXTENSIONS | {"pdf", "txt", "doc", "docx"}

DAY_TO_INDEX = {day: index for index, day in enumerate(WEEK_DAYS)}
INDEX_TO_DAY = {index: day for day, index in DAY_TO_INDEX.items()}
NON_BLOCKING_APPOINTMENT_STATUSES = {"cancelled", "cancelled_by_client", "declined", "no_show"}
DEFAULT_SLOT_INTERVAL_MINUTES = 60
MINIMUM_APPOINTMENT_DURATION_MINUTES = 60

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
}

SIZE_MULTIPLIERS = {
    "small": 1.0,  # up to palm-sized
    "medium": 1.5,  # hand-sized to quarter sleeve
    "large": 2.0,  # half sleeve / medium panel
    "xl": 3.0,  # full back / large format
}


class MediaStorageError(Exception):
    pass


class SquarePaymentError(Exception):
    pass


def _use_s3_uploads() -> bool:
    return bool(current_app.config.get("UPLOADS_S3_BUCKET"))


def _build_s3_key(filename: str) -> str:
    prefix = (current_app.config.get("UPLOADS_S3_PREFIX") or "").strip().strip("/")
    if prefix:
        return f"{prefix.rstrip('/')}/{filename}"
    return filename


def _store_media_locally(file_storage, safe_name: str):
    upload_dir = Path(current_app.config["UPLOAD_FOLDER"])
    upload_dir.mkdir(parents=True, exist_ok=True)
    destination = upload_dir / safe_name
    file_storage.stream.seek(0)
    file_storage.save(destination)
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
    extra_args = {"ContentType": file_storage.mimetype or "application/octet-stream"}
    acl = current_app.config.get("UPLOADS_S3_ACL")
    if acl:
        extra_args["ACL"] = acl
    s3_client = boto3.client("s3", region_name=current_app.config.get("UPLOADS_S3_REGION") or None)
    file_storage.stream.seek(0)
    try:
        s3_client.upload_fileobj(file_storage.stream, bucket, key, ExtraArgs=extra_args)
    except (BotoCoreError, ClientError) as exc:
        raise MediaStorageError(str(exc)) from exc
    return key, _public_s3_url(bucket, key)


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
            boto3.client("s3", region_name=current_app.config.get("UPLOADS_S3_REGION") or None).delete_object(
                Bucket=bucket,
                Key=key,
            )
        except (BotoCoreError, ClientError):
            current_app.logger.warning("Unable to delete orphaned upload %s from bucket %s", key, bucket)


def _square_payments_active() -> bool:
    app = current_app
    if app.config.get("SQUARE_FAKE_PAYMENTS"):
        return True
    return bool(
        app.config.get("SQUARE_APPLICATION_ID")
        and app.config.get("SQUARE_LOCATION_ID")
        and app.config.get("SQUARE_ACCESS_TOKEN")
    )


def _square_public_enabled() -> bool:
    app = current_app
    if app.config.get("SQUARE_FAKE_PAYMENTS"):
        return False
    return bool(app.config.get("SQUARE_APPLICATION_ID") and app.config.get("SQUARE_LOCATION_ID"))


def _square_api_base() -> str:
    environment = (current_app.config.get("SQUARE_ENVIRONMENT") or "sandbox").lower()
    if environment == "production":
        return "https://connect.squareup.com"
    return "https://connect.squareupsandbox.com"


def _square_deposit_amount() -> int:
    return max(1, int(current_app.config.get("SQUARE_DEPOSIT_AMOUNT_CENTS") or 10000))


def _square_currency() -> str:
    return (current_app.config.get("SQUARE_DEPOSIT_CURRENCY") or "USD").upper()


def charge_square_payment(
    *,
    source_id: str,
    idempotency_key: str | None,
    verification_token: str | None,
    buyer_email: str | None,
    note: str | None,
) -> dict:
    if current_app.config.get("SQUARE_FAKE_PAYMENTS"):
        return {
            "payment": {
                "id": f"demo-{secrets.token_hex(6)}",
                "status": "COMPLETED",
                "amount_money": {"amount": _square_deposit_amount(), "currency": _square_currency()},
                "receipt_url": None,
                "note": note,
            }
        }

    access_token = current_app.config.get("SQUARE_ACCESS_TOKEN")
    location_id = current_app.config.get("SQUARE_LOCATION_ID")
    application_id = current_app.config.get("SQUARE_APPLICATION_ID")
    if not all([access_token, location_id, application_id]):
        raise SquarePaymentError("Square payments are not configured.")

    payload = {
        "idempotency_key": idempotency_key or secrets.token_hex(12),
        "source_id": source_id,
        "location_id": location_id,
        "amount_money": {"amount": _square_deposit_amount(), "currency": _square_currency()},
        "autocomplete": True,
        "note": note or "Tattoo appointment deposit",
    }
    if buyer_email:
        payload["buyer_email_address"] = buyer_email
    if verification_token:
        payload["verification_token"] = verification_token

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "Square-Version": "2024-08-21",
    }
    try:
        response = requests.post(
            f"{_square_api_base()}/v2/payments",
            headers=headers,
            json=payload,
            timeout=15,
        )
    except requests.RequestException as exc:
        raise SquarePaymentError("Unable to contact Square.") from exc

    if response.status_code >= 400:
        try:
            error_body = response.json()
        except ValueError:
            error_body = {}
        message = error_body.get("errors", [{}])[0].get("detail") or "Square payment was declined."
        raise SquarePaymentError(message)

    return response.json()


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


def serialize_appointment(appointment):
    client = appointment.client
    assigned_admin = appointment.assigned_admin
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
        "assets": [
            {
                "id": asset.id,
                "kind": asset.kind,
                "file_url": asset.file_url,
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
        ],
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
        "has_identity_documents": user.has_identity_documents() if hasattr(user, "has_identity_documents") else False,
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "preferences": _load_client_preferences(user),
    }


def serialize_client_document(document: ClientDocument):
    return {
        "id": f"document-{document.id}",
        "kind": document.kind,
        "title": document.title or document.kind.replace("_", " ").title(),
        "notes": document.notes,
        "file_url": document.file_url,
        "created_at": document.created_at.isoformat() if document.created_at else None,
        "source": "you",
    }


def serialize_visible_asset(asset: AppointmentAsset):
    appointment_ref = asset.appointment.reference_code or f"#{asset.appointment.id}" if asset.appointment else None
    return {
        "id": f"asset-{asset.id}",
        "kind": asset.kind,
        "title": asset.note_text or asset.kind.replace("_", " ").title(),
        "file_url": asset.file_url,
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


def allowed_file(filename: str) -> bool:
    if not filename or "." not in filename:
        return False
    return filename.rsplit(".", 1)[1].lower() in ALLOWED_UPLOAD_EXTENSIONS


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
        return value
    if not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        if value.endswith("Z"):
            try:
                return datetime.fromisoformat(f"{value[:-1]}+00:00")
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


def _working_hours_from_records(records):
    result = {}
    for record in records:
        result[record.weekday] = {
            "day": INDEX_TO_DAY.get(record.weekday, WEEK_DAYS[record.weekday % 7]),
            "is_open": record.is_open,
            "open_time": record.opens_at,
            "close_time": record.closes_at,
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
                }
            )
        else:
            output.append(
                {
                    "day": INDEX_TO_DAY.get(weekday, WEEK_DAYS[weekday % 7]),
                    "is_open": False,
                    "open_time": "00:00",
                    "close_time": "00:00",
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


def build_available_slots(target_date: date, duration_minutes: int | None, *, ignore_appointment_id: int | None = None):
    hours_map = fetch_working_hours_map()
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
    requested_duration_minutes = max(
        duration_minutes or MINIMUM_APPOINTMENT_DURATION_MINUTES,
        MINIMUM_APPOINTMENT_DURATION_MINUTES,
    )
    if requested_duration_minutes % DEFAULT_SLOT_INTERVAL_MINUTES != 0:
        requested_duration_minutes = (
            (requested_duration_minutes // DEFAULT_SLOT_INTERVAL_MINUTES) + 1
        ) * DEFAULT_SLOT_INTERVAL_MINUTES
    slot_duration = timedelta(minutes=requested_duration_minutes)

    blocked_intervals = collect_blocked_intervals(day_start, day_end, ignore_appointment_id=ignore_appointment_id)
    now = datetime.utcnow()

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
    placement = request.args.get("placement")
    size = request.args.get("size")

    if duration_param is not None and duration_param < MINIMUM_APPOINTMENT_DURATION_MINUTES:
        return (
            jsonify(
                {
                    "error": f"Minimum appointment duration is {MINIMUM_APPOINTMENT_DURATION_MINUTES // 60} hour.",
                }
            ),
            400,
        )

    duration_minutes = duration_param or calculate_suggested_duration_minutes(placement, size)
    if duration_minutes % DEFAULT_SLOT_INTERVAL_MINUTES != 0:
        duration_minutes = int(
            max(
                MINIMUM_APPOINTMENT_DURATION_MINUTES,
                round(duration_minutes / DEFAULT_SLOT_INTERVAL_MINUTES) * DEFAULT_SLOT_INTERVAL_MINUTES,
            )
        )

    slots, window = build_available_slots(target_date, duration_minutes)
    return jsonify(
        {
            "date": target_date.isoformat(),
            "duration_minutes": duration_minutes,
            "slot_interval_minutes": DEFAULT_SLOT_INTERVAL_MINUTES,
            "minimum_duration_minutes": MINIMUM_APPOINTMENT_DURATION_MINUTES,
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
    if not password or len(password) < 8:
        errors.append({"field": "password", "message": "Password must be at least 8 characters."})

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
        }
    ), 201


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


@api_bp.route("/api/uploads/<path:filename>", methods=["GET"])
def serve_uploaded_file(filename):
    upload_dir = Path(current_app.config["UPLOAD_FOLDER"])
    file_path = upload_dir / filename
    if not file_path.exists() or not file_path.is_file():
        return jsonify({"error": "File not found."}), 404
    return send_from_directory(upload_dir, filename, as_attachment=False)


@api_bp.route("/api/admin/uploads", methods=["POST"])
@admin_required
def admin_upload_media():
    if "file" not in request.files:
        return jsonify({"error": "No file provided."}), 400

    file = request.files["file"]
    if not file or file.filename == "":
        return jsonify({"error": "Empty file."}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "Unsupported file type."}), 400

    extension = file.filename.rsplit(".", 1)[1].lower()
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
    enabled = _square_public_enabled()
    return jsonify(
        {
            "square": {
                "enabled": enabled,
                "demo_mode": bool(current_app.config.get("SQUARE_FAKE_PAYMENTS")),
                "requires_payment": _square_payments_active(),
                "application_id": current_app.config.get("SQUARE_APPLICATION_ID") if enabled else None,
                "location_id": current_app.config.get("SQUARE_LOCATION_ID") if enabled else None,
                "environment": current_app.config.get("SQUARE_ENVIRONMENT") or "sandbox",
                "deposit_amount_cents": _square_deposit_amount(),
                "currency": _square_currency(),
            }
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
def upload_account_document():
    user = g.current_user

    if "file" not in request.files:
        return jsonify({"error": "Choose a file to upload."}), 400

    file = request.files["file"]
    if not file or not file.filename:
        return jsonify({"error": "Choose a file to upload."}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "Unsupported file type."}), 400

    kind = (request.form.get("kind") or "inspiration").strip().lower()
    if kind not in {"inspiration", "document"}:
        kind = "document"

    title = (request.form.get("title") or "").strip() or None
    notes = (request.form.get("notes") or "").strip() or None

    extension = file.filename.rsplit(".", 1)[1].lower()
    unique_name = f"{uuid4().hex}.{extension}"
    safe_name = secure_filename(unique_name)

    cleanup_target = None
    try:
        stored_name, file_url = store_uploaded_media(file, safe_name)
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
    return jsonify({"operating_hours": operating_hours, "days_off": days_off})


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
        working_hour_updates.append(
            {
                "weekday": weekday_index,
                "is_open": is_open,
                "open_time": open_time_obj,
                "close_time": close_time_obj,
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

    return jsonify({"operating_hours": normalised_hours, "days_off": normalised_days_off})


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
        if duration_minutes < MINIMUM_APPOINTMENT_DURATION_MINUTES:
            return jsonify(
                {
                    "error": f"Minimum session length is {MINIMUM_APPOINTMENT_DURATION_MINUTES // 60} hour.",
                }
            ), 400
        if duration_minutes % DEFAULT_SLOT_INTERVAL_MINUTES != 0:
            return jsonify({"error": "Duration must use whole-hour increments."}), 400

    if scheduled_start and duration_minutes:
        available_slots, _window = build_available_slots(scheduled_start.date(), duration_minutes)
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

    payments_active = _square_payments_active()
    if not payments_active:
        return jsonify({"error": "Payments are currently unavailable. Please try again soon."}), 503

    payments_demo_mode = bool(current_app.config.get("SQUARE_FAKE_PAYMENTS"))
    square_source_id = (payload.get("square_source_id") or "").strip()
    square_idempotency_key = (payload.get("square_idempotency_key") or "").strip() or None
    square_verification_token = (payload.get("square_verification_token") or "").strip() or None

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

    tattoo_placement = (payload.get("tattoo_placement") or "").strip()
    tattoo_size = (payload.get("tattoo_size") or "").strip()
    placement_notes = (payload.get("placement_notes") or "").strip()

    id_front_url = (payload.get("id_front_url") or "").strip()
    id_back_url = (payload.get("id_back_url") or "").strip()
    inspiration_urls = payload.get("inspiration_urls") or []
    reuse_identity_requested = parse_bool(payload.get("reuse_identity_on_file"), default=False)
    if id_front_url or id_back_url:
        reuse_identity_requested = False
    description = (payload.get("description") or "").strip()

    if inspiration_urls and not isinstance(inspiration_urls, list):
        errors.append({"field": "inspiration_urls", "message": "Inspiration URLs must be a list of strings."})
    else:
        inspiration_urls = [url for url in inspiration_urls if isinstance(url, str) and url.strip()]

    if not inspiration_urls and not description:
        errors.append({"field": "description", "message": "Provide inspiration images or a written description."})

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
    elif scheduled_start < datetime.utcnow():
        errors.append({"field": "scheduled_start", "message": "Select a future time slot."})

    duration_minutes = payload.get("duration_minutes")
    if duration_minutes is not None:
        try:
            duration_minutes = int(duration_minutes)
        except (TypeError, ValueError):
            errors.append({"field": "duration_minutes", "message": "Duration must be an integer."})

    if not tattoo_placement:
        errors.append({"field": "tattoo_placement", "message": "Placement is required."})
    if not tattoo_size:
        errors.append({"field": "tattoo_size", "message": "Approximate size is required."})

    if payments_active and not payments_demo_mode and not square_source_id:
        errors.append({"field": "payment_method", "message": "Add a payment method to secure your booking."})

    if not client_account:
        if not email:
            errors.append({"field": "email", "message": "Email is required."})
        if create_account and (not password or len(password) < 8):
            errors.append({"field": "password", "message": "Password must be at least 8 characters."})

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

    stored_identity_assets = {}
    reuse_identity = False
    if client_account and client_account_id:
        stored_identity_assets = _latest_identity_assets_for_client(client_account)
        reuse_identity = reuse_identity_requested and bool(
            stored_identity_assets.get("id_front") and stored_identity_assets.get("id_back")
        )

    if not reuse_identity:
        if not id_front_url:
            errors.append({"field": "id_front_url", "message": "Front ID image is required."})
        if not id_back_url:
            errors.append({"field": "id_back_url", "message": "Back ID image is required."})

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

    suggested_duration = calculate_suggested_duration_minutes(tattoo_placement, tattoo_size)
    if duration_minutes is None:
        duration_minutes = suggested_duration

    if duration_minutes < MINIMUM_APPOINTMENT_DURATION_MINUTES:
        errors.append(
            {
                "field": "duration_minutes",
                "message": f"Minimum session length is {MINIMUM_APPOINTMENT_DURATION_MINUTES // 60} hour.",
            }
        )
    if duration_minutes % DEFAULT_SLOT_INTERVAL_MINUTES != 0:
        errors.append({"field": "duration_minutes", "message": "Duration must use whole-hour increments."})

    if scheduled_start and duration_minutes and not errors:
        available_slots, _window = build_available_slots(scheduled_start.date(), duration_minutes)
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

    payment_result = None
    try:
        payment_result = charge_square_payment(
            source_id=square_source_id or ("demo-source" if payments_demo_mode else ""),
            idempotency_key=square_idempotency_key,
            verification_token=square_verification_token,
            buyer_email=contact_email_value,
            note=f"Booking deposit for {display_contact_name or contact_email_value or email or 'client'}",
        )
    except SquarePaymentError as exc:
        return jsonify({"error": str(exc)}), 402

    appointment = TattooAppointment(
        reference_code=generate_reference_code(),
        client=client_account,
        client_description=description or None,
        scheduled_start=scheduled_start,
        duration_minutes=duration_minutes,
        status="pending",
        tattoo_placement=tattoo_placement or None,
        tattoo_size=tattoo_size or None,
        placement_notes=placement_notes or None,
        suggested_duration_minutes=suggested_duration,
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

    if reuse_identity:
        for kind in ("id_front", "id_back"):
            assets.append(
                AppointmentAsset(
                    appointment=appointment,
                    client_uploader=client_account,
                    kind=kind,
                    file_url=stored_identity_assets.get(kind),
                    is_visible_to_client=False,
                )
            )
    else:
        assets.extend(
            [
                AppointmentAsset(
                    appointment=appointment,
                    client_uploader=client_account,
                    kind="id_front",
                    file_url=id_front_url,
                    is_visible_to_client=False,
                ),
                AppointmentAsset(
                    appointment=appointment,
                    client_uploader=client_account,
                    kind="id_back",
                    file_url=id_back_url,
                    is_visible_to_client=False,
                ),
            ]
        )

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
    payment_payload = (payment_result or {}).get("payment") or {}
    amount_details = payment_payload.get("amount_money") or {}
    db.session.add(
        AppointmentPayment(
            appointment=appointment,
            provider="square",
            provider_payment_id=payment_payload.get("id") or f"demo-{secrets.token_hex(5)}",
            status=payment_payload.get("status") or "COMPLETED",
            amount_cents=int(amount_details.get("amount") or _square_deposit_amount()),
            currency=amount_details.get("currency") or _square_currency(),
            receipt_url=payment_payload.get("receipt_url"),
            note=payment_payload.get("note") or "Booking deposit",
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

    return jsonify(serialize_appointment(appointment)), 201


@api_bp.route("/api/admin/appointments", methods=["GET"])
@admin_required
def admin_list_appointments():
    status = request.args.get("status", type=str)
    page, per_page = _parse_pagination(default_per_page=25)

    query = TattooAppointment.query
    if status:
        query = query.filter(TattooAppointment.status == status)

    total = query.count()

    appointments = (
        query.options(
            joinedload(TattooAppointment.client),
            joinedload(TattooAppointment.assigned_admin),
            joinedload(TattooAppointment.assets).joinedload(AppointmentAsset.admin_uploader),
            joinedload(TattooAppointment.assets).joinedload(AppointmentAsset.client_uploader),
            joinedload(TattooAppointment.payments),
        )
        .order_by(TattooAppointment.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    total_pages = math.ceil(total / per_page) if per_page else 1

    return jsonify(
        {
            "items": [serialize_appointment(appointment) for appointment in appointments],
            "meta": {
                "page": page,
                "per_page": per_page,
                "total": total,
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


@api_bp.route("/api/admin/appointments/<int:appointment_id>", methods=["PATCH"])
@admin_required
def admin_update_appointment(appointment_id):
    appointment = TattooAppointment.query.get_or_404(appointment_id)
    payload = request.get_json(silent=True) or {}

    new_start = appointment.scheduled_start
    new_duration = appointment.duration_minutes
    new_placement = appointment.tattoo_placement
    new_size = appointment.tattoo_size
    new_notes = appointment.placement_notes

    if "status" in payload:
        status = (payload.get("status") or "").strip()
        if not status:
            return jsonify({"error": "Status cannot be empty."}), 400
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

    if "duration_minutes" in payload:
        duration = payload.get("duration_minutes")
        if duration is None:
            new_duration = None
        else:
            try:
                new_duration = int(duration)
            except (TypeError, ValueError):
                return jsonify({"error": "Duration must be an integer."}), 400
            if new_duration < MINIMUM_APPOINTMENT_DURATION_MINUTES:
                return jsonify(
                    {
                        "error": f"Minimum session length is {MINIMUM_APPOINTMENT_DURATION_MINUTES // 60} hour.",
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

    if new_start and new_duration:
        available_slots, _window = build_available_slots(
            new_start.date(),
            new_duration,
            ignore_appointment_id=appointment.id,
        )
        slot_available = any(abs(int((slot["start"] - new_start).total_seconds())) < 60 for slot in available_slots)
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
        file_url=file_url,
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
            "file_url": asset.file_url,
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
        asset.file_url = (payload.get("file_url") or "").strip() or None

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
            "file_url": asset.file_url,
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
