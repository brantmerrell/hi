"""global_bookmark_per_user

Revision ID: 6e494e4978e9
Revises: d80d31286594
Create Date: 2026-04-18 14:54:30.167796

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6e494e4978e9'
down_revision: Union[str, None] = 'd80d31286594'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Keep only the most recently updated bookmark per user
    op.execute("""
        DELETE FROM bookmarks
        WHERE (user_id, updated_at) NOT IN (
            SELECT user_id, MAX(updated_at) FROM bookmarks GROUP BY user_id
        )
    """)
    # Drop composite PK and unique constraint, replace with user_id-only PK
    op.execute('ALTER TABLE bookmarks DROP CONSTRAINT uq_bookmark_user_story')
    op.execute('ALTER TABLE bookmarks ADD PRIMARY KEY (user_id)')


def downgrade() -> None:
    op.execute('ALTER TABLE bookmarks DROP CONSTRAINT bookmarks_pkey')
    op.execute('ALTER TABLE bookmarks ADD PRIMARY KEY (user_id, story_id)')
    op.execute('ALTER INDEX bookmarks_pkey RENAME TO uq_bookmark_user_story')
