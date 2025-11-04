"""Add availability models and appointment metadata."""

from __future__ import annotations

import json
from datetime import datetime, time as time_obj

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text


# revision identifiers, used by Alembic.
revision = "3f4ed0a5ecdf"
down_revision = None
branch_labels = None
depends_on = None


DEFAULT_OPERATING_HOURS = [
    {"day": "monday", "is_open": True, "open_time": "10:00", "close_time": "18:00"},
    {"day": "tuesday", "is_open": True, "open_time": "10:00", "close_time": "18:00"},
    {"day": "wednesday", "is_open": True, "open_time": "10:00", "close_time": "18:00"},
    {"day": "thursday", "is_open": True, "open_time": "10:00", "close_time": "18:00"},
    {"day": "friday", "is_open": True, "open_time": "10:00", "close_time": "18:00"},
    {"day": "saturday", "is_open": True, "open_time": "10:00", "close_time": "16:00"},
    {"day": "sunday", "is_open": False, "open_time": "10:00", "close_time": "14:00"},
]

WEEK_DAYS = (
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
)

DAY_TO_INDEX = {day: index for index, day in enumerate(WEEK_DAYS)}


def _parse_time(value: str, fallback: str) -> time_obj:
    try:
        return datetime.strptime(value, "%H:%M").time()
    except (ValueError, TypeError):
        return datetime.strptime(fallback, "%H:%M").time()


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    created_working_hours = False
    created_closures = False
    created_availability_blocks = False

    if not inspector.has_table("studio_working_hours"):
        op.create_table(
            "studio_working_hours",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("weekday", sa.Integer(), nullable=False),
            sa.Column("is_open", sa.Boolean(), nullable=False, server_default=sa.text("1")),
            sa.Column("opens_at", sa.Time(), nullable=False),
            sa.Column("closes_at", sa.Time(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("weekday"),
        )
        created_working_hours = True

    if not inspector.has_table("studio_closures"):
        op.create_table(
            "studio_closures",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("date", sa.Date(), nullable=False),
            sa.Column("reason", sa.String(length=255), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("date"),
        )
        created_closures = True

    if not inspector.has_table("studio_availability_blocks"):
        op.create_table(
            "studio_availability_blocks",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("start", sa.DateTime(), nullable=False),
            sa.Column("end", sa.DateTime(), nullable=False),
            sa.Column("reason", sa.String(length=255), nullable=True),
            sa.Column("created_by_admin_id", sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(["created_by_admin_id"], ["admin_accounts.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        created_availability_blocks = True

    existing_columns = {column["name"] for column in inspector.get_columns("tattoo_appointments")}
    columns_to_add = [
        ("contact_name", sa.String(length=255)),
        ("contact_email", sa.String(length=255)),
        ("contact_phone", sa.String(length=40)),
        ("suggested_duration_minutes", sa.Integer()),
        ("tattoo_placement", sa.String(length=120)),
        ("tattoo_size", sa.String(length=120)),
        ("placement_notes", sa.Text()),
    ]
    if any(name not in existing_columns for name, _ in columns_to_add):
        with op.batch_alter_table("tattoo_appointments", schema=None) as batch_op:
            for name, column in columns_to_add:
                if name not in existing_columns:
                    batch_op.add_column(sa.Column(name, column, nullable=True))

    inspector = inspect(bind)

    system_settings = sa.Table(
        "system_settings",
        sa.MetaData(),
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("key", sa.String(length=120)),
        sa.Column("value", sa.Text()),
    )

    working_hours_rows = []
    closures_rows = []
    now = datetime.utcnow()

    hours_setting = bind.execute(
        sa.select(system_settings.c.value).where(system_settings.c.key == "studio_operating_hours")
    ).scalar()

    days_off_setting = bind.execute(
        sa.select(system_settings.c.value).where(system_settings.c.key == "studio_days_off")
    ).scalar()

    seed_working_hours = created_working_hours
    if not seed_working_hours and inspector.has_table("studio_working_hours"):
        existing_count = bind.execute(text("SELECT COUNT(*) FROM studio_working_hours")).scalar()
        seed_working_hours = existing_count == 0

    seed_closures = created_closures
    if not seed_closures and inspector.has_table("studio_closures"):
        existing_closures = bind.execute(text("SELECT COUNT(*) FROM studio_closures")).scalar()
        seed_closures = existing_closures == 0

    raw_hours = DEFAULT_OPERATING_HOURS
    if hours_setting:
        try:
            parsed = json.loads(hours_setting)
            if isinstance(parsed, list) and parsed:
                raw_hours = parsed
        except json.JSONDecodeError:
            pass

    if seed_working_hours:
        for entry in raw_hours:
            day = entry.get("day")
            if day not in DAY_TO_INDEX:
                continue
            weekday = DAY_TO_INDEX[day]
            is_open = bool(entry.get("is_open", True))
            open_time = _parse_time(entry.get("open_time") or "10:00", "10:00")
            close_time = _parse_time(entry.get("close_time") or "18:00", "18:00")
            working_hours_rows.append(
                {
                    "weekday": weekday,
                    "is_open": is_open,
                    "opens_at": open_time,
                    "closes_at": close_time,
                    "created_at": now,
                    "updated_at": now,
                }
            )

    parsed_days = []
    if days_off_setting:
        try:
            parsed_days = json.loads(days_off_setting) or []
        except json.JSONDecodeError:
            parsed_days = []

    if seed_closures:
        for value in parsed_days:
            if not value:
                continue
            try:
                parsed_date = datetime.fromisoformat(value).date()
            except ValueError:
                continue
            closures_rows.append(
                {
                    "date": parsed_date,
                    "created_at": now,
                    "updated_at": now,
                }
            )

    if working_hours_rows:
        op.bulk_insert(
            sa.table(
                "studio_working_hours",
                sa.column("weekday", sa.Integer()),
                sa.column("is_open", sa.Boolean()),
                sa.column("opens_at", sa.Time()),
                sa.column("closes_at", sa.Time()),
                sa.column("created_at", sa.DateTime()),
                sa.column("updated_at", sa.DateTime()),
            ),
            working_hours_rows,
        )

    if closures_rows:
        op.bulk_insert(
            sa.table(
                "studio_closures",
                sa.column("date", sa.Date()),
                sa.column("created_at", sa.DateTime()),
                sa.column("updated_at", sa.DateTime()),
            ),
            closures_rows,
        )


def downgrade() -> None:
    with op.batch_alter_table("tattoo_appointments", schema=None) as batch_op:
        batch_op.drop_column("placement_notes")
        batch_op.drop_column("tattoo_size")
        batch_op.drop_column("tattoo_placement")
        batch_op.drop_column("suggested_duration_minutes")
        batch_op.drop_column("contact_phone")
        batch_op.drop_column("contact_email")
        batch_op.drop_column("contact_name")

    op.drop_table("studio_availability_blocks")
    op.drop_table("studio_closures")
    op.drop_table("studio_working_hours")
