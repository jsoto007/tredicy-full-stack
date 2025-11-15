"""Standalone script for populating demo data."""

from datetime import datetime, timedelta

from app import create_app, db
from app.models import (
    AccountActivationToken,
    AdminAccount,
    AdminActivityLog,
    AppointmentAsset,
    AppointmentPayment,
    ClientAccount,
    ClientDocument,
    Consultation,
    GalleryItem,
    SessionOption,
    SystemSetting,
    StudioAvailabilityBlock,
    StudioClosure,
    StudioWorkingHour,
    TattooAppointment,
    TattooCategory,
    Testimonial,
    UserNotification,
)

PRIMARY_ADMIN = {
    "name": "Artem Blackwork",
    "email": "artem@blackworknyc.com",
    "password": "Aguacate@@1",
}

DEMO_USER = {
    "first_name": "River",
    "last_name": "Day",
    "email": "river@blackworknyc.com",
    "phone": "+1-917-555-0147",
    "password": "RiverPass2024!",
}

BOOKING_FEE_SETTING_KEY = "booking_fee_percent"
DEFAULT_BOOKING_FEE_PERCENT = 20


def clear_existing_data():
    """Completely wipe known tables so the seed always replaces the data."""
    models_in_order = [
        AppointmentAsset,
        AppointmentPayment,
        TattooAppointment,
        GalleryItem,
        AdminActivityLog,
        UserNotification,
        Consultation,
        ClientDocument,
        AccountActivationToken,
        StudioAvailabilityBlock,
        SessionOption,
        SystemSetting,
        TattooCategory,
        ClientAccount,
        AdminAccount,
        StudioClosure,
        StudioWorkingHour,
    ]

    for model in models_in_order:
        db.session.query(model).delete(synchronize_session=False)

    db.session.flush()


def ensure_admin_account(config):
    admin = AdminAccount.query.filter_by(email=config["email"]).first()
    created = False
    if not admin:
        admin = AdminAccount(
            name=config["name"],
            email=config["email"],
            last_login_at=datetime.utcnow(),
        )
        admin.set_password(config["password"])
        db.session.add(admin)
        db.session.flush()
        created = True
    return admin, created


def ensure_user_account():
    user = ClientAccount.query.filter_by(email=DEMO_USER["email"]).first()
    created = False
    if not user:
        user = ClientAccount(
            first_name=DEMO_USER["first_name"],
            last_name=DEMO_USER["last_name"],
            email=DEMO_USER["email"],
            phone=DEMO_USER["phone"],
            is_guest=False,
            role="user",
            last_login_at=datetime.utcnow(),
        )
        user.set_password(DEMO_USER["password"])
        db.session.add(user)
        db.session.flush()
        created = True
    return user, created


def ensure_categories():
    if TattooCategory.query.count() > 0:
        return False

    db.session.add_all(
        [
            TattooCategory(
                name="Blackwork",
                description="High-contrast monochrome pieces with crisp edges and dense shading.",
            ),
            TattooCategory(
                name="Fine Line",
                description="Delicate lines crafted with steady hands and intentional spacing.",
            ),
            TattooCategory(
                name="Illustrative",
                description="Painterly compositions that feel like framed art.",
            ),
        ]
    )
    db.session.flush()
    return True


def ensure_testimonials():
    if Testimonial.query.count() > 0:
        return False

    db.session.add_all(
        [
            Testimonial(
                name="Mara L.",
                quote="Artem kept the room calm and somehow made a four-hour session feel like a conversation.",
                rating=5,
            ),
            Testimonial(
                name="Devon C.",
                quote="The linework is exacting—no rushed decisions and the result is timeless.",
                rating=5,
            ),
            Testimonial(
                name="Elena V.",
                quote="I came in with a vague idea and left with a piece that feels like me.",
                rating=5,
            ),
        ]
    )
    return True


def ensure_appointment(admin, user):
    if not admin or not user:
        return False

    appointment = TattooAppointment(
        reference_code="ARTEM-SEED-01",
        client=user,
        assigned_admin=admin,
        status="confirmed",
        client_description="Large geometric blackwork piece spanning the outer forearm.",
        scheduled_start=datetime.utcnow() + timedelta(days=18),
        duration_minutes=210,
    )
    db.session.add(appointment)
    db.session.flush()

    db.session.add(
        AppointmentAsset(
            appointment=appointment,
            admin_uploader=admin,
            kind="note",
            note_text="Prepare stencil drafts and confirm the contrast plan with the client on arrival.",
            is_visible_to_client=False,
        )
    )
    return True


def ensure_notifications(user):
    if not user:
        return False

    if UserNotification.query.filter_by(user_id=user.id).count() > 0:
        return False

    db.session.add_all(
        [
            UserNotification(
                user=user,
                title="Consultation scheduled",
                body="Your consultation is locked in. Review the prep guide ahead of time.",
                category="booking",
            ),
            UserNotification(
                user=user,
                title="Documents reviewed",
                body="ID verification is complete. We are ready for the session.",
                category="documents",
            ),
        ]
    )
    return True


def ensure_admin_activity(admin):
    if not admin:
        return False

    db.session.add_all(
        [
            AdminActivityLog(
                admin=admin,
                action="login",
                details="Admin signed in to confirm today's schedule.",
                ip_address="127.0.0.1",
            ),
            AdminActivityLog(
                admin=admin,
                action="appointment_update",
                details="Double-checked the pending appointment references.",
                ip_address="127.0.0.1",
            ),
        ]
    )
    return True


def ensure_settings():
    if SystemSetting.query.count() > 0:
        return False

    db.session.add_all(
        [
            SystemSetting(
                key="booking_window_days",
                value="60",
                description="Number of days in advance clients can book appointments.",
            ),
            SystemSetting(
                key="notification_email",
                value=PRIMARY_ADMIN["email"],
                description="Address used for outgoing notifications.",
            ),
            SystemSetting(
                key="maintenance_mode",
                value="off",
                description="Toggle system maintenance mode for the public site.",
                is_editable=False,
            ),
            SystemSetting(
                key="studio_hourly_rate_cents",
                value="22000",
                description="Hourly rate charged for tattoo sessions (in cents).",
            ),
            SystemSetting(
                key=BOOKING_FEE_SETTING_KEY,
                value=str(DEFAULT_BOOKING_FEE_PERCENT),
                description="Default booking fee percentage collected during reservations.",
            ),
        ]
    )
    return True


def ensure_session_options():
    if SessionOption.query.count() > 0:
        return False

    options = [
        {"name": "One-hour intro", "duration_minutes": 60, "price_cents": 11000},
        {"name": "Two-hour focus", "duration_minutes": 120, "price_cents": 19000},
        {"name": "Three-hour deep", "duration_minutes": 180, "price_cents": 26000},
    ]
    for entry in options:
        db.session.add(SessionOption(**entry))
    return True


def seed_demo_data():
    clear_existing_data()

    owner_admin, _ = ensure_admin_account(PRIMARY_ADMIN)
    user, _ = ensure_user_account()

    ensure_categories()
    ensure_testimonials()
    ensure_appointment(owner_admin, user)
    ensure_notifications(user)
    ensure_admin_activity(owner_admin)
    ensure_settings()
    ensure_session_options()

    db.session.commit()
    return True


def main():
    app = create_app()
    with app.app_context():
        db.create_all()
        if seed_demo_data():
            print("Seed data reset and populated successfully.")
        else:
            print("No changes were necessary while seeding data.")


if __name__ == "__main__":
    main()
