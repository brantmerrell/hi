"""
merge_into_book.py — Turn several single-chapter stories into the chapters of one book.

Usage:
    python merge_into_book.py --author munshi-premchand --positions 1 2 3 4 5 6 \\
        --title-hi सप्तसरोज --title-en Saptasaroj --source-url https://hi.wikisource.org/wiki/सप्तसरोज [--apply]

--positions lists the existing story positions in the order they should become chapters
1, 2, 3, ... The first story is kept and becomes the book (keeping its position); the
others are folded into it and deleted. Sentences keep their sequence_num (0-based per
chapter) and their audio_path, bookmarks are repointed, and each old story's title and
source_url move onto its chapter. Chapter English titles are translated with TRANSLATOR.

Without --apply the plan is printed and nothing is changed.
"""

import argparse
import os
import sys
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

from translators import get_translator

load_dotenv(Path(__file__).parent.parent / "backend" / ".env")


def chapter_title_hi(story_title_hi: str) -> str:
    """'सप्तसरोज/बड़े_घर_की_बेटी' -> 'बड़े घर की बेटी'."""
    return story_title_hi.split("/")[-1].replace("_", " ").strip()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--author", required=True, help="Author slug")
    parser.add_argument("--positions", type=int, nargs="+", required=True)
    parser.add_argument("--title-hi", required=True)
    parser.add_argument("--title-en", required=True)
    parser.add_argument("--source-url", required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        sys.exit("Error: DATABASE_URL not set")
    if len(set(args.positions)) != len(args.positions) or len(args.positions) < 2:
        sys.exit("Error: --positions needs at least two distinct story positions")

    translator = get_translator()
    conn = psycopg2.connect(database_url.replace("postgresql+asyncpg://", "postgresql://"))
    cur = conn.cursor()

    stories = []
    for pos in args.positions:
        cur.execute(
            """
            SELECT s.id, s.title_hi, s.source_url FROM stories s
            JOIN authors a ON a.id = s.author_id WHERE a.slug = %s AND s.position = %s
            """,
            (args.author, pos),
        )
        row = cur.fetchone()
        if row is None:
            sys.exit(f"Error: no story at position {pos} for {args.author}")
        cur.execute("SELECT id FROM chapters WHERE story_id = %s", (row[0],))
        chapters = cur.fetchall()
        if len(chapters) != 1:
            sys.exit(f"Error: story at position {pos} has {len(chapters)} chapters (expected 1)")
        stories.append((pos, row[0], row[1], row[2], chapters[0][0]))

    titles_hi = [chapter_title_hi(s[2]) for s in stories]
    titles_en = translator.translate_batch(titles_hi)

    book_id = stories[0][1]
    print(f"Book: {args.title_hi} / {args.title_en}  (story id {book_id}, position {stories[0][0]})")
    for n, ((pos, _, _, _, _), hi, en) in enumerate(zip(stories, titles_hi, titles_en), 1):
        print(f"  chapter {n} <- story {pos}: {hi} / {en}")

    # Park every chapter on a temporary position so the (story_id, position) constraint can't trip
    for n, (_, _, _, _, chapter_id) in enumerate(stories, 1):
        cur.execute("UPDATE chapters SET position = %s WHERE id = %s", (1000 + n, chapter_id))
    for n, ((_, story_id, _, source_url, chapter_id), hi, en) in enumerate(zip(stories, titles_hi, titles_en), 1):
        cur.execute(
            """
            UPDATE chapters SET story_id = %s, position = %s, title_hi = %s, title_en = %s, source_url = %s
            WHERE id = %s
            """,
            (book_id, n, hi, en, source_url, chapter_id),
        )
        if story_id != book_id:
            cur.execute("UPDATE sentences SET story_id = %s WHERE story_id = %s", (book_id, story_id))
            cur.execute("UPDATE bookmarks SET story_id = %s WHERE story_id = %s", (book_id, story_id))
            cur.execute("DELETE FROM stories WHERE id = %s", (story_id,))
    cur.execute(
        "UPDATE stories SET title_hi = %s, title_en = %s, source_url = %s WHERE id = %s",
        (args.title_hi, args.title_en, args.source_url, book_id),
    )

    cur.execute(
        "SELECT c.position, count(se.id) FROM chapters c LEFT JOIN sentences se ON se.chapter_id = c.id "
        "WHERE c.story_id = %s GROUP BY 1 ORDER BY 1",
        (book_id,),
    )
    print("Result (chapter, sentences):", cur.fetchall())

    if args.apply:
        conn.commit()
        print("Applied.")
    else:
        conn.rollback()
        print("Dry run — nothing changed. Re-run with --apply.")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
