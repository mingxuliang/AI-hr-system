"""add company on resumes for campus applications

Revision ID: o2p3q4r5s6t7
Revises: n1o2p3q4r5s6
Create Date: 2026-10-29
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "o2p3q4r5s6t7"
down_revision: Union[str, None] = "n1o2p3q4r5s6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    resume_cols = {column["name"] for column in inspector.get_columns("resumes")}
    if "company" not in resume_cols:
        op.add_column("resumes", sa.Column("company", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("resumes", "company")
