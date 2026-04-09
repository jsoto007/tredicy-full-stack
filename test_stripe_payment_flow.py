import json
import sys
from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest

sys.path.insert(0, "./server")

from app import create_app
from app.config import db
from app.models import ReservationPayment, SessionOption, RestaurantReservation


class FakeStripeObject(dict):
    def __getattr__(self, key):
        try:
            return self[key]
        except KeyError as exc:
            raise AttributeError(key) from exc


@pytest.fixture()
def app(monkeypatch):
    monkeypatch.setenv("DATABASE_URI", "sqlite+pysqlite:///:memory:")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_123")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_test_123")

    app = create_app()
    app.config.update(TESTING=True, WTF_CSRF_ENABLED=False)

    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


def _create_reservation(status="awaiting_payment", payment_status="pending", provider_payment_id="cs_test_123"):
    session_option = SessionOption(name="Test service", duration_minutes=60, price_cents=100)
    reservation = RestaurantReservation(
        reference_code="TEST-123",
        contact_name="Test Customer",
        contact_email="test@example.com",
        contact_phone="5555555555",
        client_description="Test order",
        status=status,
        duration_minutes=60,
        session_option=session_option,
    )
    payment = ReservationPayment(
        reservation=reservation,
        provider="stripe",
        provider_payment_id=provider_payment_id,
        status=payment_status,
        amount_cents=95,
        currency="USD",
        note="Stripe Checkout payment",
    )
    db.session.add_all([session_option, reservation, payment])
    db.session.commit()
    return reservation


def _set_csrf(client):
    with client.session_transaction() as session_state:
        session_state["csrf_token"] = "csrf-token"
    return {"X-CSRF-Token": "csrf-token"}


def test_verify_session_accepts_succeeded_payment_intent_before_checkout_status_updates(app, client, monkeypatch):
    with app.app_context():
        reservation = _create_reservation()
        reservation_id = reservation.id

    fake_checkout = {
        "id": "cs_test_123",
        "client_reference_id": str(reservation_id),
        "payment_status": "unpaid",
        "status": "complete",
        "payment_intent": "pi_test_123",
        "amount_total": 95,
        "currency": "usd",
    }
    fake_payment_intent = FakeStripeObject(
        status="succeeded",
        charges=SimpleNamespace(data=[SimpleNamespace(receipt_url="https://stripe.test/receipt")]),
    )

    monkeypatch.setattr("app.routes.stripe.checkout.Session.retrieve", lambda session_id: fake_checkout)
    monkeypatch.setattr("app.routes.stripe.PaymentIntent.retrieve", lambda payment_intent_id: fake_payment_intent)
    monkeypatch.setattr("app.routes.send_booking_confirmation_email", lambda *args, **kwargs: True)
    monkeypatch.setattr("app.routes.send_internal_booking_notification", lambda *args, **kwargs: True)

    response = client.post(
        "/api/payments/stripe/verify-session",
        json={"reservation_id": reservation_id, "session_id": "cs_test_123"},
        headers=_set_csrf(client),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["status"] == "pending"
    assert payload["payments"][0]["status"] == "paid"


def test_stripe_webhook_finalizes_payment_once(app, client, monkeypatch):
    notifications = {"client": 0, "internal": 0}

    with app.app_context():
        reservation = _create_reservation()
        reservation_id = reservation.id

    fake_event = {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test_123",
                "client_reference_id": str(reservation_id),
                "payment_status": "paid",
                "status": "complete",
                "payment_intent": "pi_test_123",
                "amount_total": 95,
                "currency": "usd",
                "metadata": {"reservation_id": str(reservation_id)},
            }
        },
    }
    fake_payment_intent = FakeStripeObject(
        status="succeeded",
        charges=SimpleNamespace(data=[SimpleNamespace(receipt_url="https://stripe.test/receipt")]),
    )

    monkeypatch.setattr("app.routes.stripe.Webhook.construct_event", lambda payload, sig, secret: fake_event)
    monkeypatch.setattr("app.routes.stripe.PaymentIntent.retrieve", lambda payment_intent_id: fake_payment_intent)
    monkeypatch.setattr(
        "app.routes.send_booking_confirmation_email",
        lambda *args, **kwargs: notifications.__setitem__("client", notifications["client"] + 1) or True,
    )
    monkeypatch.setattr(
        "app.routes.send_internal_booking_notification",
        lambda *args, **kwargs: notifications.__setitem__("internal", notifications["internal"] + 1) or True,
    )

    for _ in range(2):
        response = client.post(
            "/api/payments/stripe/webhook",
            data=json.dumps(fake_event),
            content_type="application/json",
            headers={"Stripe-Signature": "t=1,v1=test"},
        )
        assert response.status_code == 200

    with app.app_context():
        reservation = RestaurantReservation.query.get(reservation_id)
        assert reservation.status == "pending"
        assert reservation.payments[0].status == "paid"

    assert notifications["client"] == 1
    assert notifications["internal"] == 1


def test_verify_session_marks_failed_payment_as_not_booked(app, client, monkeypatch):
    with app.app_context():
        reservation = _create_reservation()
        reservation_id = reservation.id

    fake_checkout = {
        "id": "cs_test_123",
        "client_reference_id": str(reservation_id),
        "payment_status": "unpaid",
        "status": "expired",
        "payment_intent": "pi_test_123",
        "amount_total": 95,
        "currency": "usd",
    }
    fake_payment_intent = FakeStripeObject(status="requires_payment_method", charges=SimpleNamespace(data=[]))

    monkeypatch.setattr("app.routes.stripe.checkout.Session.retrieve", lambda session_id: fake_checkout)
    monkeypatch.setattr("app.routes.stripe.PaymentIntent.retrieve", lambda payment_intent_id: fake_payment_intent)

    response = client.post(
        "/api/payments/stripe/verify-session",
        json={"reservation_id": reservation_id, "session_id": "cs_test_123"},
        headers=_set_csrf(client),
    )

    assert response.status_code == 400

    with app.app_context():
        reservation = RestaurantReservation.query.get(reservation_id)
        assert reservation.status == "payment_expired"
        assert reservation.payments[0].status == "failed"


def test_stale_awaiting_payment_hold_does_not_block_availability(app):
    from app.routes import collect_blocked_intervals

    with app.app_context():
        reservation = _create_reservation()
        reservation.scheduled_start = datetime.utcnow() + timedelta(days=1)
        reservation.created_at = datetime.utcnow() - timedelta(hours=2)
        reservation.updated_at = reservation.created_at
        db.session.commit()

        day_start = reservation.scheduled_start.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        intervals = collect_blocked_intervals(day_start, day_end)

        assert intervals == []
