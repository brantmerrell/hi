import uuid
from typing import Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Sentence, SentenceWord, User, UserWordRead
from app.routes.auth import get_current_user
from app.schemas import SentenceOut

router = APIRouter()


@router.post("/{sentence_id}/played")
async def record_played(
    sentence_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Log one UserWordRead per word in the sentence for the current user."""
    result = await db.execute(
        select(SentenceWord)
        .where(SentenceWord.sentence_id == sentence_id)
        .order_by(SentenceWord.position)
    )
    words = list(result.scalars().all())
    if not words:
        raise HTTPException(status_code=404, detail="Sentence not found or has no words")

    for word in words:
        db.add(UserWordRead(user_id=current_user.id, sentence_word_id=word.id))

    return {"logged": len(words)}


@router.post("/words/{word_id}/played")
async def record_word_played(
    word_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Log one UserWordRead for a single word."""
    word = await db.get(SentenceWord, word_id)
    if word is None:
        raise HTTPException(status_code=404, detail="Word not found")

    db.add(UserWordRead(user_id=current_user.id, sentence_word_id=word.id))
    return {"logged": 1}


@router.get("/{sentence_id}", response_model=SentenceOut)
async def get_sentence(
    sentence_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> Sentence:
    """Return a single sentence including its word-level alignment data."""
    result = await db.execute(
        select(Sentence)
        .where(Sentence.id == sentence_id)
        .options(selectinload(Sentence.words).selectinload(SentenceWord.word_sense))
    )
    sentence = result.scalar_one_or_none()
    if sentence is None:
        raise HTTPException(status_code=404, detail="Sentence not found")
    return sentence
