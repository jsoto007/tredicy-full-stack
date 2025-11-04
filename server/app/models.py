from datetime import datetime, timedelta

from werkzeug.security import check_password_hash, generate_password_hash

from .config import db


class TimestampMixin:
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )


class AdminAccount(TimestampMixin, db.Model):
    __tablename__ = "admin_accounts"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    last_login_at = db.Column(db.DateTime)

    gallery_items = db.relationship(
        "GalleryItem",
        back_populates="uploaded_by",
        lazy="dynamic",
    )
    appointment_assets = db.relationship(
        "AppointmentAsset",
        back_populates="admin_uploader",
        lazy="dynamic",
    )
    assigned_appointments = db.relationship(
        "TattooAppointment",
        back_populates="assigned_admin",
        lazy="dynamic",
        foreign_keys="TattooAppointment.assigned_admin_id",
    )
    activities = db.relationship(
        "AdminActivityLog",
        back_populates="admin",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )

    def set_password(self, raw_password: str) -> None:
        self.password_hash = generate_password_hash(raw_password)

    def check_password(self, raw_password: str) -> bool:
        return check_password_hash(self.password_hash, raw_password)


class ClientAccount(TimestampMixin, db.Model):
    __tablename__ = "client_accounts"

    id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(120))
    last_name = db.Column(db.String(120))
    email = db.Column(db.String(255))
    phone = db.Column(db.String(40))
    password_hash = db.Column(db.String(255))
    is_guest = db.Column(db.Boolean, default=False, nullable=False)
    role = db.Column(db.String(20), default="user", nullable=False)
    last_login_at = db.Column(db.DateTime)

    appointments = db.relationship(
        "TattooAppointment",
        back_populates="client",
        lazy="dynamic",
    )
    appointment_assets = db.relationship(
        "AppointmentAsset",
        back_populates="client_uploader",
        lazy="dynamic",
    )
    notifications = db.relationship(
        "UserNotification",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )

    def set_password(self, raw_password: str) -> None:
        self.password_hash = generate_password_hash(raw_password)

    def check_password(self, raw_password: str) -> bool:
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, raw_password)

    @property
    def display_name(self) -> str:
        if self.first_name or self.last_name:
            return " ".join(filter(None, [self.first_name, self.last_name]))
        return self.email or "Guest"


class TattooCategory(TimestampMixin, db.Model):
    __tablename__ = "tattoo_categories"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)
    description = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    gallery_items = db.relationship(
        "GalleryItem",
        back_populates="category",
        cascade="all, delete",
    )

    def __repr__(self) -> str:
        return f"<TattooCategory {self.name}>"


class Consultation(db.Model):
    __tablename__ = "consultations"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    phone = db.Column(db.String(40))
    preferred_date = db.Column(db.String(40))
    placement = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class GalleryItem(db.Model):
    __tablename__ = "gallery_items"

    id = db.Column(db.Integer, primary_key=True)
    category_id = db.Column(
        db.Integer,
        db.ForeignKey("tattoo_categories.id"),
        nullable=False,
    )
    uploaded_by_admin_id = db.Column(
        db.Integer,
        db.ForeignKey("admin_accounts.id"),
        nullable=False,
    )
    image_url = db.Column(db.String(512), nullable=False)
    alt = db.Column(db.String(255), nullable=False)
    caption = db.Column(db.String(255))
    is_published = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    category = db.relationship("TattooCategory", back_populates="gallery_items")
    uploaded_by = db.relationship("AdminAccount", back_populates="gallery_items")

    @property
    def category_name(self) -> str:
        return self.category.name if self.category else None


class Testimonial(db.Model):
    __tablename__ = "testimonials"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    quote = db.Column(db.Text, nullable=False)
    rating = db.Column(db.Integer, nullable=False)


class TattooAppointment(TimestampMixin, db.Model):
    __tablename__ = "tattoo_appointments"

    id = db.Column(db.Integer, primary_key=True)
    reference_code = db.Column(db.String(40), unique=True)
    client_id = db.Column(
        db.Integer,
        db.ForeignKey("client_accounts.id"),
    )
    guest_name = db.Column(db.String(255))
    guest_email = db.Column(db.String(255))
    guest_phone = db.Column(db.String(40))
    client_description = db.Column(db.Text)
    status = db.Column(db.String(40), default="pending", nullable=False)
    scheduled_start = db.Column(db.DateTime)
    duration_minutes = db.Column(db.Integer)
    assigned_admin_id = db.Column(
        db.Integer,
        db.ForeignKey("admin_accounts.id"),
    )

    client = db.relationship("ClientAccount", back_populates="appointments")
    assigned_admin = db.relationship(
        "AdminAccount",
        back_populates="assigned_appointments",
        foreign_keys=[assigned_admin_id],
    )
    assets = db.relationship(
        "AppointmentAsset",
        back_populates="appointment",
        cascade="all, delete-orphan",
        order_by="AppointmentAsset.created_at",
    )

    @property
    def scheduled_end(self):
        if not self.scheduled_start or not self.duration_minutes:
            return None
        return self.scheduled_start + timedelta(minutes=self.duration_minutes)

    @property
    def display_client_name(self) -> str:
        if self.client:
            return self.client.display_name
        return self.guest_name or "Guest"

    def has_identity_documents(self) -> bool:
        return any(
            asset.kind in {"id_front", "id_back"}
            for asset in self.assets
        )


class AppointmentAsset(TimestampMixin, db.Model):
    __tablename__ = "appointment_assets"

    id = db.Column(db.Integer, primary_key=True)
    appointment_id = db.Column(
        db.Integer,
        db.ForeignKey("tattoo_appointments.id"),
        nullable=False,
    )
    uploaded_by_admin_id = db.Column(
        db.Integer,
        db.ForeignKey("admin_accounts.id"),
    )
    uploaded_by_client_id = db.Column(
        db.Integer,
        db.ForeignKey("client_accounts.id"),
    )
    kind = db.Column(
        db.String(40),
        nullable=False,
    )  # e.g. id_front, id_back, inspiration_image, document, note
    file_url = db.Column(db.String(512))
    note_text = db.Column(db.Text)
    is_visible_to_client = db.Column(db.Boolean, default=True, nullable=False)

    appointment = db.relationship("TattooAppointment", back_populates="assets")
    admin_uploader = db.relationship(
        "AdminAccount",
        back_populates="appointment_assets",
        foreign_keys=[uploaded_by_admin_id],
    )
    client_uploader = db.relationship(
        "ClientAccount",
        back_populates="appointment_assets",
        foreign_keys=[uploaded_by_client_id],
    )

    def is_note(self) -> bool:
        return self.kind == "note"


class UserNotification(TimestampMixin, db.Model):
    __tablename__ = "user_notifications"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("client_accounts.id"),
        nullable=False,
    )
    title = db.Column(db.String(120), nullable=False)
    body = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False, nullable=False)
    category = db.Column(db.String(40), default="general", nullable=False)

    user = db.relationship("ClientAccount", back_populates="notifications")


class AdminActivityLog(TimestampMixin, db.Model):
    __tablename__ = "admin_activity_logs"

    id = db.Column(db.Integer, primary_key=True)
    admin_id = db.Column(
        db.Integer,
        db.ForeignKey("admin_accounts.id"),
        nullable=False,
    )
    action = db.Column(db.String(120), nullable=False)
    details = db.Column(db.Text)
    ip_address = db.Column(db.String(120))

    admin = db.relationship("AdminAccount", back_populates="activities")


class SystemSetting(TimestampMixin, db.Model):
    __tablename__ = "system_settings"

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(120), unique=True, nullable=False)
    value = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    is_editable = db.Column(db.Boolean, default=True, nullable=False)

    def __repr__(self) -> str:
        return f"<SystemSetting {self.key}>"
