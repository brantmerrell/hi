"""
generate_audio.py — Generate Hindi pronunciation MP3s via Google Cloud TTS.

Usage:
    python generate_audio.py

Pass 1: Sentences — processes all sentences that have no audio_path. Saves MP3s
to data/audio/<story_id>/<seq>.mp3 and updates sentences.audio_path.

Pass 2: Words — deduplicates by surface_devanagari (one TTS call per unique word
form), saves MP3s to data/audio/words/<md5>.mp3, and updates
sentence_words.word_audio_path for all rows sharing that surface form.

Voice: hi-IN-Wavenet-D (female, natural-sounding Hindi).
Other options: hi-IN-Wavenet-A (female), hi-IN-Wavenet-B (male),
               hi-IN-Wavenet-C (male).

Idempotent: re-running skips rows that already have an audio_path /
word_audio_path.

Requires environment variables: DATABASE_URL, GOOGLE_CLOUD_API_KEY
"""

import base64
import hashlib
import os
import sys
import time
from pathlib import Path

import psycopg2
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / "backend" / ".env")

TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize"
AUDIO_DIR = Path(__file__).parent.parent / "data" / "audio"
VOICE = "hi-IN-Wavenet-D"
LANGUAGE = "hi-IN"
# Pause between requests to stay well within quota (300 requests/minute)
REQUEST_DELAY = 0.25


def synthesize(text: str, api_key: str) -> bytes:
    """Call Google Cloud TTS and return raw MP3 bytes."""
    response = requests.post(
        TTS_URL,
        params={"key": api_key},
        json={
            "input": {"text": text},
            "voice": {"languageCode": LANGUAGE, "name": VOICE},
            "audioConfig": {"audioEncoding": "MP3"},
        },
        timeout=30,
    )
    response.raise_for_status()
    audio_b64 = response.json()["audioContent"]
    return base64.b64decode(audio_b64)


def get_connection(database_url: str):
    url = database_url.replace("postgresql+asyncpg://", "postgresql://")
    return psycopg2.connect(url)


def main() -> None:
    database_url = os.environ.get("DATABASE_URL")
    api_key = os.environ.get("GOOGLE_CLOUD_API_KEY")

    if not database_url:
        print("Error: DATABASE_URL not set")
        sys.exit(1)
    if not api_key:
        print("Error: GOOGLE_CLOUD_API_KEY not set")
        sys.exit(1)

    conn = get_connection(database_url)
    cur = conn.cursor()

    cur.execute("""
        SELECT id, story_id, sequence_num, devanagari
        FROM sentences
        WHERE audio_path IS NULL
        ORDER BY story_id, sequence_num
    """)
    rows = cur.fetchall()

    if not rows:
        print("Nothing to generate — all sentences already have audio.")
    else:
        print(f"Generating audio for {len(rows)} sentences...")

    for i, (sentence_id, story_id, seq_num, devanagari) in enumerate(rows):
        out_dir = AUDIO_DIR / str(story_id)
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"{seq_num}.mp3"

        print(f"  [{i + 1}/{len(rows)}] sentence {seq_num}: {devanagari[:50]}...")

        try:
            mp3_bytes = synthesize(devanagari, api_key)
        except Exception as e:
            print(f"    TTS error, skipping: {e}")
            continue

        out_path.write_bytes(mp3_bytes)

        # Store path relative to data/audio/ so it's location-independent
        relative_path = f"{story_id}/{seq_num}.mp3"
        cur.execute(
            "UPDATE sentences SET audio_path = %s WHERE id = %s",
            (relative_path, str(sentence_id)),
        )
        conn.commit()

        time.sleep(REQUEST_DELAY)

    cur.close()
    conn.close()

    # ── Pass 2: Word audio ────────────────────────────────────────────────────
    conn = get_connection(database_url)
    cur = conn.cursor()

    cur.execute("""
        SELECT DISTINCT surface_devanagari
        FROM sentence_words
        WHERE word_audio_path IS NULL
        ORDER BY surface_devanagari
    """)
    unique_words = [row[0] for row in cur.fetchall()]

    if not unique_words:
        print("Nothing to generate — all words already have audio.")
        cur.close()
        conn.close()
        print("Done.")
        return

    words_dir = AUDIO_DIR / "words"
    words_dir.mkdir(parents=True, exist_ok=True)

    print(f"Generating word audio for {len(unique_words)} unique surface forms...")

    for i, surface in enumerate(unique_words):
        md5 = hashlib.md5(surface.encode("utf-8")).hexdigest()
        out_path = words_dir / f"{md5}.mp3"
        relative_path = f"words/{md5}.mp3"

        print(f"  [{i + 1}/{len(unique_words)}] {surface}")

        if not out_path.exists():
            try:
                mp3_bytes = synthesize(surface, api_key)
            except Exception as e:
                print(f"    TTS error, skipping: {e}")
                continue
            out_path.write_bytes(mp3_bytes)
            time.sleep(REQUEST_DELAY)

        cur.execute(
            "UPDATE sentence_words SET word_audio_path = %s WHERE surface_devanagari = %s",
            (relative_path, surface),
        )
        conn.commit()

    cur.close()
    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
