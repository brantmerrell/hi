import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


class Story(Base):
    __tablename__ = "stories"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    position: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, unique=True)
    title_hi: Mapped[str] = mapped_column(String, nullable=False)
    title_en: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    author: Mapped[str] = mapped_column(String, nullable=False)
    source_url: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    sentences: Mapped[list["Sentence"]] = relationship(
        "Sentence", back_populates="story", order_by="Sentence.sequence_num"
    )
    bookmarks: Mapped[list["Bookmark"]] = relationship("Bookmark", back_populates="story")


class Sentence(Base):
    __tablename__ = "sentences"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    story_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stories.id"), nullable=False
    )
    sequence_num: Mapped[int] = mapped_column(Integer, nullable=False)
    devanagari: Mapped[str] = mapped_column(Text, nullable=False)
    romanized: Mapped[str] = mapped_column(Text, nullable=False)
    english: Mapped[str] = mapped_column(Text, nullable=False)
    audio_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    story: Mapped["Story"] = relationship("Story", back_populates="sentences")
    words: Mapped[list["SentenceWord"]] = relationship(
        "SentenceWord", back_populates="sentence", order_by="SentenceWord.position"
    )
    bookmarks: Mapped[list["Bookmark"]] = relationship("Bookmark", back_populates="sentence")
    user_sentence_reads: Mapped[list["UserSentenceRead"]] = relationship(
        "UserSentenceRead", back_populates="sentence"
    )


class Lemma(Base):
    __tablename__ = "lemmas"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    devanagari: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    romanized: Mapped[str] = mapped_column(String, nullable=False)
    part_of_speech: Mapped[str] = mapped_column(String, nullable=False)
    # masculine, feminine, variable, unknown
    gender: Mapped[str] = mapped_column(String, nullable=False, default="unknown")

    senses: Mapped[list["WordSense"]] = relationship("WordSense", back_populates="lemma")
    sentence_words: Mapped[list["SentenceWord"]] = relationship(
        "SentenceWord", back_populates="lemma"
    )


class WordSense(Base):
    __tablename__ = "word_senses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    lemma_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lemmas.id"), nullable=False
    )
    english_definition: Mapped[str] = mapped_column(Text, nullable=False)
    usage_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    lemma: Mapped["Lemma"] = relationship("Lemma", back_populates="senses")
    note: Mapped[Optional["WordSenseNote"]] = relationship("WordSenseNote", back_populates="word_sense", uselist=False)
    sentence_words: Mapped[list["SentenceWord"]] = relationship(
        "SentenceWord", back_populates="word_sense"
    )


class SentenceWord(Base):
    __tablename__ = "sentence_words"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    sentence_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sentences.id"), nullable=False
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    surface_devanagari: Mapped[str] = mapped_column(String, nullable=False)
    surface_romanized: Mapped[str] = mapped_column(String, nullable=False)
    english_gloss: Mapped[str] = mapped_column(String, nullable=False)
    lemma_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lemmas.id"), nullable=True
    )
    word_sense_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("word_senses.id"), nullable=True
    )
    word_audio_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    sentence: Mapped["Sentence"] = relationship("Sentence", back_populates="words")
    lemma: Mapped[Optional["Lemma"]] = relationship("Lemma", back_populates="sentence_words")
    word_sense: Mapped[Optional["WordSense"]] = relationship(
        "WordSense", back_populates="sentence_words"
    )
    user_word_reads: Mapped[list["UserWordRead"]] = relationship(
        "UserWordRead", back_populates="sentence_word"
    )

    @property
    def word_sense_definition(self) -> Optional[str]:
        if self.word_sense is not None:
            return self.word_sense.english_definition
        return None

    @property
    def note(self) -> Optional[str]:
        if self.word_sense is not None and self.word_sense.note is not None:
            return self.word_sense.note.display_gloss
        return None


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    display_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    magic_links: Mapped[list["MagicLink"]] = relationship("MagicLink", back_populates="user")
    bookmarks: Mapped[list["Bookmark"]] = relationship("Bookmark", back_populates="user")
    word_reads: Mapped[list["UserWordRead"]] = relationship("UserWordRead", back_populates="user")
    sentence_reads: Mapped[list["UserSentenceRead"]] = relationship(
        "UserSentenceRead", back_populates="user"
    )


class MagicLink(Base):
    __tablename__ = "magic_links"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    token: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="magic_links")


class Bookmark(Base):
    __tablename__ = "bookmarks"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True
    )
    story_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stories.id"), nullable=False
    )
    sentence_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sentences.id"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="bookmarks")
    story: Mapped["Story"] = relationship("Story", back_populates="bookmarks")
    sentence: Mapped["Sentence"] = relationship("Sentence", back_populates="bookmarks")


class WordSenseNote(Base):
    __tablename__ = "word_sense_notes"

    word_sense_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("word_senses.id"), primary_key=True
    )
    display_gloss: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    word_sense: Mapped["WordSense"] = relationship("WordSense", back_populates="note")


class UserWordRead(Base):
    __tablename__ = "user_word_reads"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    sentence_word_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sentence_words.id"), nullable=False
    )
    read_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="word_reads")
    sentence_word: Mapped["SentenceWord"] = relationship(
        "SentenceWord", back_populates="user_word_reads"
    )


class UserSentenceRead(Base):
    __tablename__ = "user_sentence_reads"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    sentence_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sentences.id"), nullable=False
    )
    read_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="sentence_reads")
    sentence: Mapped["Sentence"] = relationship(
        "Sentence", back_populates="user_sentence_reads"
    )
