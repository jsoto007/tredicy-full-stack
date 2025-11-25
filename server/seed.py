"""Standalone script for populating demo data."""

import os
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

REAL_APPOINTMENTS = [
    {
        "appointment_id": 1574976527,
        "first_name": "Dave",
        "last_name": "Walsh",
        "phone": "2032477033",
        "email": "davewalsh589@gmail.com",
        "appointment_type": "Consultation",
        "appointment_price": 0.0,
        "paid": False,
        "amount_paid_online": 0.0,
        "notes": "",
        "start": "November 26, 2025 5:00 pm",
        "end": "November 26, 2025 5:30 pm",
        "timezone": "America/New_York",
        "calendar": "Artem @blackworknyc",
        "certificate_code": "",
        "date_scheduled": "2025-11-17",
        "label": "",
        "scheduled_by": "blackworknyc@gmail.com via Mobile App",
        "date_rescheduled": "2025-11-24",
    },
    {
        "appointment_id": 1575682263,
        "first_name": "Yana",
        "last_name": "Kanatyeva",
        "phone": "+16468811292",
        "email": "yanakanatyeva@gmail.com",
        "appointment_type": "Quick tattoo session 🚀",
        "appointment_price": 750.0,
        "paid": True,
        "amount_paid_online": 150.0,
        "notes": "",
        "start": "November 28, 2025 2:00 pm",
        "end": "November 28, 2025 5:00 pm",
        "timezone": "America/New_York",
        "calendar": "Artem @blackworknyc",
        "certificate_code": "",
        "date_scheduled": "2025-11-18",
        "label": "",
        "scheduled_by": "a client",
        "date_rescheduled": "",
    },
    {
        "appointment_id": 1579269953,
        "first_name": "Renita",
        "last_name": "Madhoo",
        "phone": "+19177940315",
        "email": "renitamadhoo1995@gmail.com",
        "appointment_type": "Consultation",
        "appointment_price": 0.0,
        "paid": False,
        "amount_paid_online": 0.0,
        "notes": "",
        "start": "November 29, 2025 1:00 pm",
        "end": "November 29, 2025 1:30 pm",
        "timezone": "America/New_York",
        "calendar": "Artem @blackworknyc",
        "certificate_code": "",
        "date_scheduled": "2025-11-24",
        "label": "",
        "scheduled_by": "blackworknyc@gmail.com via Mobile App",
        "date_rescheduled": "2025-11-24",
    },
    {
        "appointment_id": 1579768629,
        "first_name": "Donna",
        "last_name": "Bandiola",
        "phone": "+18138168904",
        "email": "donnafebandiola@gmail.com",
        "appointment_type": "Quick tattoo session 🚀",
        "appointment_price": 750.0,
        "paid": True,
        "amount_paid_online": 150.0,
        "notes": "",
        "start": "November 30, 2025 2:00 pm",
        "end": "November 30, 2025 5:00 pm",
        "timezone": "America/New_York",
        "calendar": "Artem @blackworknyc",
        "certificate_code": "",
        "date_scheduled": "2025-11-24",
        "label": "",
        "scheduled_by": "a client",
        "date_rescheduled": "",
    },
    {
        "appointment_id": 1579232348,
        "first_name": "Agnes",
        "last_name": "Romero",
        "phone": "+12124442711",
        "email": "agnes.romero90@gmail.com",
        "appointment_type": "Consultation",
        "appointment_price": 0.0,
        "paid": False,
        "amount_paid_online": 0.0,
        "notes": "",
        "start": "December 2, 2025 12:00 pm",
        "end": "December 2, 2025 12:30 pm",
        "timezone": "America/New_York",
        "calendar": "Artem @blackworknyc",
        "certificate_code": "",
        "date_scheduled": "2025-11-24",
        "label": "",
        "scheduled_by": "a client",
        "date_rescheduled": "",
    },
    {
        "appointment_id": 1560195933,
        "first_name": "Cris",
        "last_name": "Cooper",
        "phone": "",
        "email": "Ccooper72111@gmail.com",
        "appointment_type": "Tattoo session",
        "appointment_price": 350.0,
        "paid": False,
        "amount_paid_online": 0.0,
        "notes": "$150 deposit, $500 total. Pet portrait.",
        "start": "December 2, 2025 3:00 pm",
        "end": "December 2, 2025 4:00 pm",
        "timezone": "America/New_York",
        "calendar": "Artem @blackworknyc",
        "certificate_code": "",
        "date_scheduled": "2025-10-22",
        "label": "",
        "scheduled_by": "blackworknyc@gmail.com via Mobile App",
        "date_rescheduled": "",
    },
    {
        "appointment_id": 1572512245,
        "first_name": "Mike",
        "last_name": "Spinner",
        "phone": "+15164594518",
        "email": "michaelrspinner@gmail.com",
        "appointment_type": "Consultation",
        "appointment_price": 0.0,
        "paid": False,
        "amount_paid_online": 0.0,
        "notes": "",
        "start": "December 3, 2025 11:00 am",
        "end": "December 3, 2025 11:30 am",
        "timezone": "America/New_York",
        "calendar": "Artem @blackworknyc",
        "certificate_code": "",
        "date_scheduled": "2025-11-13",
        "label": "",
        "scheduled_by": "a client",
        "date_rescheduled": "2025-11-24",
    },
    {
        "appointment_id": 1578066269,
        "first_name": "Samuel",
        "last_name": "Stan",
        "phone": "+14417040488",
        "email": "sam.r.stan@gmail.com",
        "appointment_type": "Full day session",
        "appointment_price": 2500.0,
        "paid": True,
        "amount_paid_online": 500.0,
        "notes": "",
        "start": "December 3, 2025 12:00 pm",
        "end": "December 3, 2025 8:00 pm",
        "timezone": "America/New_York",
        "calendar": "Artem @blackworknyc",
        "certificate_code": "",
        "date_scheduled": "2025-11-21",
        "label": "",
        "scheduled_by": "a client",
        "date_rescheduled": "",
    },
    {
        "appointment_id": 1563222526,
        "first_name": "Nathan",
        "last_name": "Lesch",
        "phone": "+13157303757",
        "email": "nlesch18@gmail.com",
        "appointment_type": "Consultation",
        "appointment_price": 0.0,
        "paid": False,
        "amount_paid_online": 0.0,
        "notes": "Touch up leaves",
        "start": "December 5, 2025 6:30 pm",
        "end": "December 5, 2025 7:00 pm",
        "timezone": "America/New_York",
        "calendar": "Artem @blackworknyc",
        "certificate_code": "",
        "date_scheduled": "2025-10-28",
        "label": "",
        "scheduled_by": "blackworknyc@gmail.com via Mobile App",
        "date_rescheduled": "",
    },
    {
        "appointment_id": 1561817051,
        "first_name": "Michael",
        "last_name": "Kelly",
        "phone": "+15166726604",
        "email": "michaelkelly2113@gmail.com",
        "appointment_type": "Full day session",
        "appointment_price": 2500.0,
        "paid": True,
        "amount_paid_online": 500.0,
        "notes": "",
        "start": "December 10, 2025 12:00 pm",
        "end": "December 10, 2025 8:00 pm",
        "timezone": "America/New_York",
        "calendar": "Artem @blackworknyc",
        "certificate_code": "",
        "date_scheduled": "2025-10-25",
        "label": "",
        "scheduled_by": "a client",
        "date_rescheduled": "",
    },
    {
        "appointment_id": 1570780498,
        "first_name": "Rafal",
        "last_name": "Walendzik",
        "phone": "+17187536430",
        "email": "walendzikr1@gmail.com",
        "appointment_type": "Quick tattoo session 🚀",
        "appointment_price": 750.0,
        "paid": False,
        "amount_paid_online": 0.0,
        "notes": "150 deposit. Right upper arm.",
        "start": "January 18, 2026 12:00 pm",
        "end": "January 18, 2026 3:00 pm",
        "timezone": "America/New_York",
        "calendar": "Artem @blackworknyc",
        "certificate_code": "",
        "date_scheduled": "2025-11-10",
        "label": "",
        "scheduled_by": "blackworknyc@gmail.com via Mobile App",
        "date_rescheduled": "",
    },
    {
        "appointment_id": 1543224899,
        "first_name": "Le Anh",
        "last_name": "Vu",
        "phone": "+19177929902",
        "email": "leanh.vu14@gmail.com",
        "appointment_type": "Quick tattoo session 🚀",
        "appointment_price": 750.0,
        "paid": False,
        "amount_paid_online": 0.0,
        "notes": "150 deposit. Left leg. Bonsai fudo",
        "start": "January 20, 2026 1:00 pm",
        "end": "January 20, 2026 4:00 pm",
        "timezone": "America/New_York",
        "calendar": "Artem @blackworknyc",
        "certificate_code": "",
        "date_scheduled": "2025-09-22",
        "label": "",
        "scheduled_by": "blackworknyc@gmail.com via Mobile App",
        "date_rescheduled": "2025-10-13",
    },
    {
        "appointment_id": 1575524112,
        "first_name": "Nathan",
        "last_name": "Pierre",
        "phone": "+19083910604",
        "email": "npierre70@gmail.com",
        "appointment_type": "Half day session",
        "appointment_price": 1250.0,
        "paid": False,
        "amount_paid_online": 0.0,
        "notes": "250 deposit. Right chest cross and dove w text.",
        "start": "February 7, 2026 2:00 pm",
        "end": "February 7, 2026 6:00 pm",
        "timezone": "America/New_York",
        "calendar": "Artem @blackworknyc",
        "certificate_code": "",
        "date_scheduled": "2025-11-18",
        "label": "",
        "scheduled_by": "blackworknyc@gmail.com via Mobile App",
        "date_rescheduled": "",
    },
]

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

    existing = TattooAppointment.query.filter_by(reference_code="ARTEM-SEED-01").first()
    if existing:
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




# Seed real appointments from the embedded schedule data.
def seed_real_appointments(admin):
    """Seed real appointments from the embedded schedule data.

    This does NOT wipe existing data and is safe to run multiple times. It
    uses reference codes of the form REAL-<Appointment ID> to stay idempotent.
    """
    if not admin:
        return False

    created_any = False

    for data in REAL_APPOINTMENTS:
        raw_email = (data.get("email") or "").strip()
        email = raw_email or f"guest-{data['appointment_id']}@placeholder.invalid"

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

        reference_code = f"REAL-{data['appointment_id']}"
        existing_appointment = TattooAppointment.query.filter_by(
            reference_code=reference_code
        ).first()
        if existing_appointment:
            # Already imported
            continue

        start = datetime.strptime(data["start"], "%B %d, %Y %I:%M %p")
        end = datetime.strptime(data["end"], "%B %d, %Y %I:%M %p")
        duration_minutes = int((end - start).total_seconds() // 60)

        appointment = TattooAppointment(
            reference_code=reference_code,
            client=client,
            assigned_admin=admin,
            status="confirmed" if data["paid"] else "pending",
            client_description=data["appointment_type"],
            scheduled_start=start,
            duration_minutes=duration_minutes,
            contact_name=f"{data['first_name']} {data['last_name']}".strip(),
            contact_email=raw_email or None,
            contact_phone=(data.get("phone") or "").strip() or None,
        )
        db.session.add(appointment)

        note_lines = []

        base_note = (data.get("notes") or "").strip()
        if base_note:
            note_lines.append(base_note)

        if data.get("appointment_price") is not None:
            note_lines.append(
                f"Appointment price: ${data['appointment_price']:,.2f}"
            )
        if data.get("amount_paid_online") is not None:
            note_lines.append(
                f"Amount paid online: ${data['amount_paid_online']:,.2f}"
            )
        note_lines.append(f"Paid (source): {'yes' if data.get('paid') else 'no'}")

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
                AppointmentAsset(
                    appointment=appointment,
                    admin_uploader=admin,
                    kind="note",
                    note_text="\n".join(note_lines),
                    is_visible_to_client=False,
                )
            )

        if data.get("amount_paid_online"):
            db.session.add(
                AppointmentPayment(
                    appointment=appointment,
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
        print("Seeded real appointments from embedded schedule.")
    else:
        print("No new real appointments were added from embedded schedule.")
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
    # Only wipe data if explicitly requested via environment variable.
    reset_requested = os.getenv("SEED_RESET", "").lower() == "true"
    if reset_requested:
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
    seed_real_appointments(owner_admin)

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
