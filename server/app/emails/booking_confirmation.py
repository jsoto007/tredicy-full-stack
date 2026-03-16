from datetime import datetime, timedelta, timezone
from urllib.parse import quote, quote_plus
from html import escape
from typing import TYPE_CHECKING
from zoneinfo import ZoneInfo

from flask import current_app

from .base import brand_name, client_base_url, email_logo_url, mailgun_send

DEFAULT_STUDIO_LOCATION = "1205 College Ave, Bronx, NY 10456"
BOOKING_SUPPORT_EMAIL = "Booking@mail.blackworknyc.com"
NYC_TZ = ZoneInfo("America/New_York")

if TYPE_CHECKING:  # pragma: no cover
    from app.models import TattooAppointment


def _default_currency() -> str:
    return (current_app.config.get("STRIPE_CURRENCY") or "USD").upper()


def _format_currency(amount_cents: int | float | None, currency: str | None = None) -> str:
    if amount_cents is None:
        return ""
    code = (currency or _default_currency()).upper()
    return f"{code} {float(amount_cents) / 100:,.2f}"


def _format_appointment_datetime(dt: datetime | None, duration_minutes: int | None = None) -> str:
    if not dt:
        return "To be scheduled"
    try:
        # Naive datetimes from the database are in NYC local time
        # (build_available_slots creates them as NYC-local via datetime.combine
        # with the studio's operating hours). Localize them to NYC rather than
        # assuming UTC, so the displayed time matches what the user selected.
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=NYC_TZ)

        # Convert to NYC time (no-op when already NYC, correct when tz-aware UTC)
        start_nyc = dt.astimezone(NYC_TZ)
        date_part = start_nyc.strftime("%A, %B %d %Y")
        start_time_part = start_nyc.strftime("%I:%M %p")
        
        if duration_minutes:
            end_nyc = start_nyc + timedelta(minutes=duration_minutes)
            end_time_part = end_nyc.strftime("%I:%M %p")
            return f"{date_part} from {start_time_part} to {end_time_part} ET"
            
        return f"{date_part} at {start_time_part} ET"
    except Exception:
        # Fallback to simple formatting if conversion fails
        return dt.strftime("%A, %B %d %Y at %I:%M %p")


def _format_field_label(value: str | None) -> str:
    if not value:
        return ""
    cleaned = " ".join(value.replace("_", " ").split())
    return cleaned.capitalize()


def send_booking_confirmation_email(
    appointment: "TattooAppointment",
    *,
    charge_amount_cents: int,
    session_price_cents: int,
    booking_fee_percent: int,
    pay_full_amount: bool,
    receipt_url: str | None = None,
) -> bool:
    """Send the booking confirmation with payment and session details."""
    brand = brand_name()
    logo_url = email_logo_url()
    recipient = appointment.contact_email or (appointment.client.email if appointment.client else None)
    if not recipient:
        return False
    base_url = client_base_url()
    payments = getattr(appointment, "payments", None) or []
    payment_currency = payments[0].currency if payments else _default_currency()
    reference = appointment.reference_code or f"Appointment #{appointment.id}"
    scheduled_label = _format_appointment_datetime(appointment.scheduled_start, appointment.duration_minutes)
    service_name = (
        appointment.session_option.name
        if getattr(appointment, "session_option", None) and appointment.session_option.name
        else "Nail appointment"
    )
    if appointment.duration_minutes:
        hours = appointment.duration_minutes / 60.0
        duration_label = f"{hours:.1f}h" if not hours.is_integer() else f"{int(hours)}h"
    else:
        duration_label = "Session"
    payment_label = (
        "No payment required"
        if charge_amount_cents <= 0
        else ("Paid in full" if pay_full_amount else f"{booking_fee_percent}% deposit received")
    )
    manage_url = f"{base_url}/portal/appointments"
    studio_location = current_app.config.get("STUDIO_LOCATION") or DEFAULT_STUDIO_LOCATION
    booking_contact_email = current_app.config.get("BOOKING_CONTACT_EMAIL") or BOOKING_SUPPORT_EMAIL
    confirmation_url = None
    if base_url and appointment.contact_email:
        confirmation_url = (
            f"{base_url}/booking/confirmation?reference={quote_plus(reference)}"
            f"&email={quote_plus(appointment.contact_email)}"
        )

    calendar_attachment = None
    google_calendar_url = None
    apple_calendar_data_uri = None
    if appointment.scheduled_start:
        duration_minutes = appointment.duration_minutes or 60
        start_at = appointment.scheduled_start
        # Naive datetimes are stored in NYC local time
        if start_at.tzinfo is None:
            start_at = start_at.replace(tzinfo=NYC_TZ)
        end_at = start_at + timedelta(minutes=duration_minutes)
        start_utc = start_at.astimezone(timezone.utc)
        end_utc = end_at.astimezone(timezone.utc)
        start_stamp = start_utc.strftime("%Y%m%dT%H%M%SZ")
        end_stamp = end_utc.strftime("%Y%m%dT%H%M%SZ")
        summary = f"{brand} booking – {reference}"
        description = f"Reference {reference}. Manage: {manage_url}"
        google_calendar_url = (
            "https://calendar.google.com/calendar/render?action=TEMPLATE"
            f"&text={quote_plus(summary)}"
            f"&dates={start_stamp}/{end_stamp}"
            f"&details={quote_plus(description)}"
            f"&location={quote_plus(studio_location)}"
        )
        event_uid = f"{reference}-{appointment.id}@mail.blackworknyc.com"
        dtstamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        ics_lines = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
            "PRODID:-//Black Work NYC//Booking Confirmation//EN",
            "BEGIN:VEVENT",
            f"UID:{event_uid}",
            f"DTSTAMP:{dtstamp}",
            f"DTSTART:{start_stamp}",
            f"DTEND:{end_stamp}",
            f"SUMMARY:{summary}",
            f"DESCRIPTION:{description}",
            f"LOCATION:{studio_location}",
            "END:VEVENT",
            "END:VCALENDAR",
        ]
        ics_text = "\r\n".join(ics_lines)
        safe_reference = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in reference)
        filename = f"{safe_reference}-booking.ics" if safe_reference else "booking.ics"
        calendar_attachment = (filename, ics_text.encode("utf-8"), "text/calendar")
        apple_calendar_data_uri = f"data:text/calendar;charset=utf-8,{quote(ics_text)}"
    subject = f"{brand} booking confirmed – {reference}"

    lines = [
        f"Hi {appointment.contact_name or 'there'},",
        f"Thank you for booking with {brand}. Your appointment is confirmed. Here are the details:",
        f"- Reference: {reference}",
        f"- Appointment: {scheduled_label} ({duration_label})",
        f"- Studio address: {studio_location}",
        f"- Service: {service_name}",
        f"- Payment: {payment_label} ({_format_currency(charge_amount_cents, payment_currency)})",
    ]
    if session_price_cents:
        lines.append(f"- Service price: {_format_currency(session_price_cents, payment_currency)}")
    if appointment.client_description:
        lines.append(f"- Notes: {appointment.client_description}")
    if receipt_url:
        lines.append(f"- Receipt: {receipt_url}")
    lines.append(f"- Manage: {manage_url}")
    if confirmation_url:
        lines.append(f"- View confirmation: {confirmation_url}")
    lines.append("If any details need adjusting, reply to this email and our team will help.")
    if google_calendar_url:
        lines.append(f"- Google Calendar: {google_calendar_url}")
    if calendar_attachment:
        lines.append("- Apple Calendar: an .ics invite is attached to this message.")
    lines.append(f"Need to adjust anything? Reply to {booking_contact_email} and our team will help.")
    lines.append("If you don’t see this email, check spam or promotions folders so the confirmation and invites don’t slip through.")
    text = "\n".join(lines)

    detail_rows: list[str] = []

    def _detail_row(label: str, value: str | None, *, link_text: str | None = None):
        if not value:
            return
        rendered_value = escape(value)
        if link_text:
            rendered_value = f'<a href="{escape(value)}" style="color:#0f172a;text-decoration:none;">{escape(link_text)}</a>'
        detail_rows.append(
            f"<tr>"
            f"<td style=\"padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;white-space:nowrap;\">{escape(label)}</td>"
            f"<td style=\"padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#0f172a;font-weight:600;font-size:14px;\">{rendered_value}</td>"
            f"</tr>"
        )

    _detail_row("Reference", reference)
    _detail_row("Appointment", f"{scheduled_label} ({duration_label})")
    _detail_row("Studio address", studio_location)
    _detail_row("Service", service_name)
    _detail_row("Payment", f"{payment_label} ({_format_currency(charge_amount_cents, payment_currency)})")
    if session_price_cents:
        _detail_row("Service price", _format_currency(session_price_cents, payment_currency))
    if appointment.client_description:
        _detail_row("Notes", appointment.client_description)
    if receipt_url:
        _detail_row("Receipt", receipt_url, link_text="View receipt")
    _detail_row("Manage", manage_url, link_text="Open your portal")
    if confirmation_url:
        _detail_row("View confirmation", confirmation_url, link_text="Open confirmation")

    detail_table = "".join(detail_rows)
    logo_markup = (
        f"<img src=\"{escape(logo_url)}\" alt=\"{escape(brand)} logo\" style=\"height:60px;display:block;margin:0 auto 12px auto;\">"
        if logo_url
        else f"<div style=\"color:#ffffff;font-size:16px;font-weight:700;letter-spacing:0.5px;\">{escape(brand)}</div>"
    )
    manage_button = (
        f"<a href=\"{manage_url}\" style=\"display:inline-block;padding:12px 18px;background-color:#0b0b0b;color:#ffffff;"
        f"text-decoration:none;border-radius:8px;font-weight:600;\">Open booking portal</a>"
    )
    calendar_actions_html = ""
    if google_calendar_url or apple_calendar_data_uri:
        action_buttons: list[str] = []
        if google_calendar_url:
            action_buttons.append(
                f"<a href=\"{escape(google_calendar_url)}\" target=\"_blank\" rel=\"noreferrer\" "
                "style=\"display:inline-flex;align-items:center;gap:6px;padding:10px 14px;background-color:#e5e7eb;"
                "border-radius:8px;font-weight:600;color:#0f172a;text-decoration:none;font-size:13px;\">"
                "Add to Google Calendar</a>"
            )
        if apple_calendar_data_uri:
            action_buttons.append(
                f"<a href=\"{escape(apple_calendar_data_uri)}\" download=\"booking.ics\" "
                "style=\"display:inline-flex;align-items:center;gap:6px;padding:10px 14px;border:1px solid #d1d5db;"
                "border-radius:8px;font-weight:600;color:#0f172a;text-decoration:none;font-size:13px;\">"
                "Download Apple Calendar</a>"
            )
        calendar_actions_html = (
            "<div style=\"margin-top:18px;\">"
            "<p style=\"margin:0 0 8px 0;color:#6b7280;font-size:12px;letter-spacing:0.2em;\">Add to your calendar</p>"
            "<div style=\"display:flex;gap:8px;flex-wrap:wrap;\">"
            f"{''.join(action_buttons)}"
            "</div>"
            "<p style=\"margin:8px 0 0 0;color:#6b7280;font-size:12px;\">Apple Calendar invite attached as an .ics file.</p>"
            "</div>"
        )

    html = (
        "<table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" "
        "style=\"width:100%;background-color:#f5f7fb;padding:32px 0;\">"
        "<tr><td align=\"center\">"
        "<table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" "
        "style=\"width:640px;max-width:92%;background-color:#ffffff;border-radius:16px;overflow:hidden;"
        "box-shadow:0 10px 45px rgba(0,0,0,0.08);\">"
        "<tr>"
        f"<td style=\"padding:28px 32px 20px 32px;background-color:#0b0b0b;text-align:center;\">"
        f"{logo_markup}"
        "<div style=\"color:#ffffff;font-size:18px;font-weight:700;\">Booking confirmed</div>"
        f"<div style=\"color:#d1d5db;font-size:13px;margin-top:6px;\">Reference {escape(reference)}</div>"
        "</td>"
        "</tr>"
        "<tr>"
        "<td style=\"padding:28px 32px;color:#0f172a;font-size:15px;line-height:1.6;\">"
        f"<p style=\"margin:0 0 12px 0;\">Hi {escape(appointment.contact_name or 'there')},</p>"
        f"<p style=\"margin:0 0 18px 0;\">Thank you for booking with {escape(brand)}. "
        "Your appointment is confirmed. Here are the details:</p>"
        "<table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" "
        "style=\"width:100%;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;\">"
        f"{detail_table}"
        "</table>"
        "<div style=\"text-align:center;margin-top:18px;\">"
        f"<p style=\"margin:0 0 8px 0;color:#0f172a;font-size:14px;letter-spacing:0.2em;\">"
        f"Need to make a change? Reply to <a href=\"mailto:{escape(booking_contact_email)}\" "
        "style=\"color:#0f172a;text-decoration:underline;\">"
        f"{escape(booking_contact_email)}</a> and our team will help."
        "</p>"
        f"<div style=\"margin:0 auto;width:max-content;\">{manage_button}</div>"
        "</div>"
        f"{f'<p style=\"margin:12px 0 0 0;color:#6b7280;font-size:13px;\">View or revisit this confirmation <a href=\"{escape(confirmation_url)}\" style=\"color:#0f172a;text-decoration:underline;\">online</a> with the reference and email you used.</p>' if confirmation_url else ''}"
        f"{calendar_actions_html}"
        "</td>"
        "</tr>"
        "</table>"
        "</td></tr>"
        "</table>"
    )

    html_document = f"<!DOCTYPE html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"></head><body>{html}</body></html>"

    attachments = (calendar_attachment,) if calendar_attachment else None
    return mailgun_send(
        to=recipient,
        subject=subject,
        text=text,
        html=html_document,
        tags=("appointments", "confirmation"),
        attachments=attachments,
    )
