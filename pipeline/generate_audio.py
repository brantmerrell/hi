"""
generate_audio.py — Generate Hindi pronunciation MP3s via Google Cloud TTS.

Usage:
    python generate_audio.py

Pass 1: Sentences — processes all sentences that have no audio_path. Saves MP3s
to data/audio/<chapter_id>/<seq>.mp3 and updates sentences.audio_path. Each word is
preceded by an SSML <mark>, and Google's timepoints for those marks are stored in
sentence_words.start_ms so the app can highlight the word being spoken.

    python generate_audio.py --retime

also re-synthesizes sentences that already have audio but whose words have no
start_ms (backfill for audio generated before word timing existed).

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

import argparse
import base64
import hashlib
import os
import sys
import time
from pathlib import Path
from xml.sax.saxutils import escape

import psycopg2
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / "backend" / ".env")

TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize"
# SSML mark timepoints are only available on the v1beta1 endpoint
TTS_BETA_URL = "https://texttospeech.googleapis.com/v1beta1/text:synthesize"
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


def build_ssml(sentence: str, surfaces: list[str]) -> tuple[str, list[int]]:
    """
    Wrap a sentence in SSML with a <mark name="w{i}"/> before each word.

    `surfaces` are the sentence's words in order. The original text (including
    punctuation) is preserved so prosody is unchanged. Returns the SSML and the
    indexes of the words that were found and marked.
    """
    parts = []
    marked = []
    cursor = 0
    for i, surface in enumerate(surfaces):
        idx = sentence.find(surface, cursor)
        if idx == -1:
            continue
        parts.append(escape(sentence[cursor:idx]))
        parts.append(f'<mark name="w{i}"/>')
        parts.append(escape(surface))
        marked.append(i)
        cursor = idx + len(surface)
    parts.append(escape(sentence[cursor:]))
    return f"<speak>{''.join(parts)}</speak>", marked


def parse_timepoints(timepoints: list[dict]) -> dict[int, int]:
    """Map word index -> start offset in milliseconds from TTS timepoints."""
    result = {}
    for tp in timepoints:
        name = tp.get("markName", "")
        if name.startswith("w") and name[1:].isdigit():
            result[int(name[1:])] = round(tp["timeSeconds"] * 1000)
    return result


def synthesize_with_timepoints(sentence: str, surfaces: list[str], api_key: str) -> tuple[bytes, dict[int, int]]:
    """Synthesize a sentence and return (MP3 bytes, {word index: start_ms})."""
    ssml, _ = build_ssml(sentence, surfaces)
    response = requests.post(
        TTS_BETA_URL,
        params={"key": api_key},
        json={
            "input": {"ssml": ssml},
            "voice": {"languageCode": LANGUAGE, "name": VOICE},
            "audioConfig": {"audioEncoding": "MP3"},
            "enableTimePointing": ["SSML_MARK"],
        },
        timeout=30,
    )
    response.raise_for_status()
    body = response.json()
    return base64.b64decode(body["audioContent"]), parse_timepoints(body.get("timepoints", []))


def get_connection(database_url: str):
    url = database_url.replace("postgresql+asyncpg://", "postgresql://")
    return psycopg2.connect(url)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate sentence and word audio.")
    parser.add_argument(
        "--retime",
        action="store_true",
        help="Also regenerate sentence audio whose words have no start_ms",
    )
    args = parser.parse_args()

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

    needs_audio = "audio_path IS NULL"
    if args.retime:
        needs_audio += (
            " OR EXISTS (SELECT 1 FROM sentence_words w"
            " WHERE w.sentence_id = sentences.id AND w.start_ms IS NULL)"
        )
    cur.execute(f"""
        SELECT id, chapter_id, sequence_num, devanagari
        FROM sentences
        WHERE {needs_audio}
        ORDER BY chapter_id, sequence_num
    """)
    rows = cur.fetchall()

    if not rows:
        print("Nothing to generate — all sentences already have audio.")
    else:
        print(f"Generating audio for {len(rows)} sentences...")

    for i, (sentence_id, chapter_id, seq_num, devanagari) in enumerate(rows):
        out_dir = AUDIO_DIR / str(chapter_id)
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"{seq_num}.mp3"

        print(f"  [{i + 1}/{len(rows)}] sentence {seq_num}: {devanagari[:50]}...")

        cur.execute(
            "SELECT id, surface_devanagari FROM sentence_words WHERE sentence_id = %s ORDER BY position",
            (str(sentence_id),),
        )
        word_rows = cur.fetchall()

        try:
            mp3_bytes, starts = synthesize_with_timepoints(
                devanagari, [surface for _, surface in word_rows], api_key
            )
        except Exception as e:
            print(f"    TTS error, skipping: {e}")
            continue

        out_path.write_bytes(mp3_bytes)
        for i, (word_id, _) in enumerate(word_rows):
            cur.execute(
                "UPDATE sentence_words SET start_ms = %s WHERE id = %s",
                (starts.get(i), str(word_id)),
            )

        # Store path relative to data/audio/ so it's location-independent
        relative_path = f"{chapter_id}/{seq_num}.mp3"
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
