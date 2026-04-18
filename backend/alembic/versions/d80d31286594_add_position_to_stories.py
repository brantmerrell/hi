"""add_position_to_stories

Revision ID: d80d31286594
Revises: 8e2cdb700ff9
Create Date: 2026-04-18 14:41:45.054415

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd80d31286594'
down_revision: Union[str, None] = '8e2cdb700ff9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('stories', sa.Column('position', sa.Integer(), nullable=True))
    op.create_unique_constraint('uq_story_position', 'stories', ['position'])


def downgrade() -> None:
    op.drop_constraint('uq_story_position', 'stories', type_='unique')
    op.drop_column('stories', 'position')
