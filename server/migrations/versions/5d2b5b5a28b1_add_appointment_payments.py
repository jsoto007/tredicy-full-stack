"""add appointment payments table"""

from alembic import op
import sqlalchemy as sa


revision = '5d2b5b5a28b1'
down_revision = '13b662e3fe4a'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'appointment_payments',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('appointment_id', sa.Integer(), sa.ForeignKey('tattoo_appointments.id', ondelete='CASCADE'), nullable=False),
        sa.Column('provider', sa.String(length=40), nullable=False),
        sa.Column('provider_payment_id', sa.String(length=120), nullable=False),
        sa.Column('status', sa.String(length=40), nullable=False),
        sa.Column('amount_cents', sa.Integer(), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=False),
        sa.Column('receipt_url', sa.String(length=1024)),
        sa.Column('note', sa.String(length=255)),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    op.create_index('ix_appointment_payments_appointment_id', 'appointment_payments', ['appointment_id'])


def downgrade():
    op.drop_index('ix_appointment_payments_appointment_id', table_name='appointment_payments')
    op.drop_table('appointment_payments')
