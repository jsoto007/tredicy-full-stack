"""Add gallery_placements table

Revision ID: c4d5e6f7a8b9
Revises: 0dd82ae65162
Create Date: 2026-04-09

Adds gallery_placements — a join table that maps gallery items to named display
sections (our_story, homepage_taste) with a slot order and optional label.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'c4d5e6f7a8b9'
down_revision = '0dd82ae65162'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'gallery_placements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('gallery_item_id', sa.Integer(), nullable=False),
        sa.Column('section', sa.String(length=40), nullable=False),
        sa.Column('display_order', sa.Integer(), nullable=False),
        sa.Column('slot_label', sa.String(length=120), nullable=True),
        sa.ForeignKeyConstraint(
            ['gallery_item_id'],
            ['gallery_items.id'],
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('section', 'display_order', name='uq_gallery_placements_section_order'),
        sa.UniqueConstraint('gallery_item_id', 'section', name='uq_gallery_placements_item_section'),
    )
    op.create_index('ix_gallery_placements_gallery_item_id', 'gallery_placements', ['gallery_item_id'])
    op.create_index('ix_gallery_placements_section', 'gallery_placements', ['section'])


def downgrade():
    op.drop_index('ix_gallery_placements_section', table_name='gallery_placements')
    op.drop_index('ix_gallery_placements_gallery_item_id', table_name='gallery_placements')
    op.drop_table('gallery_placements')
