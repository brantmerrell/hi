"""add_title_en_and_drop_title_from_stories

Revision ID: 9dc2de9b9010
Revises: b3c1d2e4f5a6
Create Date: 2026-04-14 18:22:41.027443

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9dc2de9b9010'
down_revision: Union[str, None] = 'b3c1d2e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('stories', sa.Column('title_en', sa.String(), nullable=True))
    op.drop_column('stories', 'title')


def downgrade() -> None:
    op.drop_column('stories', 'title_en')
    op.add_column('stories', sa.Column('title', sa.String(), nullable=True))
