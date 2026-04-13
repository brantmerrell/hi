"""
fetch_text.py — Fetch a Premchand story from Hindi Wikisource.

Usage:
    python fetch_text.py "<Wikisource page name>"

Example:
    python fetch_text.py "नमक का दारोग़ा"

The page name must match the Hindi Wikisource article title exactly.
Output is saved to data/raw/<slug>.txt alongside a metadata file data/raw/<slug>.json.
"""

import json
import re
import sys
import unicodedata
from pathlib import Path

import requests
from bs4 import BeautifulSoup

WIKISOURCE_API = "https://hi.wikisource.org/w/api.php"
DATA_DIR = Path(__file__).parent.parent / "data" / "raw"


def fetch_parsed_html(page_title: str) -> str:
    """Fetch rendered HTML for a Wikisource page via the MediaWiki parse API."""
    response = requests.get(
        WIKISOURCE_API,
        params={
            "action": "parse",
            "page": page_title,
            "prop": "text",
            "format": "json",
            "disablelimitreport": True,
        },
        headers={"User-Agent": "hindi-learning-app/1.0 (educational use)"},
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()

    if "error" in data:
        raise ValueError(f"Wikisource error: {data['error']['info']}")

    return data["parse"]["text"]["*"]


def extract_text(html: str) -> str:
    """
    Extract clean Devanagari prose from Wikisource HTML.

    Wikisource pages include navigation tables, edit links, license footers,
    and template markup. This function strips those and returns only paragraph text.
    """
    soup = BeautifulSoup(html, "html.parser")
    content = soup.find("div", class_="mw-parser-output")
    if not content:
        raise ValueError("Could not find mw-parser-output div in parsed HTML")

    # Remove elements that are not story prose
    for tag in content.find_all(["table", "style", "script"]):
        tag.decompose()
    for tag in content.find_all(class_=["mw-editsection", "noprint", "navigation-not-searchable"]):
        tag.decompose()
    for tag in content.find_all("sup"):
        tag.decompose()

    paragraphs = []
    for p in content.find_all("p"):
        text = p.get_text(separator=" ", strip=True)
        # Skip very short strings (likely stray markup artifacts)
        if len(text) > 15:
            paragraphs.append(text)

    raw = "\n\n".join(paragraphs)

    # Normalize to NFC (canonical Unicode composition) — important for Devanagari
    raw = unicodedata.normalize("NFC", raw)

    # Collapse multiple spaces
    raw = re.sub(r" +", " ", raw)

    return raw.strip()


def slugify(title: str) -> str:
    """
    Convert a Hindi title to a filesystem-safe ASCII slug.

    ASCII words (e.g. from mixed titles) are joined with hyphens.
    If the title is entirely non-ASCII (pure Devanagari), the slug is
    derived from the Unicode codepoints of the first few characters so
    that the caller can still pass a predictable string to process_sentences.py.

    The fetch script prints the generated slug so the user knows what to pass
    to process_sentences.py.
    """
    ascii_words = []
    for part in title.split():
        word = "".join(c for c in part if c.isascii() and c.isalnum())
        if word:
            ascii_words.append(word)
    slug = "-".join(ascii_words).lower()
    if not slug:
        # Pure Devanagari title — use codepoints of first 4 chars as slug
        slug = "story-" + "-".join(f"{ord(c):x}" for c in title[:4])
    return slug


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python fetch_text.py \"<Wikisource page title>\"")
        print("Example: python fetch_text.py \"नमक का दारोग़ा\"")
        sys.exit(1)

    page_title = sys.argv[1]
    slug = slugify(page_title)

    print(f"Fetching: {page_title}")
    html = fetch_parsed_html(page_title)

    print("Extracting prose text...")
    text = extract_text(html)

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    text_path = DATA_DIR / f"{slug}.txt"
    meta_path = DATA_DIR / f"{slug}.json"

    text_path.write_text(text, encoding="utf-8")
    meta_path.write_text(
        json.dumps(
            {
                "title_hi": page_title,
                "slug": slug,
                "source_url": f"https://hi.wikisource.org/wiki/{page_title.replace(' ', '_')}",
                "author": "Munshi Premchand",
                "char_count": len(text),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"Saved {len(text):,} characters to {text_path}")
    print(f"Metadata saved to {meta_path}")


if __name__ == "__main__":
    main()
