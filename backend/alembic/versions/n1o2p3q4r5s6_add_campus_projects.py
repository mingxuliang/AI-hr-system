"""add campus projects and resume school/major fields

Revision ID: n1o2p3q4r5s6
Revises: m0n1o2p3q4r5
Create Date: 2026-10-29
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "n1o2p3q4r5s6"
down_revision: Union[str, None] = "m0n1o2p3q4r5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "campus_projects" not in tables:
        op.create_table(
            "campus_projects",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("school", sa.String(), nullable=False),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("status", sa.String(), nullable=False, server_default="active"),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        )
    if "campus_project_positions" not in tables:
        op.create_table(
            "campus_project_positions",
            sa.Column(
                "project_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("campus_projects.id", ondelete="CASCADE"),
                primary_key=True,
            ),
            sa.Column(
                "position_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("positions.id", ondelete="CASCADE"),
                primary_key=True,
            ),
        )

    resume_cols = {column["name"] for column in inspector.get_columns("resumes")}
    if "campus_project_id" not in resume_cols:
        op.add_column("resumes", sa.Column("campus_project_id", postgresql.UUID(as_uuid=True), nullable=True))
    if "school" not in resume_cols:
        op.add_column("resumes", sa.Column("school", sa.String(), nullable=True))
    if "major" not in resume_cols:
        op.add_column("resumes", sa.Column("major", sa.String(), nullable=True))

    fk_names = {fk.get("name") for fk in inspector.get_foreign_keys("resumes")}
    if "fk_resumes_campus_project_id" not in fk_names:
        op.create_foreign_key(
            "fk_resumes_campus_project_id",
            "resumes",
            "campus_projects",
            ["campus_project_id"],
            ["id"],
            ondelete="SET NULL",
        )
    index_names = {index["name"] for index in inspector.get_indexes("resumes")}
    if "ix_resumes_campus_project_id" not in index_names:
        op.create_index("ix_resumes_campus_project_id", "resumes", ["campus_project_id"])


def downgrade() -> None:
    op.drop_index("ix_resumes_campus_project_id", table_name="resumes")
    op.drop_constraint("fk_resumes_campus_project_id", "resumes", type_="foreignkey")
    op.drop_column("resumes", "major")
    op.drop_column("resumes", "school")
    op.drop_column("resumes", "campus_project_id")
    op.drop_table("campus_project_positions")
    op.drop_table("campus_projects")
