"""Standalone script for rebuilding and populating restaurant demo data."""

import os
from datetime import datetime, timedelta

from sqlalchemy.exc import OperationalError

from app import create_app, db
from app.models import (
    AccountActivationToken,
    AdminAccount,
    AdminActivityLog,
    ReservationAsset,
    ReservationPayment,
    ClientAccount,
    ClientDocument,
    Consultation,
    DailySpecialItem,
    DailySpecialSection,
    GalleryItem,
    MenuCategory,
    MenuItem,
    SessionOption,
    SystemSetting,
    StudioAvailabilityBlock,
    StudioClosure,
    StudioWorkingHour,
    RestaurantReservation,
    GalleryCategory,
    Testimonial,
    UserNotification,
)
from seed_menu import MENU, SPECIALS

PRIMARY_ADMIN = {
    "name": "Giovanni Rossi",
    "email": "giovanni@tredicisocial.com",
    "password": "Aguacate@@1",
}

DEMO_USER = {
    "first_name": "Demo",
    "last_name": "Diner",
    "email": "demo@tredicisocial.local",
    "phone": "+1-555-555-0147",
    "password": "DemoPassword2024!",
}


REAL_APPOINTMENTS = [
]

BOOKING_FEE_SETTING_KEY = "booking_fee_percent"
DEFAULT_BOOKING_FEE_PERCENT = 20


def _env_flag(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}


def _is_production_like() -> bool:
    env_value = (
        os.getenv("APP_ENV", "")
        or os.getenv("FLASK_ENV", "")
        or os.getenv("ENV", "")
    ).strip().lower()
    return env_value == "production"


def _destructive_reset_allowed() -> bool:
    return _env_flag("ALLOW_DESTRUCTIVE_RESET")


def _schema_rebuild_requested() -> bool:
    return _env_flag("SEED_REBUILD") or _env_flag("SEED_RECREATE_SCHEMA")


def clear_existing_data():
    """Completely wipe known tables so the seed always replaces the data."""
    models_in_order = [
        ReservationAsset,
        ReservationPayment,
        RestaurantReservation,
        GalleryItem,
        AdminActivityLog,
        UserNotification,
        Consultation,
        ClientDocument,
        AccountActivationToken,
        StudioAvailabilityBlock,
        SessionOption,
        SystemSetting,
        GalleryCategory,
        ClientAccount,
        AdminAccount,
        StudioClosure,
        StudioWorkingHour,
        DailySpecialItem,
        DailySpecialSection,
        MenuItem,
        MenuCategory,
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
    if GalleryCategory.query.count() > 0:
        return False

    db.session.add_all(
        [
            GalleryCategory(
                name="Dining Room",
                description="Main dining room photography and guest table styling.",
            ),
            GalleryCategory(
                name="Bar & Cocktails",
                description="Signature drinks, bar detail shots, and evening ambiance.",
            ),
            GalleryCategory(
                name="Private Events",
                description="Private dining, chef's table, and special occasion imagery.",
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
                name="Maria G.",
                quote="The dinner service was polished, the pacing was perfect, and every plate arrived exactly as described.",
                rating=5,
            ),
            Testimonial(
                name="Ana L.",
                quote="The menu felt thoughtful and seasonal, and the staff made the whole evening feel effortless.",
                rating=5,
            ),
        ]
    )
    return True


def ensure_reservation(admin, user):
    if not admin or not user:
        return False

    existing = RestaurantReservation.query.filter_by(reference_code="TREDICI-SEED-01").first()
    if existing:
        return False

    reservation = RestaurantReservation(
        reference_code="TREDICI-SEED-01",
        client=user,
        assigned_admin=admin,
        status="confirmed",
        client_description="Dinner reservation for two with patio seating request",
        scheduled_start=datetime.utcnow() + timedelta(days=18),
        duration_minutes=90,
    )
    db.session.add(reservation)
    db.session.flush()

    db.session.add(
        ReservationAsset(
            reservation=reservation,
            admin_uploader=admin,
            kind="note",
            note_text="Confirm patio seating and note any dietary preferences before service.",
            is_visible_to_client=False,
        )
    )
    return True




# Seed real reservations from the embedded schedule data.
def seed_real_reservations(admin):
    """Seed real reservations from the embedded schedule data.

    This does NOT wipe existing data and is safe to run multiple times. It
    uses reference codes of the form REAL-<Reservation ID> to stay idempotent.
    """
    if not admin:
        return False

    created_any = False
    skipped_incomplete = 0
    skipped_invalid = 0

    for data in REAL_APPOINTMENTS:
        start_str = (data.get("start") or "").strip()
        end_str = (data.get("end") or "").strip()

        # Some leads never picked a time; skip those instead of crashing.
        if not start_str or not end_str:
            skipped_incomplete += 1
            continue

        try:
            start = datetime.strptime(start_str, "%B %d, %Y %I:%M %p")
            end = datetime.strptime(end_str, "%B %d, %Y %I:%M %p")
        except ValueError:
            skipped_invalid += 1
            continue

        raw_email = (data.get("email") or "").strip()
        email = raw_email or f"guest-{data['reservation_id']}@placeholder.invalid"

        client = ClientAccount.query.filter_by(email=email).first()
        if not client:
            client = ClientAccount(
                first_name=data["first_name"],
                last_name=data["last_name"],
                email=email,
                phone=data["phone"],
                is_guest=True,
                role="client",
            )
            db.session.add(client)
            db.session.flush()
            created_any = True

        reference_code = f"REAL-{data['reservation_id']}"
        existing_reservation = RestaurantReservation.query.filter_by(
            reference_code=reference_code
        ).first()
        if existing_reservation:
            # Already imported
            continue

        duration_minutes = int((end - start).total_seconds() // 60)

        reservation = RestaurantReservation(
            reference_code=reference_code,
            client=client,
            assigned_admin=admin,
            status="confirmed" if data["paid"] else "pending",
            client_description=data["reservation_type"],
            scheduled_start=start,
            duration_minutes=duration_minutes,
            contact_name=f"{data['first_name']} {data['last_name']}".strip(),
            contact_email=raw_email or None,
            contact_phone=(data.get("phone") or "").strip() or None,
        )
        db.session.add(reservation)

        note_lines = []

        base_note = (data.get("notes") or "").strip()
        if base_note:
            note_lines.append(base_note)

        if data.get("reservation_price") is not None:
            note_lines.append(
                f"Reservation total: ${data['reservation_price']:,.2f}"
            )
        if data.get("amount_paid_online") is not None:
            note_lines.append(
                f"Deposit paid online: ${data['amount_paid_online']:,.2f}"
            )
        note_lines.append(f"Paid online: {'yes' if data.get('paid') else 'no'}")

        extra_fields = [
            ("Timezone", data.get("timezone")),
            ("Calendar", data.get("calendar")),
            ("Certificate code", data.get("certificate_code")),
            ("Date scheduled", data.get("date_scheduled")),
            ("Label", data.get("label")),
            ("Scheduled by", data.get("scheduled_by")),
            ("Date rescheduled", data.get("date_rescheduled")),
        ]
        for label, value in extra_fields:
            if value:
                note_lines.append(f"{label}: {value}")

        if note_lines:
            db.session.add(
                ReservationAsset(
                    reservation=reservation,
                    admin_uploader=admin,
                    kind="note",
                    note_text="\n".join(note_lines),
                    is_visible_to_client=False,
                )
            )

        if data.get("amount_paid_online"):
            db.session.add(
                ReservationPayment(
                    reservation=reservation,
                    provider="seed",
                    provider_payment_id=f"SEED-{reference_code}",
                    status="paid" if data.get("paid") else "pending",
                    amount_cents=int(round(float(data["amount_paid_online"]) * 100)),
                    currency="USD",
                    note="Imported payment record from seed data.",
                )
            )
        created_any = True

    if created_any:
        print("Seeded real reservations from embedded schedule.")
    else:
        print("No new real reservations were added from embedded schedule.")
    if skipped_incomplete or skipped_invalid:
        print(
            f"Skipped {skipped_incomplete} incomplete and "
            f"{skipped_invalid} malformed reservations without start/end times."
        )
    return created_any


def ensure_notifications(user):
    if not user:
        return False

    if UserNotification.query.filter_by(user_id=user.id).count() > 0:
        return False

    db.session.add_all(
        [
            UserNotification(
                user=user,
                title="Reservation confirmed",
                body="Your dinner reservation is locked in. Review the menu and arrival details ahead of time.",
                category="booking",
            ),
            UserNotification(
                user=user,
                title="Table details reviewed",
                body="Guest preferences and notes are ready for service.",
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
                details="Host signed in to confirm tonight's reservations.",
                ip_address="127.0.0.1",
            ),
            AdminActivityLog(
                admin=admin,
                action="reservation_update",
                details="Double-checked the pending reservation references.",
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
                description="Number of days in advance guests can book reservations.",
            ),
            SystemSetting(
                key="notification_email",
                value=PRIMARY_ADMIN["email"],
                description="Address used for outgoing reservation notifications.",
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
                description="Legacy pricing control used by the reservation flow (in cents).",
            ),
            SystemSetting(
                key=BOOKING_FEE_SETTING_KEY,
                value=str(DEFAULT_BOOKING_FEE_PERCENT),
                description="Default deposit percentage collected during reservations.",
            ),
        ]
    )
    return True


def ensure_session_options():
    if SessionOption.query.count() > 0:
        return False

    options = [
        {"name": "Early Seating", "duration_minutes": 60, "price_cents": 11000},
        {"name": "Chef's Counter", "duration_minutes": 120, "price_cents": 19000},
        {"name": "Private Dining", "duration_minutes": 180, "price_cents": 26000},
    ]
    for entry in options:
        db.session.add(SessionOption(**entry))
    return True


def ensure_menu():
    import json as _json

    if MenuCategory.query.count() > 0:
        return False

    for cat_data in MENU:
        cat = MenuCategory(
            name=cat_data["category"],
            display_order=cat_data["display_order"],
            is_visible=True,
        )
        db.session.add(cat)
        db.session.flush()

        for i, item_data in enumerate(cat_data["items"]):
            db.session.add(MenuItem(
                category_id=cat.id,
                name=item_data["name"],
                description=item_data.get("description"),
                price_cents=item_data.get("price_cents"),
                tags=_json.dumps(item_data.get("tags", [])),
                display_order=i,
                is_visible=True,
            ))

    for sec_data in SPECIALS:
        section = DailySpecialSection(
            course=sec_data["course"],
            display_order=sec_data["display_order"],
            is_visible=True,
        )
        db.session.add(section)
        db.session.flush()

        for i, item_data in enumerate(sec_data["items"]):
            db.session.add(DailySpecialItem(
                section_id=section.id,
                name=item_data["name"],
                description=item_data.get("description"),
                price_cents=item_data.get("price_cents"),
                display_order=i,
            ))

    return True


def seed_demo_data():
    # Only wipe data if explicitly requested via environment variable.
    reset_requested = _env_flag("SEED_RESET")
    rebuild_schema = _schema_rebuild_requested()
    if (reset_requested or rebuild_schema) and _is_production_like() and not _destructive_reset_allowed():
        print(
            "Refusing to reset or rebuild data because the environment looks like production. "
            "Set ALLOW_DESTRUCTIVE_RESET=true only if you intentionally want to wipe the database."
        )
        reset_requested = False
        rebuild_schema = False

    if reset_requested and not rebuild_schema:
        clear_existing_data()

    owner_admin, _ = ensure_admin_account(PRIMARY_ADMIN)
    user, _ = ensure_user_account()

    ensure_categories()
    ensure_testimonials()
    ensure_reservation(owner_admin, user)
    ensure_notifications(user)
    ensure_admin_activity(owner_admin)
    ensure_settings()
    ensure_session_options()
    ensure_menu()
    seed_real_reservations(owner_admin)

    db.session.commit()
    return True


def main():
    app = create_app()
    with app.app_context():
        rebuild_schema = _schema_rebuild_requested()
        reset_requested = _env_flag("SEED_RESET")
        destructive_requested = reset_requested or rebuild_schema
        if destructive_requested and _is_production_like() and not _destructive_reset_allowed():
            print(
                "Refusing to reset or rebuild data because the environment looks like production. "
                "Set ALLOW_DESTRUCTIVE_RESET=true only if you intentionally want to wipe the database."
            )
            rebuild_schema = False
        try:
            if rebuild_schema:
                db.drop_all()
            db.create_all()
            if seed_demo_data():
                print("Database rebuilt and restaurant seed data populated successfully.")
            else:
                print("No changes were necessary while seeding data.")
        except OperationalError as exc:
            raise RuntimeError(
                "Database connection failed while rebuilding/seeding. "
                "Check DATABASE_URL/DATABASE_URI, confirm it ends in /tredicy_db, "
                "and verify the Render Postgres host is the correct internal or external URL."
            ) from exc


if __name__ == "__main__":
    main()
