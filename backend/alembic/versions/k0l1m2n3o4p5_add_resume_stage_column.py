"""add resume stage column

Revision ID: k0l1m2n3o4p5
Revises: j9k0l1m2n3o4
Create Date: 2026-07-13

"""
from alembic import op
import sqlalchemy as sa

revision = 'k0l1m2n3o4p5'
down_revision = 'j9k0l1m2n3o4'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('resumes', sa.Column('stage', sa.String(), server_default='new', nullable=True))


def downgrade():
    op.drop_column('resumes', 'stage')
