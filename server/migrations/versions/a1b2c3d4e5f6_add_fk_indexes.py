"""Add FK indexes on tattoo_appointments and email index on client_accounts"""

from alembic import op


revision = "a1b2c3d4e5f6"
down_revision = "f7c1ceb75a2d"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index("ix_tattoo_appointments_client_id", "tattoo_appointments", ["client_id"])
    op.create_index("ix_tattoo_appointments_assigned_admin_id", "tattoo_appointments", ["assigned_admin_id"])
    op.create_index("ix_client_accounts_email", "client_accounts", ["email"])


def downgrade():
    op.drop_index("ix_client_accounts_email", table_name="client_accounts")
    op.drop_index("ix_tattoo_appointments_assigned_admin_id", table_name="tattoo_appointments")
    op.drop_index("ix_tattoo_appointments_client_id", table_name="tattoo_appointments")
