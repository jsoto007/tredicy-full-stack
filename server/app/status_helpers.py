from __future__ import annotations

import re

DEFAULT_STATUS_LABEL = "Scheduled"

_STATUS_LABEL_OVERRIDES = {
    "awaiting_payment": "Awaiting payment",
    "pending": "Pending review",
    "confirmed": "Confirmed",
    "completed": "Completed",
    "cancelled": "Cancelled",
    "cancelled_by_client": "Cancelled by client",
    "declined": "Declined",
    "no_show": "No show",
    "payment_failed": "Payment failed",
    "payment_expired": "Payment expired",
}


def format_status_label(status: str | None) -> str:
    """Return a readable label for a restaurant reservation status."""
    if not status:
        return DEFAULT_STATUS_LABEL
    normalized = status.strip().lower()
    if not normalized:
        return DEFAULT_STATUS_LABEL
    override = _STATUS_LABEL_OVERRIDES.get(normalized)
    if override:
        return override
    segments = [segment for segment in re.split(r"[_\s-]+", normalized) if segment]
    if not segments:
        return DEFAULT_STATUS_LABEL
    return " ".join(segment.capitalize() for segment in segments)
