"""backfill_story_position

Revision ID: 93dac12a8a04
Revises: 6e494e4978e9
Create Date: 2026-09-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '93dac12a8a04'
down_revision: Union[str, None] = '6e494e4978e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Assign sequential 0-based positions to existing stories, ordered by
    # creation date, so stories with a NULL position (added before the
    # `position` column existed) become addressable via /{position}/...
    op.execute("""
        UPDATE stories
        SET position = sub.rn
        FROM (
            SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) - 1 AS rn
            FROM stories
            WHERE position IS NULL
        ) AS sub
        WHERE stories.id = sub.id
    """)


def downgrade() -> None:
    op.execute("UPDATE stories SET position = NULL")
