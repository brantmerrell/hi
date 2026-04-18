"""
backfill_story_titles.py — Translate title_en for stories where it is NULL.

Usage:
    python backfill_story_titles.py

Requires environment variables: DATABASE_URL, AZURE_TRANSLATOR_KEY, AZURE_TRANSLATOR_REGION
"""

import os
import sys
from pathlib import Path

import psycopg2
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / "backend" / ".env")

AZURE_ENDPOINT = "https://api.cognitive.microsofttranslator.com/translate"


def translate(text: str, key: str, region: str) -> str:
    response = requests.post(
        AZURE_ENDPOINT,
        headers={
            "Ocp-Apim-Subscription-Key": key,
            "Ocp-Apim-Subscription-Region": region,
            "Content-Type": "application/json",
        },
        params={"api-version": "3.0", "from": "hi", "to": "en"},
        json=[{"Text": text}],
        timeout=15,
    )
    response.raise_for_status()
    return response.json()[0]["translations"][0]["text"]


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

    url = database_url.replace("postgresql+asyncpg://", "postgresql://")
    conn = psycopg2.connect(url)
    cur = conn.cursor()

    cur.execute("SELECT id, title_hi FROM stories WHERE title_en IS NULL ORDER BY position ASC NULLS LAST")
    rows = cur.fetchall()

    if not rows:
        print("All stories already have title_en.")
        cur.close()
        conn.close()
        return

    for story_id, title_hi in rows:
        print(f"Translating '{title_hi}'...")
        title_en = translate(title_hi, azure_key, azure_region)
        print(f"  → {title_en}")
        cur.execute("UPDATE stories SET title_en = %s WHERE id = %s", (title_en, story_id))
        conn.commit()

    cur.close()
    conn.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
