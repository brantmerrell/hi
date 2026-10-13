"""add_chapters

Revision ID: a1f3c9d2e7b8
Revises: e5b2a9c7d1f4
Create Date: 2026-10-13 16:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a1f3c9d2e7b8'
down_revision: Union[str, None] = 'e5b2a9c7d1f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'chapters',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('story_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('stories.id'), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('title_hi', sa.String(), nullable=True),
        sa.Column('title_en', sa.String(), nullable=True),
        sa.UniqueConstraint('story_id', 'position', name='uq_chapter_story_position'),
    )
    op.add_column('sentences', sa.Column('chapter_id', postgresql.UUID(as_uuid=True), nullable=True))

    # Every existing story becomes a single-chapter story
    op.execute("""
        INSERT INTO chapters (id, story_id, position)
        SELECT gen_random_uuid(), id, 1 FROM stories
    """)
    op.execute("""
        UPDATE sentences SET chapter_id = chapters.id
        FROM chapters WHERE chapters.story_id = sentences.story_id
    """)

    op.alter_column('sentences', 'chapter_id', nullable=False)
    op.create_foreign_key('fk_sentences_chapter_id', 'sentences', 'chapters', ['chapter_id'], ['id'])
    op.create_index('ix_sentences_chapter_id', 'sentences', ['chapter_id'])


def downgrade() -> None:
    op.drop_index('ix_sentences_chapter_id', table_name='sentences')
    op.drop_constraint('fk_sentences_chapter_id', 'sentences', type_='foreignkey')
    op.drop_column('sentences', 'chapter_id')
    op.drop_table('chapters')
