"""
compare_translation.py — Compare machine translation against a Wikisource English translation.

Usage:
    python compare_translation.py "<hi.wikisource page>" "<en.wikisource page>" [--limit 15] [--machine]

Example:
    python compare_translation.py "मानसरोवर १/ईदगाह" "Eidgah" --machine

Reports sentence counts for the Hindi original and the Wikisource English, so you can
tell whether the two segment into the same number of sentences, then prints the first
--limit Hindi sentences next to the Wikisource English at the same index. With --machine,
the TRANSLATOR provider's translation of each Hindi sentence is shown too.
"""

import argparse
import re

import requests

from fetch_text import extract_text, fetch_parsed_html
from process_sentences import segment_sentences
from translators import get_translator

EN_API = "https://en.wikisource.org/w/api.php"


def fetch_english(title: str) -> str:
    """Return the plain text of an English Wikisource page."""
    response = requests.get(
        EN_API,
        params={"action": "parse", "page": title, "prop": "text", "format": "json", "disablelimitreport": True},
        headers={"User-Agent": "hi-pipeline/1.0"},
        timeout=30,
    )
    response.raise_for_status()
    return extract_text(response.json()["parse"]["text"]["*"])


def segment_english(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])[\"”’]?\s+", re.sub(r"\s+", " ", text))
    return [p.strip() for p in parts if len(p.strip()) >= 10]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("hi_title")
    parser.add_argument("en_title")
    parser.add_argument("--limit", type=int, default=15)
    parser.add_argument("--machine", action="store_true", help="also show TRANSLATOR's translation")
    args = parser.parse_args()

    hi = segment_sentences(extract_text(fetch_parsed_html(args.hi_title)))
    en = segment_english(fetch_english(args.en_title))
    print(f"Hindi sentences: {len(hi)}   Wikisource English sentences: {len(en)}   "
          f"(ratio en/hi: {len(en) / max(len(hi), 1):.2f})\n")

    machine: list[str] = []
    if args.machine:
        translator = get_translator()
        machine = translator.translate_batch(hi[: args.limit])
        print(f"Machine translation via: {translator.name}\n")

    for i in range(min(args.limit, len(hi))):
        print(f"[{i + 1}] HI : {hi[i]}")
        print(f"     WS : {en[i] if i < len(en) else '—'}")
        if machine:
            print(f"     MT : {machine[i]}")
        print()


if __name__ == "__main__":
    main()
