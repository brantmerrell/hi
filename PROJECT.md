# Hindi Language Learning App - Project Design Document

**Authors**: Joshua Merrell + Claude (Anthropic)
**Purpose**: Personal but shareable Hindi learning tool
**Repository**: `hi/`

---

## What This App Does

A sentence-by-sentence reader of Hindi prose that displays each sentence in four simultaneous layers:

1. **Hindi in Devanagari script** — the native writing system (e.g., मैंने एक किताब पाई)
2. **Hindi in Roman script** — phonetic transliteration for pronunciation (e.g., *maiṃne ek kitāb pāī*)
3. **Word-for-word gloss** — each Hindi word mapped to an English equivalent, preserving Hindi grammar order
4. **English sentence** — a natural English translation in English grammar

### Feature Status

| Feature | Status |
|---|---|
| Display sentence in four layers | Done |
| Step forward / backward through sentences | Done |
| Audio playback of Hindi pronunciation | Done |
| Toggle word-level translation view | Done |
| Magic link email authentication | Done |
| User bookmarks (persistent across devices) | Done |
| Reading statistics (word frequency, review counts) | Done |
| Pre-processing pipeline (text → DB) | Done |
| Custom sending domain for SES | Planned |

---

## Why These Four Layers

Hindi and English have fundamentally different grammars (Hindi is SOV; English is SVO; Hindi uses postpositions where English uses prepositions; Hindi verbs agree with gender). Showing layers 3 and 4 simultaneously makes the *gap between grammars* visible rather than hiding it. This is not a bug — it is the central pedagogical feature. A learner seeing both layers at once internalizes why Hindi grammar produces the word order it does.

Layers 1 and 2 together address the script barrier. Devanagari is a phonetically consistent script (unlike English orthography), so a learner who can read the romanization can produce correct pronunciation even before memorizing the script.

### Note on Terminology

Layer 3 is called a "gloss" — a standard linguistic term for word-by-word translation that preserves the source language's word order and structure. See [Gloss (linguistics)](https://en.wikipedia.org/wiki/Gloss_(linguistics)) on Wikipedia.

---

## Text Sources

Texts are fetched from Hindi Wikisource and the Internet Archive — works in the public domain that are already digitized. The pipeline accepts any Hindi text that can be segmented into sentences and processes it incrementally.

---

## API and Tooling Strategy

### The Character Budget Problem

The APIs needed to process text have monthly free tiers. The app must never call these APIs at runtime in response to user actions. Instead, a separate pre-processing pipeline (run by the developer) processes source texts in batches and stores all results permanently. The app reads from the database only.

This means each sentence is processed exactly once. The free tiers are not a per-user or per-request constraint — they are a one-time pipeline throughput constraint.

### Tool Selection

| Layer | Tool | License | Free Tier |
|---|---|---|---|
| Devanagari text | Source text as-is | Public domain | — |
| Roman transliteration | Aksharamukha (Python package) | Open source | Unlimited, offline |
| Word-for-word alignment + sentence translation | Azure Translator API (`includeAlignment=true`) | Commercial | 2M characters/month |
| Audio pronunciation | Google Cloud Text-to-Speech (WaveNet, Hindi) | Commercial | 1M characters/month |
| Morphological analysis (lemma, gender, POS) | Indic NLP Library (Python package) | MIT | Unlimited, offline |

**Why Azure over Google for translation**: Google Cloud Translation API does not expose word-level alignment. The word-by-word translations visible in the Google Translate web UI are a UI feature backed by an undocumented internal endpoint — not accessible via the official API and prohibited by Google's Terms of Service for programmatic use. Azure Translator's `includeAlignment=true` parameter is the only major commercial API that provides character-offset word alignment between source and target. Both translation and alignment come from a single Azure API call.

**Why Google Cloud TTS**: Best Hindi voice quality among commercial options (WaveNet and Neural2 voices). Amazon Polly's Kajal (neural) is competitive but Google's free tier is more generous for this use case.

**Audio storage**: All audio is pre-generated as MP3 files named by sentence ID and served as static files. No TTS API calls occur at runtime.

---

## Data Model

### Key Linguistic Distinction

The same Hindi word form can map to different English words depending on sentence context. Simultaneously, multiple surface forms can share a single underlying lemma. Both mappings must be stored and neither is redundant with the other:

- **Surface form** `पाई` in sentence 42 → English gloss "found" (past tense, feminine agreement)
- **Surface form** `पाया` in sentence 71 → English gloss "found" (past tense, masculine agreement)
- Both surface forms belong to **lemma** `पाना` (to find)
- The **sentence translation** of sentence 42 is independently produced and may differ from what concatenating the word glosses would produce

### Schema (PostgreSQL)

```sql
-- Static content, pre-processed once
stories        (id, title, title_hi, author, source_url)
sentences      (id, story_id, sequence_num, devanagari, romanized, english, audio_path)

-- Linguistic knowledge
lemmas         (id, devanagari, romanized, part_of_speech, gender)
               -- gender: masculine | feminine | variable | unknown
word_senses    (id, lemma_id, english_definition, usage_notes)
               -- one lemma → many senses for polysemous words

-- Per-sentence word occurrences
sentence_words (id, sentence_id, position,
                surface_devanagari, surface_romanized,
                english_gloss,    -- from Azure alignment for this specific occurrence
                lemma_id,         -- nullable; filled by morphological analysis pipeline
                word_sense_id)    -- nullable; filled by WSD enrichment (manual or automated)

-- Users
users          (id, email, display_name, created_at)
magic_links    (id, user_id, token, expires_at, used_at)
bookmarks      (user_id, story_id, sentence_id, updated_at)

-- Reading events (append-only log)
user_word_reads     (user_id, sentence_word_id, read_at)
user_sentence_reads (user_id, sentence_id, read_at)
```

### Why This Shape Supports the Desired Statistics

Because `sentence_word_id` joins through `sentence_words` to `lemmas` and `word_senses`, all planned statistics reduce to straightforward aggregations without denormalization:

| Statistic | Query pattern |
|---|---|
| Unique surface forms read | `COUNT DISTINCT surface_devanagari` via `user_word_reads` |
| Unique lemmas read | `COUNT DISTINCT lemma_id` via `user_word_reads → sentence_words` |
| Repetitions per word | `COUNT(*)` grouped by `lemma_id` |
| Repetitions per word meaning | `COUNT(*)` grouped by `word_sense_id` |
| Gender breakdown per story | Join `sentence_words → lemmas`, filter by `story_id`, group by `gender` |
| Unique words per story | `COUNT DISTINCT lemma_id` filtered by `story_id` |
| Gender breakdown of words *read* by user | Same join filtered by `user_id` |

### Note on Word Sense Disambiguation

Tracking which *sense* of a polysemous word was used in a given sentence is a genuinely hard NLP problem (Word Sense Disambiguation). The schema accommodates it — `word_sense_id` is nullable and can be filled incrementally. In the first version, Azure's per-occurrence English gloss serves as a rough proxy for sense. Manual curation or Hindi WordNet integration can enrich this over time without schema changes.

### Note on Gender

Hindi has two grammatical genders (masculine, feminine). Neuter is a legitimate category in many languages — Latin, German, Sanskrit — but when Hindi developed from Sanskrit, the neuter gender collapsed into masculine. There is no distinct class of Hindi words a learner encounters as neuter.

Gender behaves differently depending on part of speech:

- **Nouns** have inherent gender. किताब (kitāb, "book") is always feminine; लड़का (laṛkā, "boy") is always masculine. The gender is a fixed property of the word.
- **Adjectives** agree with the noun they modify in gender, number, and grammatical case. अच्छा (achhā) has three surface forms: अच्छा (masculine singular direct), अच्छे (masculine plural or oblique), अच्छी (feminine). The adjective itself is not gendered — it reflects the gender of its noun.

This distinction matters for the schema. The `gender` field on `lemmas` records inherent gender for nouns. For variable adjectives like अच्छा, it records `variable` — meaning the surface form will decline to agree with its noun. The full enum is `masculine | feminine | variable | unknown`.

---

## Tech Stack

| Component | Technology | Rationale |
|---|---|---|
| Frontend | React + TypeScript | React's ecosystem matches all UI requirements |
| Backend API | Python + FastAPI | Same language as the NLP pre-processing pipeline |
| Pre-processing pipeline | Python (separate scripts, same repo) | IndicTrans2, Aksharamukha, Indic NLP Library are all Python |
| Database | PostgreSQL | Statistical query requirements justify relational database; concurrent multi-user reads are safe |
| Email / Auth | AWS SES (magic link) | Simple email-only auth; no passwords; persistent across devices and cookie clears |
| Audio | Pre-generated MP3 static files | Named by sentence ID; served directly; no runtime API calls |

**On Rust**: Rust was considered for the frontend (Yew, Leptos) on the basis that it "works well with AI development." This is true of Rust on the backend or for ML inference tooling, but Rust frontend frameworks are immature relative to React, compile to WebAssembly, and have a small ecosystem. Given the developer's existing React proficiency and the project's UI complexity, Rust frontend would cost more than it returns. The correct use of the developer's time is React.

---

## User Identity

Authentication uses magic links sent to a user-provided email address. On first visit a user enters their email; the app sends a single-use time-limited link; clicking it establishes a session. No password is ever set or required.

This approach was chosen because:
- The app will be shown to family, coworkers, and interviewers — not just used privately
- Users should have persistent bookmarks and statistics across sessions and devices
- Password management adds friction and support burden inappropriate for a personal project at this scale
- Cookie/UUID-only identity would be lost on cookie clears or device changes

---

## Known Constraints and Open Questions

1. **Morphological analysis quality**: The Indic NLP Library's Hindi stemmer is imperfect. Lemma assignments should be treated as approximate and correctable, not authoritative.

2. **Word sense tagging**: Initial version uses Azure's per-occurrence English gloss as a sense proxy. Full WSD enrichment is deferred.

3. **Pre-processing throughput**: At 2M characters/month (Azure), the pipeline can process a substantial short story corpus in a few months of incremental runs. Texts should be prioritized and processed incrementally rather than all at once.

4. **Sentence segmentation**: Premchand's prose will require careful sentence splitting. Hindi sentence boundaries are marked by the *poorna viram* (।) rather than a period. The pipeline must handle this correctly before submitting text to Azure.

5. **Kamayani as optional literary mode**: The epic poem Kamayani (Jaishankar Prasad, 1936) is public domain and fully digitized on Hindi Wikisource. It is excluded from the primary vocabulary-building path but remains a candidate for a literary reading mode once the core app is functional.
