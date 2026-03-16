from datetime import datetime, timedelta, timezone
from html import escape
from typing import TYPE_CHECKING
from zoneinfo import ZoneInfo

from .base import brand_name, client_base_url, email_logo_url, mailgun_send
from ..status_helpers import format_status_label

NYC_TZ = ZoneInfo("America/New_York")

if TYPE_CHECKING:  # pragma: no cover
    from app.models import TattooAppointment


def _format_appointment_datetime(dt: datetime | None, duration_minutes: int | None = None) -> str | None:
    if not dt:
        return None
    try:
        # Naive datetimes from the database are in NYC local time
        # (build_available_slots creates them via datetime.combine with
        # the studio's operating hours). Localize to NYC, not UTC.
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=NYC_TZ)
        
        # Convert to NYC time (no-op when already NYC)
        start_nyc = dt.astimezone(NYC_TZ)
        date_part = start_nyc.strftime("%A, %B %d %Y")
        start_time_part = start_nyc.strftime("%I:%M %p")
        
        if duration_minutes:
            end_nyc = start_nyc + timedelta(minutes=duration_minutes)
            end_time_part = end_nyc.strftime("%I:%M %p")
            return f"{date_part} from {start_time_part} to {end_time_part} ET"
            
        return f"{date_part} at {start_time_part} ET"
    except Exception:
        pass
    return dt.strftime("%A, %B %d %Y at %I:%M %p")


def send_appointment_status_update_email(
    appointment: "TattooAppointment",
    *,
    status_label: str | None = None,
) -> bool:
    """Notify the client if their appointment status changes."""
    recipient = (
        appointment.contact_email
        or (appointment.client.email if appointment.client else None)
    )
    if not recipient:
        return False
    label = status_label or format_status_label(appointment.status)
    brand = brand_name()
    reference = appointment.reference_code or f"Appointment #{appointment.id}"
    scheduled_label = _format_appointment_datetime(appointment.scheduled_start, appointment.duration_minutes)
    service_name = (
        appointment.session_option.name
        if getattr(appointment, "session_option", None) and appointment.session_option.name
        else "Nail appointment"
    )
    manage_url = f"{client_base_url()}/portal/appointments"

    contact_name = (
        appointment.contact_name
        or (appointment.client.display_name if appointment.client else None)
        or "there"
    )

    text_lines = [
        f"Hi {contact_name},",
        f"{reference} is now {label.lower()}.",
    ]
    if scheduled_label:
        text_lines.append(f"- Scheduled: {scheduled_label}")
    text_lines.extend(
        [
            f"- Service: {service_name}",
            f"- Manage: {manage_url}",
            "Reply to this email if you have questions or updates.",
        ]
    )
    text = "\n".join(text_lines)

    detail_rows = []

    def _detail_row(label_text, value, *, link_text=None):
        if not value:
            return
        rendered = escape(value)
        if link_text:
            rendered = (
                f'<a href="{escape(value)}" '
                'style="color:#0f172a;text-decoration:none;">'
                f"{escape(link_text)}</a>"
            )
        detail_rows.append(
            "<tr>"
            f'<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;'
            f'color:#6b7280;font-size:13px;font-weight:600;">{escape(label_text)}</td>'
            f'<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;'
            f'color:#0f172a;font-weight:600;font-size:14px;">{rendered}</td>'
            "</tr>"
        )

    _detail_row("Status", label)
    _detail_row("Reference", reference)
    if scheduled_label:
        _detail_row("Scheduled", scheduled_label)
    _detail_row("Service", service_name)
    _detail_row("Manage", manage_url, link_text="Open portal")

    detail_table = "".join(detail_rows)
    logo_url = email_logo_url()
    logo_markup = (
        f'<img src="{escape(logo_url)}" alt="{escape(brand)} logo" '
        'style="height:60px;display:block;margin:0 auto 12px auto;">'
        if logo_url
        else f'<div style="color:#ffffff;font-size:16px;font-weight:700;letter-spacing:0.5px;">{escape(brand)}</div>'
    )

    status_badge = (
        f'<span style="display:inline-flex;align-items:center;gap:6px;'
        'font-size:12px;font-weight:600;letter-spacing:0.2em;'
        'text-transform:uppercase;background:#0f172a;color:#fff;'
        'padding:6px 14px;border-radius:999px;">'
        f"{escape(label)}</span>"
    )
    manage_button = (
        '<a href="'
        + escape(manage_url)
        + '" style="display:inline-block;padding:12px 20px;background-color:#0b0b0b;'
        'color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">'
        "Manage appointment</a>"
    )

    html = (
        '<table role="presentation" cellspacing="0" cellpadding="0" border="0" '
        'style="width:100%;background-color:#f5f7fb;padding:32px 0;">'
        "<tr><td align=\"center\">"
        '<table role="presentation" cellspacing="0" cellpadding="0" border="0" '
        'style="width:640px;max-width:92%;background-color:#ffffff;border-radius:16px;'
        'overflow:hidden;box-shadow:0 10px 45px rgba(0,0,0,0.08);">'
        "<tr>"
        '<td style="padding:28px 32px 12px 32px;background-color:#0b0b0b;text-align:center;">'
        f"{logo_markup}"
        "<div style=\"color:#ffffff;font-size:18px;font-weight:700;\">Appointment update</div>"
        f"<div style=\"margin-top:6px;\">{status_badge}</div>"
        "</td>"
        "</tr>"
        "<tr>"
        '<td style="padding:28px 32px;color:#0f172a;font-size:15px;line-height:1.6;">'
        f"<p style=\"margin:0 0 12px 0;\">Hi {escape(contact_name)},</p>"
        f"<p style=\"margin:0 0 18px 0;\">Your appointment {escape(reference)} is now {escape(label.lower())}.</p>"
        '<table role="presentation" cellspacing="0" cellpadding="0" border="0" '
        'style="width:100%;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">'
        f"{detail_table}"
        "</table>"
        "<p style=\"margin:18px 0 14px 0;\">Need help? Reply to this email and our team will assist.</p>"
        f"<div style=\"margin:6px 0 20px 0;\">{manage_button}</div>"
        "</td>"
        "</tr>"
        "</table>"
        "</td></tr>"
        "</table>"
    )

    html_document = (
        "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" "
        'content=\"width=device-width, initial-scale=1.0\"></head><body>'
        + html
        + "</body></html>"
    )

    return mailgun_send(
        to=recipient,
        subject=f"{brand} appointment update – {reference}",
        text=text,
        html=html_document,
        tags=("appointments", "status-update"),
    )
