import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Author, Sentence, Story
from app.schemas import SentenceListOut, StoryOut

router = APIRouter()


@router.get("", response_model=list[StoryOut])
async def list_stories(
    author: Annotated[str | None, Query(description="Filter by author slug")] = None,
    db: AsyncSession = Depends(get_db),
) -> list[Story]:
    """Return stories ordered by author slug, then position."""
    query = select(Story).join(Author, Author.id == Story.author_id)
    if author is not None:
        query = query.where(Author.slug == author)
    result = await db.execute(
        query.order_by(Author.slug.asc(), Story.position.asc().nulls_last(), Story.created_at.asc())
    )
    return list(result.scalars().all())


@router.get("/{story_id}/sentences", response_model=list[SentenceListOut])
async def list_story_sentences(
    story_id: uuid.UUID,
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    db: AsyncSession = Depends(get_db),
) -> list[Sentence]:
    """Return paginated sentences for a story, each with their word alignments."""
    # Verify story exists
    story = await db.get(Story, story_id)
    if story is None:
        raise HTTPException(status_code=404, detail="Story not found")

    result = await db.execute(
        select(Sentence)
        .where(Sentence.story_id == story_id)
        .order_by(Sentence.sequence_num)
        .offset(offset)
        .limit(limit)
    )
    return list(result.scalars().all())
