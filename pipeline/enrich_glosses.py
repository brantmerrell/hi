"""
enrich_glosses.py — Populate lemmas and word_senses with per-word dictionary translations.

Usage:
    python enrich_glosses.py

Processes all sentence_words that have no lemma_id (i.e. not yet enriched).
Translates each unique surface form individually via Azure Translator to get a
context-free dictionary-level gloss ("theft", "hidden") rather than a fragment
of the sentence-level translation.

This is intentionally separate from process_sentences.py because the two calls
serve different purposes:
  - process_sentences.py: sentence-level translation + alignment (contextual)
  - enrich_glosses.py:    per-word translation (literal / dictionary)

The word-for-word display layer in the app uses word_sense.english_definition,
which this script populates. The sentence-level english field remains the
natural English translation from process_sentences.py.

Idempotent: re-running skips words that already have a lemma_id.

Requires environment variables: DATABASE_URL, AZURE_TRANSLATOR_KEY, AZURE_TRANSLATOR_REGION
"""

import os
import sys
import uuid
from pathlib import Path

import psycopg2
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / "backend" / ".env")

AZURE_ENDPOINT = "https://api.cognitive.microsofttranslator.com/translate"
BATCH_SIZE = 100  # Azure allows up to 100 texts per request


def batch_translate(texts: list[str], key: str, region: str) -> list[str]:
    """Translate a batch of texts from Hindi to English. Returns translations in order."""
    response = requests.post(
        AZURE_ENDPOINT,
        params={"api-version": "3.0", "from": "hi", "to": "en"},
        headers={
            "Ocp-Apim-Subscription-Key": key,
            "Ocp-Apim-Subscription-Region": region,
            "Content-Type": "application/json",
        },
        json=[{"text": t} for t in texts],
        timeout=30,
    )
    response.raise_for_status()
    return [item["translations"][0]["text"] for item in response.json()]


def get_connection(database_url: str):
    url = database_url.replace("postgresql+asyncpg://", "postgresql://")
    return psycopg2.connect(url)


def main() -> None:
    database_url = os.environ.get("DATABASE_URL")
    azure_key = os.environ.get("AZURE_TRANSLATOR_KEY")
    azure_region = os.environ.get("AZURE_TRANSLATOR_REGION", "eastus")

    if not database_url:
        print("Error: DATABASE_URL not set")
        sys.exit(1)
    if not azure_key:
        print("Error: AZURE_TRANSLATOR_KEY not set")
        sys.exit(1)

    conn = get_connection(database_url)
    cur = conn.cursor()

    # All unique surface forms that have not yet been assigned a lemma
    cur.execute("""
        SELECT DISTINCT surface_devanagari, surface_romanized
        FROM sentence_words
        WHERE lemma_id IS NULL
        ORDER BY surface_devanagari
    """)
    unique_words = cur.fetchall()

    if not unique_words:
        print("Nothing to enrich — all sentence_words already have a lemma_id.")
        cur.close()
        conn.close()
        return

    print(f"Enriching {len(unique_words)} unique word forms...")

    total_batches = (len(unique_words) + BATCH_SIZE - 1) // BATCH_SIZE

    for batch_num, batch_start in enumerate(range(0, len(unique_words), BATCH_SIZE)):
        batch = unique_words[batch_start : batch_start + BATCH_SIZE]
        texts = [w[0] for w in batch]

        print(f"  Batch {batch_num + 1}/{total_batches}: translating {len(texts)} words...")
        try:
            translations = batch_translate(texts, azure_key, azure_region)
        except Exception as e:
            print(f"  Azure error on batch {batch_num + 1}: {e}")
            continue

        for (surface_deva, surface_roman), english_def in zip(batch, translations):
            # Upsert lemma (surface form as canonical form — morphological analysis deferred)
            cur.execute("SELECT id FROM lemmas WHERE devanagari = %s", (surface_deva,))
            row = cur.fetchone()
            if row:
                lemma_id = row[0]
                # Check if a word_sense already exists for this lemma
                cur.execute(
                    "SELECT id FROM word_senses WHERE lemma_id = %s AND english_definition = %s",
                    (lemma_id, english_def),
                )
                sense_row = cur.fetchone()
                sense_id = sense_row[0] if sense_row else None
            else:
                lemma_id = str(uuid.uuid4())
                cur.execute(
                    """
                    INSERT INTO lemmas (id, devanagari, romanized, part_of_speech, gender)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (lemma_id, surface_deva, surface_roman, "unknown", "unknown"),
                )
                sense_id = None

            if sense_id is None:
                sense_id = str(uuid.uuid4())
                cur.execute(
                    """
                    INSERT INTO word_senses (id, lemma_id, english_definition)
                    VALUES (%s, %s, %s)
                    """,
                    (sense_id, lemma_id, english_def),
                )

            # Link all sentence_words with this surface form
            cur.execute(
                """
                UPDATE sentence_words
                SET lemma_id = %s, word_sense_id = %s
                WHERE surface_devanagari = %s AND lemma_id IS NULL
                """,
                (lemma_id, sense_id, surface_deva),
            )

        conn.commit()

    cur.close()
    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
