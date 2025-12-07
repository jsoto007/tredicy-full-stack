from __future__ import annotations

from datetime import datetime, timedelta, timezone
from html import escape
from uuid import uuid4

from flask import current_app

from .base import brand_name, client_base_url, mailgun_send
from .booking_confirmation import (
    _default_currency,
    _format_appointment_datetime,
    _format_currency,
)

def _payment_label(charge_amount_cents: int, pay_full_amount: bool, booking_fee_percent: int) -> str:
    if charge_amount_cents <= 0:
        return "No payment required"
    if pay_full_amount:
        return "Paid in full"
    return f"{booking_fee_percent}% deposit received"

def _duration_label(duration_minutes: int | None) -> str:
    if duration_minutes:
        hours = duration_minutes / 60.0
        return f"{hours:.1f}h" if not hours.is_integer() else f"{int(hours)}h"
    return "Session"

def _safe_filename(reference: str) -> str:
    cleaned = "".join(char if char.isalnum() else "_" for char in reference or "")
    cleaned = cleaned.strip("_")
    return cleaned or "booking"

def _ics_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("\n", "\\n").replace(",", "\\,").replace(";", "\\;")

def _format_ics_timestamp(dt: datetime) -> str:
    timestamp = dt
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    timestamp = timestamp.astimezone(timezone.utc)
    return timestamp.strftime("%Y%m%dT%H%M%SZ")

def _build_calendar_attachment(
    summary: str,
    description: str,
    location: str,
    start: datetime,
    end: datetime,
    organizer_email: str,
    attendee_email: str,
) -> str:
    lines = [
        "BEGIN:VCALENDAR",
        "PRODID:-//Black Work NYC//Booking Notification//EN",
        "VERSION:2.0",
        "METHOD:REQUEST",
        "BEGIN:VEVENT",
        f"UID:{uuid4()}@{organizer_email.split('@')[-1]}",
        f"DTSTAMP:{_format_ics_timestamp(datetime.now(timezone.utc))}",
        f"DTSTART:{_format_ics_timestamp(start)}",
        f"DTEND:{_format_ics_timestamp(end)}",
        f"SUMMARY:{_ics_escape(summary)}",
        f"DESCRIPTION:{_ics_escape(description)}",
        f"LOCATION:{_ics_escape(location)}",
        "STATUS:CONFIRMED",
        "CLASS:PUBLIC",
        f"ORGANIZER;CN={_ics_escape(location)}:mailto:{organizer_email}",
        f"ATTENDEE;CN={_ics_escape(attendee_email)};ROLE=REQ-PARTICIPANT;"
        f"PARTSTAT=NEEDS-ACTION;RSVP=FALSE:mailto:{attendee_email}",
        "END:VEVENT",
        "END:VCALENDAR",
    ]
    return "\r\n".join(lines)

def _compute_end_time(appointment: "TattooAppointment") -> datetime | None:
    if appointment.scheduled_end:
        return appointment.scheduled_end
    if not appointment.scheduled_start:
        return None
    duration = appointment.duration_minutes or appointment.suggested_duration_minutes or 60
    return appointment.scheduled_start + timedelta(minutes=duration)

def _detail_lines(
    reference: str,
    appointment: "TattooAppointment",
    scheduled_label: str,
    duration_label: str,
    payment_label: str,
    charge_amount_cents: int,
    session_price_cents: int,
    payment_currency: str,
    receipt_url: str | None,
    manage_url: str | None,
) -> list[str]:
    lines = [
        f"Reference: {reference}",
        f"Client: {appointment.display_client_name}",
        f"Contact: {appointment.display_contact_email or 'n/a'}",
        f"Scheduled: {scheduled_label}",
        f"Duration: {duration_label}",
        f"Placement: {appointment.tattoo_placement or 'n/a'}",
        f"Size: {appointment.tattoo_size or 'n/a'}",
        f"Payment: {payment_label} ({_format_currency(charge_amount_cents, payment_currency)})",
    ]
    if session_price_cents:
        lines.append(f"Session price: {_format_currency(session_price_cents, payment_currency)}")
    if appointment.client_description:
        lines.append(f"Notes: {appointment.client_description}")
    if receipt_url:
        lines.append(f"Receipt: {receipt_url}")
    if manage_url:
        lines.append(f"Manage: {manage_url}")
    return lines

def send_internal_booking_notification(
    appointment: "TattooAppointment",
    *,
    charge_amount_cents: int,
    session_price_cents: int,
    booking_fee_percent: int,
    pay_full_amount: bool,
    receipt_url: str | None = None,
) -> bool:
    """Notify the internal inbox and include an invite for jsoto@sotodev.com."""
    brand = brand_name()
    reference = appointment.reference_code or f"Appointment #{appointment.id}"
    payments = getattr(appointment, "payments", None) or []
    payment_currency = payments[0].currency if payments else _default_currency()
    scheduled_label = _format_appointment_datetime(appointment.scheduled_start)
    duration_label = _duration_label(appointment.duration_minutes)
    payment_label = _payment_label(charge_amount_cents, pay_full_amount, booking_fee_percent)
    base_url = client_base_url()
    manage_url = f"{base_url}/portal/appointments" if base_url else None
    detail_lines = _detail_lines(
        reference,
        appointment,
        scheduled_label,
        duration_label,
        payment_label,
        charge_amount_cents,
        session_price_cents,
        payment_currency,
        receipt_url,
        manage_url,
    )
    appointment_location = current_app.config.get("BOOKING_LOCATION_NAME") or brand
    text = "\n".join(detail_lines)
    html_lines = [
        "<p>A new booking has been confirmed:</p>",
        "<ul>",
        *(f"<li>{escape(line)}</li>" for line in detail_lines),
        "</ul>",
    ]
    html = "".join(html_lines)
    organizer_email = current_app.config.get("MAILGUN_FROM") or f"no-reply@{current_app.config.get('MAILGUN_DOMAIN') or 'blackworknyc.com'}"
    internal_email = current_app.config.get("INTERNAL_BOOKING_NOTIFICATION_EMAIL") or "jsoto@sotodev.com"
    attachment = None
    if appointment.scheduled_start:
        end_time = _compute_end_time(appointment)
        if end_time:
            summary = f"{brand} booking – {reference}"
            description = "\n".join(detail_lines)
            attachment = _build_calendar_attachment(
                summary=summary,
                description=description,
                location=appointment_location,
                start=appointment.scheduled_start,
                end=end_time,
                organizer_email=organizer_email,
                attendee_email=internal_email,
            )
    attachments = []
    if attachment:
        attachments.append((f"{_safe_filename(reference)}.ics", attachment, "text/calendar; method=REQUEST; charset=UTF-8"))

    return mailgun_send(
        to=internal_email,
        subject=f"{brand} booking confirmed – {reference}",
        text=text,
        html=html,
        tags=("appointments", "admin-notification"),
        attachments=attachments or None,
    )
