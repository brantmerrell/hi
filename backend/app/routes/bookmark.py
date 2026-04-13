import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Bookmark, Sentence, Story, User
from app.routes.auth import get_current_user
from app.schemas import BookmarkIn, BookmarkOut

router = APIRouter()


@router.get("/{story_id}", response_model=BookmarkOut)
async def get_bookmark(
    story_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Bookmark:
    bookmark = await db.get(Bookmark, (current_user.id, story_id))
    if bookmark is None:
        raise HTTPException(status_code=404, detail="No bookmark for this story")
    return bookmark


@router.put("/{story_id}", response_model=BookmarkOut)
async def upsert_bookmark(
    story_id: uuid.UUID,
    body: BookmarkIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Bookmark:
    if await db.get(Story, story_id) is None:
        raise HTTPException(status_code=404, detail="Story not found")
    if await db.get(Sentence, body.sentence_id) is None:
        raise HTTPException(status_code=404, detail="Sentence not found")

    bookmark = await db.get(Bookmark, (current_user.id, story_id))
    if bookmark is None:
        bookmark = Bookmark(
            user_id=current_user.id,
            story_id=story_id,
            sentence_id=body.sentence_id,
        )
        db.add(bookmark)
    else:
        bookmark.sentence_id = body.sentence_id
    await db.flush()
    await db.refresh(bookmark)
    return bookmark
