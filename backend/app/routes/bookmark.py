import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Bookmark, Sentence, Story, User
from app.routes.auth import get_current_user
from app.schemas import BookmarkIn, BookmarkOut

router = APIRouter()


async def _bookmark_out(bookmark: Bookmark, db: AsyncSession) -> BookmarkOut:
    result = await db.execute(
        select(Story.position, Sentence.sequence_num)
        .select_from(Sentence)
        .join(Story, Story.id == bookmark.story_id)
        .where(Sentence.id == bookmark.sentence_id)
    )
    row = result.first()
    if row is None:
        raise HTTPException(status_code=500, detail="Bookmark references missing data")
    return BookmarkOut(
        story_id=bookmark.story_id,
        story_position=row.position,
        sentence_id=bookmark.sentence_id,
        sentence_seq_num=row.sequence_num,
        updated_at=bookmark.updated_at,
    )


@router.get("", response_model=BookmarkOut)
async def get_bookmark(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BookmarkOut:
    bookmark = await db.get(Bookmark, current_user.id)
    if bookmark is None:
        raise HTTPException(status_code=404, detail="No bookmark")
    return await _bookmark_out(bookmark, db)


@router.put("", response_model=BookmarkOut)
async def upsert_bookmark(
    body: BookmarkIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BookmarkOut:
    sentence = await db.get(Sentence, body.sentence_id)
    if sentence is None:
        raise HTTPException(status_code=404, detail="Sentence not found")

    bookmark = await db.get(Bookmark, current_user.id)
    if bookmark is None:
        bookmark = Bookmark(
            user_id=current_user.id,
            story_id=sentence.story_id,
            sentence_id=body.sentence_id,
        )
        db.add(bookmark)
    else:
        bookmark.story_id = sentence.story_id
        bookmark.sentence_id = body.sentence_id
    await db.flush()
    await db.refresh(bookmark)
    return await _bookmark_out(bookmark, db)
