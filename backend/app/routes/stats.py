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


@router.get("/words")
async def get_word_stats(
    limit: int = 10,
    offset: int = 0,
    min_reviews: int = 0,
    max_reviews: int = 999999,
    sort_by: str = "count",
    sort_order: str = "desc",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return paginated play counts per unique surface form across all stories for the user."""

    # Build the base counts query with filtering (no story filter - global stats)
    counts_query = select(
        SentenceWord.surface_devanagari,
        SentenceWord.surface_romanized,
        func.count(UserWordRead.id).label("play_count"),
    ).outerjoin(
        UserWordRead,
        and_(
            UserWordRead.sentence_word_id == SentenceWord.id,
            UserWordRead.user_id == current_user.id,
        ),
    ).group_by(
        SentenceWord.surface_devanagari,
        SentenceWord.surface_romanized,
    ).having(
        func.count(UserWordRead.id).between(min_reviews, max_reviews)
    )

    # Build sort clause
    sort_is_desc = sort_order == "desc"
    if sort_by == "devanagari":
        order_clause = SentenceWord.surface_devanagari.desc() if sort_is_desc else SentenceWord.surface_devanagari
    elif sort_by == "romanized":
        order_clause = SentenceWord.surface_romanized.desc() if sort_is_desc else SentenceWord.surface_romanized
    elif sort_by == "english":
        order_clause = func.max(func.coalesce(SentenceWord.english_gloss, "")).desc() if sort_is_desc else func.max(func.coalesce(SentenceWord.english_gloss, ""))
    else:  # count
        order_clause = func.count(UserWordRead.id).desc() if sort_is_desc else func.count(UserWordRead.id)

    # Get summary stats using the same filtered query
    counts_sq = counts_query.subquery()
    summary_result = await db.execute(
        select(
            func.count().label("count"),
            func.avg(counts_sq.c.play_count).label("mean"),
            func.min(counts_sq.c.play_count).label("min"),
            func.max(counts_sq.c.play_count).label("max"),
        ).select_from(counts_sq)
    )
    summary_row = summary_result.one()
    summary = {
        "count": summary_row.count or 0,
        "mean": float(summary_row.mean) if summary_row.mean is not None else 0,
        "min": summary_row.min or 0,
        "max": summary_row.max or 0,
    }

    # Get paginated counts sorted
    page_result = await db.execute(
        counts_query.order_by(order_clause).offset(offset).limit(limit)
    )
    page_rows = list(page_result)
    page_surface_forms = [(row.surface_devanagari, row.surface_romanized) for row in page_rows]
    play_counts = {(row.surface_devanagari, row.surface_romanized): row.play_count for row in page_rows}

    # Fetch best word for each surface form in one batch query
    if page_surface_forms:
        words_result = await db.execute(
            select(SentenceWord).where(
                and_(
                    SentenceWord.surface_devanagari.in_([sf[0] for sf in page_surface_forms]),
                    SentenceWord.surface_romanized.in_([sf[1] for sf in page_surface_forms]),
                )
            ).order_by(
                SentenceWord.surface_devanagari,
                SentenceWord.surface_romanized,
                func.length(SentenceWord.english_gloss).desc(),
            )
        )
        words = words_result.scalars().all()

        # Pick best word per surface form (prefer non-empty gloss)
        best_words = {}
        for word in words:
            key = (word.surface_devanagari, word.surface_romanized)
            if key not in best_words:
                best_words[key] = word
            elif word.english_gloss and not best_words[key].english_gloss:
                best_words[key] = word
    else:
        best_words = {}

    # Build results in the correct order
    results = []
    for surface_form in page_surface_forms:
        word = best_words.get(surface_form)
        if word:
            results.append(
                WordStatOut(
                    surface_devanagari=word.surface_devanagari,
                    surface_romanized=word.surface_romanized,
                    english_gloss=word.english_gloss,
                    play_count=play_counts[surface_form],
                    word_audio_path=word.word_audio_path,
                    sentence_word_id=str(word.id),
                )
            )

    return {
        "words": results,
        "summary": summary,
        "offset": offset,
        "limit": limit,
        "total": summary["count"],
    }
