import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.models import Sentence, SentenceWord, User, UserWordRead
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


@router.get("/words/{story_id}")
async def get_word_stats(
    story_id: uuid.UUID,
    limit: int = 10,
    offset: int = 0,
    min_reviews: int = 0,
    max_reviews: int = 999999,
    sort_by: str = "count",
    sort_order: str = "desc",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return paginated play counts per unique surface form for a story."""
    # Get all unique surface forms for this story with their play counts (group by surface form only)
    words_with_counts = await db.execute(
        select(
            SentenceWord.surface_devanagari,
            SentenceWord.surface_romanized,
            func.count(UserWordRead.id).label("play_count"),
        )
        .join(Sentence, SentenceWord.sentence_id == Sentence.id)
        .outerjoin(
            UserWordRead,
            and_(
                UserWordRead.sentence_word_id == SentenceWord.id,
                UserWordRead.user_id == current_user.id,
            ),
        )
        .where(Sentence.story_id == story_id)
        .group_by(
            SentenceWord.surface_devanagari,
            SentenceWord.surface_romanized,
        )
    )
    count_rows = list(words_with_counts)

    # Filter by review count range
    filtered_rows = [r for r in count_rows if min_reviews <= r.play_count <= max_reviews]

    # Calculate summary stats from all filtered results
    summary = {
        "count": len(filtered_rows),
        "mean": (sum(r.play_count for r in filtered_rows) / len(filtered_rows)) if filtered_rows else 0,
        "min": min((r.play_count for r in filtered_rows), default=0),
        "max": max((r.play_count for r in filtered_rows), default=0),
    }

    # For each filtered word, get representative sentence_word with best english_gloss
    # We fetch all words first so we can sort the complete set before pagination
    all_results = []
    for row in filtered_rows:
        # Try to get a word with a non-empty english_gloss first
        word_row = await db.execute(
            select(SentenceWord)
            .join(Sentence, SentenceWord.sentence_id == Sentence.id)
            .where(
                and_(
                    Sentence.story_id == story_id,
                    SentenceWord.surface_devanagari == row.surface_devanagari,
                    SentenceWord.surface_romanized == row.surface_romanized,
                    SentenceWord.english_gloss.is_not(None),
                    SentenceWord.english_gloss != "",
                )
            )
            .order_by(func.length(SentenceWord.english_gloss).desc())
            .limit(1)
        )
        word = word_row.scalar_one_or_none()

        # If no non-empty gloss found, get any word with this surface form
        if word is None:
            word_row = await db.execute(
                select(SentenceWord)
                .join(Sentence, SentenceWord.sentence_id == Sentence.id)
                .where(
                    and_(
                        Sentence.story_id == story_id,
                        SentenceWord.surface_devanagari == row.surface_devanagari,
                        SentenceWord.surface_romanized == row.surface_romanized,
                    )
                )
                .limit(1)
            )
            word = word_row.scalar_one_or_none()

        all_results.append(
            WordStatOut(
                surface_devanagari=row.surface_devanagari,
                surface_romanized=row.surface_romanized,
                english_gloss=word.english_gloss if word else None,
                play_count=row.play_count,
                word_audio_path=word.word_audio_path if word else None,
                sentence_word_id=str(word.id) if word else None,
            )
        )

    # Sort the complete results
    reverse = (sort_order == "desc")
    if sort_by == "devanagari":
        all_results.sort(key=lambda r: r.surface_devanagari, reverse=reverse)
    elif sort_by == "romanized":
        all_results.sort(key=lambda r: r.surface_romanized, reverse=reverse)
    elif sort_by == "english":
        all_results.sort(key=lambda r: r.english_gloss or "", reverse=reverse)
    else:  # count
        all_results.sort(key=lambda r: r.play_count, reverse=reverse)

    # Get paginated slice from sorted results
    paginated_results = all_results[offset : offset + limit]

    return {
        "words": paginated_results,
        "summary": summary,
        "offset": offset,
        "limit": limit,
        "total": summary["count"],
    }
