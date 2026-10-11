"""add_word_start_ms

Revision ID: e5b2a9c7d1f4
Revises: c4a7e1f2b9d3
Create Date: 2026-10-11 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5b2a9c7d1f4'
down_revision: Union[str, None] = 'c4a7e1f2b9d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Offset of the word's start within its sentence's audio clip; NULL until
    # generate_audio.py has timed the sentence.
    op.add_column('sentence_words', sa.Column('start_ms', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('sentence_words', 'start_ms')
