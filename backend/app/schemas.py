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
    word_audio_path: Optional[str] = None


# ── Sentence-level ────────────────────────────────────────────────────────────

class SentenceOut(BaseModel):
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

class StoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    title_hi: str
    author: str


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

class BookmarkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    story_id: uuid.UUID
    sentence_id: uuid.UUID
    updated_at: datetime


# ── Statistics ────────────────────────────────────────────────────────────────

class StatsOut(BaseModel):
    unique_surface_forms_read: int
    unique_lemmas_read: int
