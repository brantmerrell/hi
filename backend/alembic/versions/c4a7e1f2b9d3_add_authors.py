"""add_authors

Revision ID: c4a7e1f2b9d3
Revises: 93dac12a8a04
Create Date: 2026-10-11 15:30:00.000000

"""
import re
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'c4a7e1f2b9d3'
down_revision: Union[str, None] = '93dac12a8a04'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _slugify(name: str, taken: set[str]) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    # Purely numeric (or empty) slugs would collide with legacy /{storyNum} URLs
    if not base or base.isdigit():
        base = f"author-{base}" if base else "author"
    slug, n = base, 2
    while slug in taken:
        slug = f"{base}-{n}"
        n += 1
    taken.add(slug)
    return slug


def upgrade() -> None:
    op.create_table(
        'authors',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('slug', sa.String(), nullable=False, unique=True),
        sa.Column('name_hi', sa.String(), nullable=True),
        sa.Column('name_en', sa.String(), nullable=False),
    )
    op.add_column('stories', sa.Column('author_id', postgresql.UUID(as_uuid=True), nullable=True))

    conn = op.get_bind()
    names = [r[0] for r in conn.execute(sa.text("SELECT DISTINCT author FROM stories ORDER BY author"))]
    taken: set[str] = set()
    for name in names:
        author_id = uuid.uuid4()
        conn.execute(
            sa.text("INSERT INTO authors (id, slug, name_en) VALUES (:id, :slug, :name)"),
            {"id": author_id, "slug": _slugify(name, taken), "name": name},
        )
        conn.execute(
            sa.text("UPDATE stories SET author_id = :id WHERE author = :name"),
            {"id": author_id, "name": name},
        )

    op.alter_column('stories', 'author_id', nullable=False)
    op.create_foreign_key('fk_stories_author_id', 'stories', 'authors', ['author_id'], ['id'])
    op.drop_constraint('uq_story_position', 'stories', type_='unique')
    op.create_unique_constraint('uq_story_author_position', 'stories', ['author_id', 'position'])
    op.drop_column('stories', 'author')


def downgrade() -> None:
    op.add_column('stories', sa.Column('author', sa.String(), nullable=True))
    op.execute("UPDATE stories SET author = authors.name_en FROM authors WHERE authors.id = stories.author_id")
    op.alter_column('stories', 'author', nullable=False)
    op.drop_constraint('uq_story_author_position', 'stories', type_='unique')
    # Restoring global uniqueness may fail if positions now overlap across authors
    op.create_unique_constraint('uq_story_position', 'stories', ['position'])
    op.drop_constraint('fk_stories_author_id', 'stories', type_='foreignkey')
    op.drop_column('stories', 'author_id')
    op.drop_table('authors')
