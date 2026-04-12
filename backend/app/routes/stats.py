import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import SentenceWord, User, UserWordRead
from app.routes.auth import get_current_user
from app.schemas import StatsOut, WordStatOut

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


@router.get("/words", response_model=list[WordStatOut])
async def get_word_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[WordStatOut]:
    """Return play counts per unique surface form for the authenticated user."""
    from sqlalchemy import and_

    # Get counts per surface form
    counts = await db.execute(
        select(
            SentenceWord.surface_devanagari,
            SentenceWord.surface_romanized,
            SentenceWord.english_gloss,
            func.count().label("play_count"),
        )
        .join(UserWordRead, UserWordRead.sentence_word_id == SentenceWord.id)
        .where(UserWordRead.user_id == current_user.id)
        .group_by(
            SentenceWord.surface_devanagari,
            SentenceWord.surface_romanized,
            SentenceWord.english_gloss,
        )
    )
    count_rows = list(counts)

    # For each surface form, get one representative word with audio
    results = []
    for row in count_rows:
        word_row = await db.execute(
            select(SentenceWord)
            .where(
                and_(
                    SentenceWord.surface_devanagari == row.surface_devanagari,
                    SentenceWord.surface_romanized == row.surface_romanized,
                    SentenceWord.english_gloss == row.english_gloss,
                )
            )
            .limit(1)
        )
        word = word_row.scalar_one_or_none()
        results.append(
            WordStatOut(
                surface_devanagari=row.surface_devanagari,
                surface_romanized=row.surface_romanized,
                english_gloss=row.english_gloss,
                play_count=row.play_count,
                word_audio_path=word.word_audio_path if word else None,
                sentence_word_id=str(word.id) if word else None,
            )
        )

    return results
