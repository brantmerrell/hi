"""add word_audio_path to sentence_words

Revision ID: b3c1d2e4f5a6
Revises: 7e8e2b8ceb85
Create Date: 2026-04-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b3c1d2e4f5a6'
down_revision: Union[str, None] = '7e8e2b8ceb85'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'sentence_words',
        sa.Column('word_audio_path', sa.String(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('sentence_words', 'word_audio_path')
