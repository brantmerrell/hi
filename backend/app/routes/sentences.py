import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Sentence, SentenceWord
from app.schemas import SentenceOut

router = APIRouter()


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
