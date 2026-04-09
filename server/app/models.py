from datetime import datetime, timedelta
from uuid import uuid4

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
    reservation_assets = db.relationship(
        "ReservationAsset",
        back_populates="admin_uploader",
        lazy="dynamic",
    )
    assigned_reservations = db.relationship(
        "RestaurantReservation",
        back_populates="assigned_admin",
        lazy="dynamic",
        foreign_keys="RestaurantReservation.assigned_admin_id",
    )
    activities = db.relationship(
        "AdminActivityLog",
        back_populates="admin",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )
    availability_blocks = db.relationship(
        "StudioAvailabilityBlock",
        back_populates="created_by_admin",
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
    email = db.Column(db.String(255), unique=True, index=True)
    phone = db.Column(db.String(40))
    password_hash = db.Column(db.String(255))
    is_guest = db.Column(db.Boolean, default=False, nullable=False)
    role = db.Column(db.String(20), default="user", nullable=False)
    last_login_at = db.Column(db.DateTime)
    email_verified_at = db.Column(db.DateTime)
    last_password_change_at = db.Column(db.DateTime)

    reservations = db.relationship(
        "RestaurantReservation",
        back_populates="client",
        lazy="dynamic",
    )
    reservation_assets = db.relationship(
        "ReservationAsset",
        back_populates="client_uploader",
        lazy="dynamic",
    )
    notifications = db.relationship(
        "UserNotification",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )
    documents = db.relationship(
        "ClientDocument",
        back_populates="client",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )
    activation_tokens = db.relationship(
        "AccountActivationToken",
        back_populates="client_account",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )
    email_verification_tokens = db.relationship(
        "EmailVerificationToken",
        back_populates="client_account",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )
    password_reset_requests = db.relationship(
        "PasswordResetRequest",
        back_populates="client_account",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )

    def set_password(self, raw_password: str) -> None:
        self.password_hash = generate_password_hash(raw_password)
        self.last_password_change_at = datetime.utcnow()

    def check_password(self, raw_password: str) -> bool:
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, raw_password)

    def mark_email_verified(self) -> None:
        self.email_verified_at = datetime.utcnow()

    @property
    def display_name(self) -> str:
        if self.first_name or self.last_name:
            return " ".join(filter(None, [self.first_name, self.last_name]))
        return self.email or "Guest"

    def has_identity_documents(self) -> bool:
        assets_query = getattr(self, "reservation_assets", None)
        if not assets_query:
            return False
        if hasattr(assets_query, "filter"):
            return (
                assets_query.filter(
                    ReservationAsset.kind.in_(["id_front", "id_back"]),
                    ReservationAsset.file_url.isnot(None),
                )
                .limit(1)
                .first()
                is not None
            )
        return any(asset.kind in {"id_front", "id_back"} and asset.file_url for asset in assets_query)


class ClientDocument(TimestampMixin, db.Model):
    __tablename__ = "client_documents"

    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(
        db.Integer,
        db.ForeignKey("client_accounts.id"),
        nullable=False,
    )
    file_url = db.Column(db.String(1024), nullable=False)
    kind = db.Column(db.String(40), nullable=False, default="document")
    title = db.Column(db.String(255))
    notes = db.Column(db.Text)

    client = db.relationship("ClientAccount", back_populates="documents")


class AccountActivationToken(TimestampMixin, db.Model):
    __tablename__ = "account_activation_tokens"

    id = db.Column(db.Integer, primary_key=True)
    client_account_id = db.Column(
        db.Integer,
        db.ForeignKey("client_accounts.id"),
        nullable=False,
    )
    token_hash = db.Column(db.String(128), unique=True, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    used_at = db.Column(db.DateTime)

    client_account = db.relationship("ClientAccount", back_populates="activation_tokens")


class EmailVerificationToken(TimestampMixin, db.Model):
    __tablename__ = "email_verification_tokens"

    id = db.Column(db.Integer, primary_key=True)
    client_account_id = db.Column(
        db.Integer,
        db.ForeignKey("client_accounts.id"),
        nullable=False,
        index=True,
    )
    email = db.Column(db.String(255), nullable=False)
    purpose = db.Column(db.String(32), nullable=False, default="verify_email")
    code_hash = db.Column(db.String(255), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    consumed_at = db.Column(db.DateTime)

    client_account = db.relationship("ClientAccount", back_populates="email_verification_tokens")

    def is_expired(self, now=None) -> bool:
        now = now or datetime.utcnow()
        return self.expires_at <= now

    def is_consumed(self) -> bool:
        return self.consumed_at is not None

    def mark_consumed(self, when=None) -> None:
        self.consumed_at = when or datetime.utcnow()


class PasswordResetRequest(TimestampMixin, db.Model):
    __tablename__ = "password_reset_requests"

    id = db.Column(db.Integer, primary_key=True)
    client_account_id = db.Column(
        db.Integer,
        db.ForeignKey("client_accounts.id"),
        nullable=False,
        index=True,
    )
    code_hash = db.Column(db.String(255), nullable=False)
    requested_ip = db.Column(db.String(45))
    requested_user_agent = db.Column(db.String(255))
    expires_at = db.Column(db.DateTime, nullable=False)
    consumed_at = db.Column(db.DateTime)

    client_account = db.relationship("ClientAccount", back_populates="password_reset_requests")

    def is_expired(self, now=None) -> bool:
        now = now or datetime.utcnow()
        return self.expires_at <= now

    def is_consumed(self) -> bool:
        return self.consumed_at is not None

    def mark_consumed(self, when=None) -> None:
        self.consumed_at = when or datetime.utcnow()


class GalleryCategory(TimestampMixin, db.Model):
    __tablename__ = "gallery_categories"

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
        return f"<GalleryCategory {self.name}>"


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


class StoredUpload(TimestampMixin, db.Model):
    __tablename__ = "stored_uploads"

    id = db.Column(db.String(36), primary_key=True, default=lambda: uuid4().hex)
    filename = db.Column(db.String(255), unique=True, nullable=False)
    content_type = db.Column(db.String(255))
    data = db.Column(db.LargeBinary, nullable=False)


class GalleryItem(db.Model):
    __tablename__ = "gallery_items"

    id = db.Column(db.Integer, primary_key=True)
    category_id = db.Column(
        db.Integer,
        db.ForeignKey("gallery_categories.id"),
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

    category = db.relationship("GalleryCategory", back_populates="gallery_items")
    uploaded_by = db.relationship("AdminAccount", back_populates="gallery_items")
    placements = db.relationship(
        "GalleryPlacement",
        back_populates="gallery_item",
        cascade="all, delete-orphan",
    )

    @property
    def category_name(self) -> str:
        return self.category.name if self.category else None


# Valid section slugs for GalleryPlacement.
# 'our_story'      → 4-slot panel grid in the About / Our Story section
# 'homepage_taste' → 6-slot preview grid in the homepage Gallery section
GALLERY_PLACEMENT_SECTIONS = ("our_story", "homepage_taste")
GALLERY_PLACEMENT_LIMITS = {"our_story": 4, "homepage_taste": 6}


class GalleryPlacement(db.Model):
    """Maps a published gallery item to a named display section with a slot order and optional label.

    Each (section, display_order) pair is unique — one photo per slot.
    Each (gallery_item_id, section) pair is unique — a photo can occupy only one slot per section.
    A photo may appear in multiple sections (different rows in this table).
    """

    __tablename__ = "gallery_placements"
    __table_args__ = (
        db.UniqueConstraint("section", "display_order", name="uq_gallery_placements_section_order"),
        db.UniqueConstraint("gallery_item_id", "section", name="uq_gallery_placements_item_section"),
    )

    id = db.Column(db.Integer, primary_key=True)
    gallery_item_id = db.Column(
        db.Integer,
        db.ForeignKey("gallery_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # One of GALLERY_PLACEMENT_SECTIONS
    section = db.Column(db.String(40), nullable=False, index=True)
    # 1-based position within the section (1–4 for our_story, 1–6 for homepage_taste)
    display_order = db.Column(db.Integer, nullable=False, default=1)
    # Optional label displayed over the photo (e.g. "The Room", "The Pasta")
    slot_label = db.Column(db.String(120))

    gallery_item = db.relationship("GalleryItem", back_populates="placements")

    def __repr__(self) -> str:
        return f"<GalleryPlacement section={self.section} order={self.display_order} item={self.gallery_item_id}>"


class Testimonial(db.Model):
    __tablename__ = "testimonials"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    quote = db.Column(db.Text, nullable=False)
    rating = db.Column(db.Integer, nullable=False)


class RestaurantReservation(TimestampMixin, db.Model):
    __tablename__ = "restaurant_reservations"
    __table_args__ = (
        db.Index("ix_restaurant_reservations_scheduled_start", "scheduled_start"),
        db.Index("ix_restaurant_reservations_status", "status"),
        db.Index("ix_restaurant_reservations_client_id", "client_id"),
        db.Index("ix_restaurant_reservations_assigned_admin_id", "assigned_admin_id"),
    )

    id = db.Column(db.Integer, primary_key=True)
    reference_code = db.Column(db.String(40), unique=True)
    contact_name = db.Column(db.String(255))
    contact_email = db.Column(db.String(255))
    contact_phone = db.Column(db.String(40))
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
    suggested_duration_minutes = db.Column(db.Integer)
    seating_preference = db.Column(db.String(120))
    party_size = db.Column(db.Integer)
    special_requests = db.Column(db.Text)
    session_option_id = db.Column(
        db.Integer,
        db.ForeignKey("session_options.id", ondelete="SET NULL"),
    )
    terms_agreed_at = db.Column(db.DateTime)
    assigned_admin_id = db.Column(
        db.Integer,
        db.ForeignKey("admin_accounts.id"),
    )

    client = db.relationship("ClientAccount", back_populates="reservations")
    assigned_admin = db.relationship(
        "AdminAccount",
        back_populates="assigned_reservations",
        foreign_keys=[assigned_admin_id],
    )
    assets = db.relationship(
        "ReservationAsset",
        back_populates="reservation",
        cascade="all, delete-orphan",
        order_by="ReservationAsset.created_at",
    )
    payments = db.relationship(
        "ReservationPayment",
        back_populates="reservation",
        cascade="all, delete-orphan",
        order_by="ReservationPayment.created_at",
    )

    session_option = db.relationship("SessionOption", passive_deletes=True)

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

    @property
    def display_contact_name(self) -> str | None:
        return (
            self.contact_name
            or (self.client.display_name if self.client else None)
            or self.guest_name
        )

    @property
    def display_contact_email(self) -> str | None:
        return self.contact_email or (self.client.email if self.client else None) or self.guest_email

    @property
    def display_contact_phone(self) -> str | None:
        return self.contact_phone or (self.client.phone if self.client else None) or self.guest_phone


class ReservationAsset(TimestampMixin, db.Model):
    __tablename__ = "reservation_assets"

    id = db.Column(db.Integer, primary_key=True)
    reservation_id = db.Column(
        db.Integer,
        db.ForeignKey("restaurant_reservations.id"),
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
    file_url = db.Column(db.Text)
    note_text = db.Column(db.Text)
    is_visible_to_client = db.Column(db.Boolean, default=True, nullable=False)

    reservation = db.relationship("RestaurantReservation", back_populates="assets")
    admin_uploader = db.relationship(
        "AdminAccount",
        back_populates="reservation_assets",
        foreign_keys=[uploaded_by_admin_id],
    )
    client_uploader = db.relationship(
        "ClientAccount",
        back_populates="reservation_assets",
        foreign_keys=[uploaded_by_client_id],
    )

    def is_note(self) -> bool:
        return self.kind == "note"


class ReservationPayment(TimestampMixin, db.Model):
    __tablename__ = "reservation_payments"

    id = db.Column(db.Integer, primary_key=True)
    reservation_id = db.Column(
        db.Integer,
        db.ForeignKey("restaurant_reservations.id"),
        nullable=False,
    )
    provider = db.Column(db.String(40), nullable=False, default="manual")
    provider_payment_id = db.Column(db.String(120), nullable=False)
    status = db.Column(db.String(40), nullable=False)
    amount_cents = db.Column(db.Integer, nullable=False)
    currency = db.Column(db.String(3), nullable=False, default="USD")
    receipt_url = db.Column(db.String(1024))
    note = db.Column(db.String(255))

    reservation = db.relationship("RestaurantReservation", back_populates="payments")


class SessionOption(TimestampMixin, db.Model):
    __tablename__ = "session_options"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120))
    tagline = db.Column(db.String(120))
    description = db.Column(db.Text)
    category = db.Column(db.String(80))
    duration_minutes = db.Column(db.Integer, nullable=False)
    price_cents = db.Column(db.Integer, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    def __repr__(self) -> str:
        return f"<SessionOption {self.id}: {self.name or self.duration_minutes}>"


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
    value = db.Column(db.Text, nullable=False)
    description = db.Column(db.Text)
    is_editable = db.Column(db.Boolean, default=True, nullable=False)

    def __repr__(self) -> str:
        return f"<SystemSetting {self.key}>"


class StudioWorkingHour(TimestampMixin, db.Model):
    __tablename__ = "studio_working_hours"

    id = db.Column(db.Integer, primary_key=True)
    weekday = db.Column(db.Integer, unique=True, nullable=False)  # 0 = Monday
    is_open = db.Column(db.Boolean, default=True, nullable=False)
    opens_at = db.Column(db.Time, nullable=False)
    closes_at = db.Column(db.Time, nullable=False)
    minimum_duration_minutes = db.Column(db.Integer, default=60, nullable=False)


class MenuCategory(TimestampMixin, db.Model):
    __tablename__ = "menu_categories"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text)
    display_order = db.Column(db.Integer, nullable=False, default=0)
    is_visible = db.Column(db.Boolean, nullable=False, default=True)

    items = db.relationship(
        "MenuItem",
        back_populates="category",
        cascade="all, delete-orphan",
        order_by="MenuItem.display_order",
    )


class MenuItem(TimestampMixin, db.Model):
    __tablename__ = "menu_items"

    id = db.Column(db.Integer, primary_key=True)
    category_id = db.Column(
        db.Integer,
        db.ForeignKey("menu_categories.id", ondelete="CASCADE"),
        nullable=False,
    )
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    price_cents = db.Column(db.Integer)  # None = "ask server"
    tags = db.Column(db.Text)  # JSON array e.g. '["v","gf"]'
    display_order = db.Column(db.Integer, nullable=False, default=0)
    is_visible = db.Column(db.Boolean, nullable=False, default=True)

    category = db.relationship("MenuCategory", back_populates="items")


class DailySpecialSection(TimestampMixin, db.Model):
    __tablename__ = "daily_special_sections"

    id = db.Column(db.Integer, primary_key=True)
    course = db.Column(db.String(120), nullable=False)
    display_order = db.Column(db.Integer, nullable=False, default=0)
    is_visible = db.Column(db.Boolean, nullable=False, default=True)

    items = db.relationship(
        "DailySpecialItem",
        back_populates="section",
        cascade="all, delete-orphan",
        order_by="DailySpecialItem.display_order",
    )


class DailySpecialItem(TimestampMixin, db.Model):
    __tablename__ = "daily_special_items"

    id = db.Column(db.Integer, primary_key=True)
    section_id = db.Column(
        db.Integer,
        db.ForeignKey("daily_special_sections.id", ondelete="CASCADE"),
        nullable=False,
    )
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    price_cents = db.Column(db.Integer)  # None = no price shown
    display_order = db.Column(db.Integer, nullable=False, default=0)

    section = db.relationship("DailySpecialSection", back_populates="items")


class StudioClosure(TimestampMixin, db.Model):
    __tablename__ = "studio_closures"

    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, unique=True, nullable=False)
    reason = db.Column(db.String(255))


class StudioAvailabilityBlock(TimestampMixin, db.Model):
    __tablename__ = "studio_availability_blocks"

    id = db.Column(db.Integer, primary_key=True)
    start = db.Column(db.DateTime, nullable=False)
    end = db.Column(db.DateTime, nullable=False)
    reason = db.Column(db.String(255))
    created_by_admin_id = db.Column(
        db.Integer,
        db.ForeignKey("admin_accounts.id"),
    )

    created_by_admin = db.relationship("AdminAccount", back_populates="availability_blocks")
