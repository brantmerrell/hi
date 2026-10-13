import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr


# ── Word-level ────────────────────────────────────────────────────────────────

class SentenceWordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    position: int
    surface_devanagari: str
    surface_romanized: str
    english_gloss: str
    word_sense_definition: Optional[str] = None
    word_sense_id: Optional[uuid.UUID] = None
    note: Optional[str] = None
    word_audio_path: Optional[str] = None
    start_ms: Optional[int] = None


# ── Sentence-level ────────────────────────────────────────────────────────────

class SentenceListOut(BaseModel):
    """Sentence without word data — used in list endpoints."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    story_id: uuid.UUID
    sequence_num: int
    devanagari: str
    romanized: str
    english: str
    audio_path: Optional[str] = None


class SentenceOut(BaseModel):
    """Sentence with full word alignment data — used in single-sentence endpoint."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    story_id: uuid.UUID
    sequence_num: int
    devanagari: str
    romanized: str
    english: str
    audio_path: Optional[str] = None
    words: list[SentenceWordOut] = []


# ── Story-level ───────────────────────────────────────────────────────────────

class ChapterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    position: int
    title_hi: Optional[str] = None
    title_en: Optional[str] = None
    source_url: Optional[str] = None


class StoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    position: Optional[int] = None
    title_hi: str
    title_en: Optional[str] = None
    author: str
    author_slug: str
    source_url: str
    chapters: list[ChapterOut] = []


# ── Notes ─────────────────────────────────────────────────────────────────────

class WordSenseNoteIn(BaseModel):
    display_gloss: str


# ── User / Auth ───────────────────────────────────────────────────────────────

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    display_name: Optional[str] = None


class AuthRequest(BaseModel):
    """Body for POST /auth/request — caller supplies their email address."""

    email: str


# ── Bookmarks ─────────────────────────────────────────────────────────────────

class BookmarkIn(BaseModel):
    sentence_id: uuid.UUID


class BookmarkOut(BaseModel):
    story_id: uuid.UUID
    author_slug: str
    story_position: Optional[int]
    chapter_position: int
    sentence_id: uuid.UUID
    sentence_seq_num: int
    updated_at: datetime


# ── Statistics ────────────────────────────────────────────────────────────────

class WordStatOut(BaseModel):
    """Individual word statistics for display in a word list."""

    surface_devanagari: str
    surface_romanized: str
    english_gloss: str
    word_sense_definition: Optional[str] = None
    note: Optional[str] = None
    word_sense_id: Optional[str] = None
    play_count: int
    word_audio_path: str | None = None
    sentence_word_id: str | None = None


class StatsOut(BaseModel):
    """Overall reading statistics for the current user across all stories."""

    unique_surface_forms_read: int
    unique_lemmas_read: int
