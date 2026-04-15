"""add_word_sense_notes

Revision ID: 8e2cdb700ff9
Revises: 9dc2de9b9010
Create Date: 2026-04-14 18:42:50.150093

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8e2cdb700ff9'
down_revision: Union[str, None] = '9dc2de9b9010'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('word_sense_notes',
    sa.Column('word_sense_id', sa.UUID(), nullable=False),
    sa.Column('display_gloss', sa.Text(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['word_sense_id'], ['word_senses.id'], ),
    sa.PrimaryKeyConstraint('word_sense_id')
    )


def downgrade() -> None:
    op.drop_table('word_sense_notes')
