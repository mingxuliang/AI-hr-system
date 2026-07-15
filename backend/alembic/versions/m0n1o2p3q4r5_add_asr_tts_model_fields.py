"""
m0n1o2p3q4r5: add asr/tts model fields to system_configs
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "m0n1o2p3q4r5"
down_revision: Union[str, None] = "l1m2n3o4p5q6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("system_configs", sa.Column("asr_model", sa.String(), nullable=True))
    op.add_column("system_configs", sa.Column("tts_model", sa.String(), nullable=True))
    op.add_column("system_configs", sa.Column("tts_voice", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("system_configs", "tts_voice")
    op.drop_column("system_configs", "tts_model")
    op.drop_column("system_configs", "asr_model")
