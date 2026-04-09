from typing import Optional, Sequence, Tuple, Union

import requests
from urllib.parse import urlsplit

from flask import current_app, request

DEFAULT_BRAND_NAME = "Black Work NYC"


def brand_name() -> str:
    configured = (current_app.config.get("BRAND_NAME") or "").strip()
    return configured or DEFAULT_BRAND_NAME


from typing import Optional
def email_logo_url() -> Optional[str]:
    raw_url = (current_app.config.get("EMAIL_LOGO_URL") or "").strip()
    if not raw_url:
        return None
    parsed = urlsplit(raw_url)
    if parsed.scheme and parsed.netloc:
        return raw_url
    current_app.logger.warning("EMAIL_LOGO_URL must be an absolute URL; ignoring %r.", raw_url)
    return None


def client_base_url() -> str:
    base_url = current_app.config.get("CLIENT_BASE_URL")
    if base_url:
        return base_url.rstrip("/")
    return (request.url_root or "").rstrip("/")


def mailgun_send(
    *,
    to: str,
    subject: str,
    text: str,
    html: str | None = None,
    tags: tuple[str, ...] = (),
    attachments: Optional[Sequence[Tuple[str, Union[str, bytes], str]]] = None,
) -> bool:
    domain = current_app.config.get("MAILGUN_DOMAIN")
    api_key = current_app.config.get("MAILGUN_API_KEY")
    if not domain or not api_key:
        current_app.logger.warning("Mailgun configuration missing; cannot send email.")
        return False
    from_address = current_app.config.get("MAILGUN_FROM") or f"no-reply@{domain}"
    data = {
        "from": from_address,
        "to": to,
        "subject": subject,
        "text": text,
    }
    if html:
        data["html"] = html
    if tags:
        data["o:tag"] = list(tags)
    files = []
    if attachments:
        for filename, content, content_type in attachments:
            files.append(("attachment", (filename, content, content_type)))
    try:
        response = requests.post(
            f"https://api.mailgun.net/v3/{domain}/messages",
            auth=("api", api_key),
            data=data,
            files=files or None,
            timeout=10,
        )
    except requests.RequestException as exc:
        current_app.logger.error("Unable to send email via Mailgun: %s", exc)
        return False
    if not response.ok:
        current_app.logger.error("Mailgun request failed: %s", response.text)
        return False
    return True
