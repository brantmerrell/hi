import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import SentenceWord, User, UserWordRead
from app.routes.auth import get_current_user
from app.schemas import StatsOut

router = APIRouter()


@router.get("/me", response_model=StatsOut)
async def get_my_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StatsOut:
    """Return vocabulary reading statistics for the authenticated user."""

    # Unique surface forms (distinct sentence_word_ids read)
    surface_result = await db.execute(
        select(func.count(func.distinct(UserWordRead.sentence_word_id))).where(
            UserWordRead.user_id == current_user.id
        )
    )
    unique_surface_forms: int = surface_result.scalar_one() or 0

    # Unique lemmas — join through SentenceWord to pick up lemma_id
    lemma_result = await db.execute(
        select(func.count(func.distinct(SentenceWord.lemma_id)))
        .join(UserWordRead, UserWordRead.sentence_word_id == SentenceWord.id)
        .where(
            UserWordRead.user_id == current_user.id,
            SentenceWord.lemma_id.is_not(None),
        )
    )
    unique_lemmas: int = lemma_result.scalar_one() or 0

    return StatsOut(
        unique_surface_forms_read=unique_surface_forms,
        unique_lemmas_read=unique_lemmas,
    )
