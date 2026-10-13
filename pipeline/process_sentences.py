"""
process_sentences.py — Segment, translate, romanize, and insert a story into the database.

Usage:
    python process_sentences.py <slug> --position <n> [--chapter <c>]

Example:
    python process_sentences.py story-938-94c-924 --position 2

The slug must match a file pair in data/raw/<slug>.txt and data/raw/<slug>.json,
created by fetch_text.py. --position is the story (book) position for the author.
Without --chapter, it must be unused and a new single-chapter story is created. With
--chapter, the text is added as that chapter of the existing story at --position
(or, if no story is there yet, of a new one titled by the fetched page).

This script:
  1. Segments the raw text into sentences on Devanagari danda (।) and standard punctuation.
  2. Translates each sentence to English via the provider chosen by TRANSLATOR
     (google by default, or azure). Azure also gives word-level alignment, which
     is used for word glosses; otherwise each word is translated on its own.
  3. Calls Aksharamukha to romanize each sentence and each surface word form.
  4. Inserts Story, Sentence, and SentenceWord rows into PostgreSQL.
  5. Skips TTS audio — audio_path is left NULL and can be filled in later.

Requires environment variables: DATABASE_URL, plus GOOGLE_CLOUD_API_KEY (TRANSLATOR=google)
or AZURE_TRANSLATOR_KEY and AZURE_TRANSLATOR_REGION (TRANSLATOR=azure)
"""

import argparse
import json
import os
import re
import sys
import uuid
from pathlib import Path

import psycopg2
from aksharamukha import transliterate
from dotenv import load_dotenv

from translators import Translator, get_translator

load_dotenv(Path(__file__).parent.parent / "backend" / ".env")

DATA_DIR = Path(__file__).parent.parent / "data" / "raw"


# ---------------------------------------------------------------------------
# Sentence segmentation
# ---------------------------------------------------------------------------

def segment_sentences(text: str) -> list[str]:
    """
    Split Devanagari prose into sentences.

    Splits on:
      - । (danda, U+0964) — primary Hindi sentence terminator
      - ॥ (double danda, U+0965) — used in verse / formal prose
      - ! and ? — also used by Premchand
      - . followed by whitespace — used in some Premchand texts

    Filters out segments shorter than 10 characters (stray punctuation artifacts).
    """
    parts = re.split(r"[।॥!?]+|\.(?=\s)", text)
    sentences = [s.strip() for s in parts if len(s.strip()) >= 10]
    return sentences


# ---------------------------------------------------------------------------
# Word glosses
# ---------------------------------------------------------------------------

def parse_alignment(proj: str) -> list[tuple[int, int, int, int]]:
    """
    Parse an Azure alignment projection string into a list of offset tuples.

    Each tuple is (src_start, src_end, tgt_start, tgt_end) — character offsets,
    0-indexed and inclusive on both ends.
    """
    if not proj:
        return []
    pairs = []
    for token in proj.split():
        src, tgt = token.split("-")
        s0, s1 = map(int, src.split(":"))
        t0, t1 = map(int, tgt.split(":"))
        pairs.append((s0, s1, t0, t1))
    return pairs


def word_glosses(hindi: str, english: str, alignment: list[tuple]) -> list[tuple[str, str]]:
    """
    Produce a list of (surface_hindi_word, english_gloss) pairs.

    Tokenizes the Hindi sentence on whitespace, then finds the English substring
    that each Hindi word aligns to according to Azure's character-offset alignment.
    Words with no alignment entry get an empty gloss.
    """
    words = hindi.split()
    # Map each word to its character range in the original string
    word_ranges = []
    pos = 0
    for word in words:
        start = hindi.find(word, pos)
        end = start + len(word) - 1
        word_ranges.append((start, end, word))
        pos = end + 1

    result = []
    for w_start, w_end, word in word_ranges:
        tgt_parts = []
        for s0, s1, t0, t1 in alignment:
            # Overlap: source alignment range touches this word's range
            if s0 <= w_end and s1 >= w_start:
                tgt_parts.append(english[t0 : t1 + 1])
        gloss = " ".join(tgt_parts)
        result.append((word, gloss))
    return result


def glosses_for_sentence(translator: Translator, sentence: str, english: str, alignment_proj: str) -> list[tuple[str, str]]:
    """Word glosses from provider alignment when available, else per-word translation."""
    if translator.supports_alignment:
        return word_glosses(sentence, english, parse_alignment(alignment_proj))
    words = sentence.split()
    translations = translator.translate_batch(words) if words else []
    return list(zip(words, translations))


# ---------------------------------------------------------------------------
# Romanization via Aksharamukha
# ---------------------------------------------------------------------------

def romanize(devanagari: str) -> str:
    """Transliterate Devanagari to IAST romanization using Aksharamukha."""
    return transliterate.process("Devanagari", "IAST", devanagari)


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

def get_connection(database_url: str):
    """
    Create a psycopg2 connection from a SQLAlchemy-style DATABASE_URL.
    Converts postgresql+asyncpg:// to postgresql:// for psycopg2.
    """
    url = database_url.replace("postgresql+asyncpg://", "postgresql://")
    return psycopg2.connect(url)


def upsert_author(cur, meta: dict) -> str:
    """Insert author if not present (match on slug). Return author UUID."""
    slug = meta.get("author_slug", "munshi-premchand")
    cur.execute("SELECT id FROM authors WHERE slug = %s", (slug,))
    row = cur.fetchone()
    if row:
        return row[0]
    author_id = str(uuid.uuid4())
    cur.execute(
        "INSERT INTO authors (id, slug, name_hi, name_en) VALUES (%s, %s, %s, %s)",
        (author_id, slug, meta.get("author_hi"), meta["author"]),
    )
    return author_id


def upsert_story(cur, meta: dict, title_en: str, position: int) -> str:
    """Insert story if not present (match on source_url). Return story UUID."""
    cur.execute("SELECT id FROM stories WHERE source_url = %s", (meta["source_url"],))
    row = cur.fetchone()
    if row:
        return row[0]
    story_id = str(uuid.uuid4())
    author_id = upsert_author(cur, meta)
    cur.execute(
        """
        INSERT INTO stories (id, position, title_hi, title_en, author_id, source_url)
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (story_id, position, meta["title_hi"], title_en, author_id, meta["source_url"]),
    )
    return story_id


def find_story(cur, author_slug: str, position: int) -> str | None:
    cur.execute(
        "SELECT s.id FROM stories s JOIN authors a ON a.id = s.author_id WHERE a.slug = %s AND s.position = %s",
        (author_slug, position),
    )
    row = cur.fetchone()
    return row[0] if row else None


def create_chapter(
    cur, story_id: str, position: int, title_hi: str | None, title_en: str | None, source_url: str
) -> str:
    """Insert a chapter and return its UUID."""
    chapter_id = str(uuid.uuid4())
    cur.execute(
        """
        INSERT INTO chapters (id, story_id, position, title_hi, title_en, source_url)
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (chapter_id, story_id, position, title_hi, title_en, source_url),
    )
    return chapter_id


def insert_sentence(cur, story_id: str, chapter_id: str, seq: int, deva: str, roman: str, english: str) -> str:
    """Insert a sentence row. Returns sentence UUID."""
    sentence_id = str(uuid.uuid4())
    cur.execute(
        """
        INSERT INTO sentences (id, story_id, chapter_id, sequence_num, devanagari, romanized, english)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT DO NOTHING
        """,
        (sentence_id, story_id, chapter_id, seq, deva, roman, english),
    )
    return sentence_id


def _is_content_word(surface_deva: str) -> bool:
    """Return False for zero-width spaces, punctuation-only, or whitespace-only tokens."""
    import unicodedata
    stripped = surface_deva.strip()
    if not stripped:
        return False
    # Reject if every character is punctuation, whitespace, or a zero-width/format char
    for ch in stripped:
        cat = unicodedata.category(ch)
        if cat.startswith("L") or cat.startswith("N") or cat.startswith("M"):
            return True  # has at least one letter, digit, or combining mark
    return False


def insert_sentence_words(cur, sentence_id: str, glosses: list[tuple[str, str]]) -> None:
    """Insert SentenceWord rows for each word in a sentence."""
    position = 0
    for surface_deva, english_gloss in glosses:
        if not _is_content_word(surface_deva):
            continue
        surface_roman = romanize(surface_deva)
        cur.execute(
            """
            INSERT INTO sentence_words
                (id, sentence_id, position, surface_devanagari, surface_romanized, english_gloss)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (str(uuid.uuid4()), sentence_id, position, surface_deva, surface_roman, english_gloss),
        )
        position += 1


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Process and insert a story into the database.")
    parser.add_argument("slug", help="Slug matching data/raw/<slug>.txt and .json")
    parser.add_argument("--position", type=int, required=True, help="Story (book) position, unique per author")
    parser.add_argument("--chapter", type=int, help="Add as this chapter of the story at --position")
    args = parser.parse_args()

    slug = args.slug.lstrip("-")
    position = args.position

    text_path = DATA_DIR / f"{slug}.txt"
    meta_path = DATA_DIR / f"{slug}.json"

    if not text_path.exists():
        print(f"Error: {text_path} not found. Run fetch_text.py first.")
        sys.exit(1)

    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    text = text_path.read_text(encoding="utf-8")

    database_url = os.environ.get("DATABASE_URL")

    if not database_url:
        print("Error: DATABASE_URL not set in environment")
        sys.exit(1)
    translator = get_translator()

    conn = get_connection(database_url)
    cur = conn.cursor()

    author_slug = meta.get("author_slug", "munshi-premchand")
    existing_story_id = find_story(cur, author_slug, position)
    if args.chapter is None and existing_story_id:
        print(f"Error: story position {position} is already used for this author; pass --chapter to add to it")
        cur.close()
        conn.close()
        sys.exit(1)
    if args.chapter is not None and existing_story_id:
        cur.execute(
            "SELECT 1 FROM chapters WHERE story_id = %s AND position = %s", (existing_story_id, args.chapter)
        )
        if cur.fetchone():
            print(f"Error: chapter {args.chapter} already exists for that story")
            cur.close()
            conn.close()
            sys.exit(1)

    # Translate the title (the chapter name when adding a chapter, e.g. 'सप्तसरोज/उपदेश' -> 'उपदेश')
    chapter_title_hi = meta["title_hi"].split("/")[-1].replace("_", " ").strip()
    print(f"Translating title '{meta['title_hi']}'...")
    try:
        title_en, _ = translator.translate(meta["title_hi"])
        chapter_title_en, _ = translator.translate(chapter_title_hi)
    except Exception as e:
        print(f"Error translating title: {e}")
        cur.close()
        conn.close()
        sys.exit(1)
    print(f"Title (EN): {title_en}")

    sentences = segment_sentences(text)
    print(f"Found {len(sentences)} sentences in {slug}")

    story_id = existing_story_id or upsert_story(cur, meta, title_en, position)
    if args.chapter is None:
        chapter_id = create_chapter(cur, story_id, 1, None, None, meta["source_url"])
    else:
        chapter_id = create_chapter(
            cur, story_id, args.chapter, chapter_title_hi, chapter_title_en, meta["source_url"]
        )
    conn.commit()
    print(f"Story ID: {story_id}")

    for seq, sentence in enumerate(sentences):
        print(f"  [{seq + 1}/{len(sentences)}] {sentence[:60]}...")

        try:
            english, alignment_proj = translator.translate(sentence)
            glosses = glosses_for_sentence(translator, sentence, english, alignment_proj)
        except Exception as e:
            print(f"    {translator.name} error, skipping: {e}")
            continue

        roman = romanize(sentence)

        sentence_id = insert_sentence(cur, story_id, chapter_id, seq, sentence, roman, english)
        insert_sentence_words(cur, sentence_id, glosses)
        conn.commit()

    cur.close()
    conn.close()
    print(f"\nDone. {len(sentences)} sentences inserted for '{meta['title_hi']}'.")


if __name__ == "__main__":
    main()
