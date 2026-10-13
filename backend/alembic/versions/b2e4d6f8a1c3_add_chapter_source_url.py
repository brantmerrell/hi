"""add_chapter_source_url

Revision ID: b2e4d6f8a1c3
Revises: a1f3c9d2e7b8
Create Date: 2026-10-13 17:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2e4d6f8a1c3'
down_revision: Union[str, None] = 'a1f3c9d2e7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('chapters', sa.Column('source_url', sa.String(), nullable=True))
    # Single-chapter stories keep pointing at the story's own source
    op.execute("UPDATE chapters SET source_url = stories.source_url FROM stories WHERE stories.id = chapters.story_id")


def downgrade() -> None:
    op.drop_column('chapters', 'source_url')
