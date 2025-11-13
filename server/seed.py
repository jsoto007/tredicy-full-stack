"""Standalone script for populating demo data."""

from datetime import datetime, timedelta

from app import create_app, db
from app.models import (
    AdminAccount,
    AdminActivityLog,
    AppointmentAsset,
    ClientAccount,
    GalleryItem,
    SystemSetting,
    TattooAppointment,
    TattooCategory,
    Testimonial,
    UserNotification,
)


PRIMARY_ADMIN = {
    "name": "Studio Owner",
    "email": "owner@blackinkdemo.com",
    "password": "OwnerPass123!",
}

MANAGER_ADMIN = {
    "name": "Studio Manager",
    "email": "manager@blackinkdemo.com",
    "password": "ManagerPass123!",
}

DEMO_USER = {
    "first_name": "Jordan",
    "last_name": "Rivera",
    "email": "jordan@example.com",
    "phone": "+1-555-0199",
    "password": "demo1234",
}


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
            TattooCategory(name="Blackwork", description="Bold monochrome work."),
            TattooCategory(name="Fine Line", description="Delicate and minimal line work."),
            TattooCategory(name="Color", description="Rich color-focused pieces."),
        ]
    )
    db.session.flush()
    return True


def ensure_gallery(admin):
    if GalleryItem.query.count() > 0 or not admin:
        return False

    categories = {c.name: c for c in TattooCategory.query.all()}
    items = [
        (
            "Blackwork",
            "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80",
            "Geometric blackwork sleeve covering a forearm (demo)",
        ),
        (
            "Blackwork",
            "https://t4.ftcdn.net/jpg/04/36/10/09/240_F_436100949_TjLhwlstteQuOdiKGNBmmDkGcOhkyqxI.jpg",
            "Black ink fern linework across a shoulder (demo)",
        ),
        (
            "Fine Line",
            "https://images.unsplash.com/photo-1542219550-3828d3afa116?auto=format&fit=crop&w=900&q=80",
            "Fine line wrist tattoo with delicate lettering (demo)",
        ),
        (
            "Fine Line",
            "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80",
            "Minimal constellation linework across a shoulder (demo)",
        ),
        (
            "Color",
            "https://images.unsplash.com/photo-1527694224015-bb4f9eace5f3?auto=format&fit=crop&w=900&q=80",
            "Gradient color tattoo along an upper arm (demo)",
        ),
        (
            "Color",
            "https://images.unsplash.com/photo-1520854221050-0f4caff449fb?auto=format&fit=crop&w=900&q=80",
            "Bold color portrait tattoo on a shoulder (demo)",
        ),
    ]

    gallery_entries = []
    for category_name, image_url, alt in items:
        category = categories.get(category_name)
        if category:
            gallery_entries.append(
                GalleryItem(
                    category=category,
                    uploaded_by=admin,
                    image_url=image_url,
                    alt=alt,
                )
            )

    db.session.add_all(gallery_entries)
    return bool(gallery_entries)


def ensure_testimonials():
    if Testimonial.query.count() > 0:
        return False

    db.session.add_all(
        [
            Testimonial(
                name="Maya R.",
                quote="Every line healed as sharp as day one. Nova kept the session calm and focused. (demo)",
                rating=5,
            ),
            Testimonial(
                name="Devon C.",
                quote="From consult to finish, the process was transparent and intentional. (demo)",
                rating=5,
            ),
            Testimonial(
                name="Elena V.",
                quote="My color piece feels both minimal and rich. I felt heard at every stage. (demo)",
                rating=5,
            ),
        ]
    )
    return True


def ensure_appointment(admin, user):
    if not admin or not user or TattooAppointment.query.count() > 0:
        return False

    appointment = TattooAppointment(
        reference_code="DEMO-APPT-001",
        client=user,
        assigned_admin=admin,
        status="pending",
        client_description="Full forearm blackwork sleeve inspired by geometric patterns.",
        scheduled_start=datetime.utcnow() + timedelta(days=14),
        duration_minutes=180,
    )
    db.session.add(appointment)
    db.session.flush()

    db.session.add_all(
        [
            AppointmentAsset(
                appointment=appointment,
                client_uploader=user,
                kind="id_front",
                file_url="https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80",
                is_visible_to_client=False,
            ),
            AppointmentAsset(
                appointment=appointment,
                client_uploader=user,
                kind="id_back",
                file_url="https://images.unsplash.com/photo-1549921296-3d268e24c81c?auto=format&fit=crop&w=800&q=80",
                is_visible_to_client=False,
            ),
            AppointmentAsset(
                appointment=appointment,
                client_uploader=user,
                kind="inspiration_image",
                file_url="https://images.unsplash.com/photo-1531256456869-ce942a665e80?auto=format&fit=crop&w=800&q=80",
                is_visible_to_client=True,
            ),
            AppointmentAsset(
                appointment=appointment,
                admin_uploader=admin,
                kind="note",
                note_text="Bring stencil drafts and review geometric pattern placement.",
                is_visible_to_client=False,
            ),
        ]
    )
    return True


def ensure_notifications(user):
    if not user or UserNotification.query.filter_by(user_id=user.id).count() > 0:
        return False

    db.session.add_all(
        [
            UserNotification(
                user=user,
                title="Consultation received",
                body="We logged your recent consultation request. Expect a reply within 2 business days.",
                category="booking",
            ),
            UserNotification(
                user=user,
                title="Document review",
                body="Admin team verified your ID submission. You're cleared for the upcoming session.",
                category="documents",
            ),
        ]
    )
    return True


def ensure_admin_activity(admins):
    seeded = False
    for admin in admins:
        if admin and AdminActivityLog.query.filter_by(admin_id=admin.id).count() == 0:
            db.session.add_all(
                [
                    AdminActivityLog(
                        admin=admin,
                        action="login",
                        details="Admin signed in to review dashboard.",
                        ip_address="127.0.0.1",
                    ),
                    AdminActivityLog(
                        admin=admin,
                        action="appointment_update",
                        details="Updated demo appointment status to pending.",
                        ip_address="127.0.0.1",
                    ),
                ]
            )
            seeded = True
    return seeded


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
                value="studio@blackinkdemo.com",
                description="Primary email address used for outbound notifications.",
            ),
            SystemSetting(
                key="maintenance_mode",
                value="off",
                description="Toggle system maintenance mode for the public site.",
                is_editable=False,
            ),
            SystemSetting(
                key="studio_hourly_rate_cents",
                value="20000",
                description="Hourly rate charged for tattoo sessions (in cents).",
            ),
        ]
    )
    return True


def seed_demo_data():
    created_any = False

    owner_admin, owner_created = ensure_admin_account(PRIMARY_ADMIN)
    manager_admin, manager_created = ensure_admin_account(MANAGER_ADMIN)
    created_any |= owner_created or manager_created

    user, user_created = ensure_user_account()
    created_any |= user_created

    created_any |= ensure_categories()
    created_any |= ensure_gallery(owner_admin)
    created_any |= ensure_testimonials()
    created_any |= ensure_appointment(owner_admin, user)
    created_any |= ensure_notifications(user)
    created_any |= ensure_admin_activity([owner_admin, manager_admin])
    created_any |= ensure_settings()

    if created_any:
        db.session.commit()

    return created_any


def main():
    app = create_app()
    with app.app_context():
        db.create_all()
        if seed_demo_data():
            print("Demo data seeded successfully.")
        else:
            print("Database already contains demo data. No changes made.")


if __name__ == "__main__":
    main()
