"""harden auth and add performance indexes"""

from alembic import op
import sqlalchemy as sa


revision = '13b662e3fe4a'
down_revision = '7b7c2d0e2f7b'
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        WITH duplicates AS (
            SELECT id
            FROM (
                SELECT id,
                       ROW_NUMBER() OVER (PARTITION BY lower(email) ORDER BY id) AS rn
                FROM client_accounts
                WHERE email IS NOT NULL
            ) ranked
            WHERE ranked.rn > 1
        )
        UPDATE client_accounts
        SET email = NULL
        WHERE id IN (SELECT id FROM duplicates)
        """
    )
    op.create_unique_constraint('uq_client_accounts_email', 'client_accounts', ['email'])
    op.create_index('ix_tattoo_appointments_scheduled_start', 'tattoo_appointments', ['scheduled_start'])
    op.create_index('ix_tattoo_appointments_status', 'tattoo_appointments', ['status'])


def downgrade():
    op.drop_index('ix_tattoo_appointments_status', table_name='tattoo_appointments')
    op.drop_index('ix_tattoo_appointments_scheduled_start', table_name='tattoo_appointments')
    op.drop_constraint('uq_client_accounts_email', 'client_accounts', type_='unique')
