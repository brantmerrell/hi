# Hindi Language Learning App

A sentence-by-sentence reader of Hindi text from Wikisource, displaying each sentence in four simultaneous layers: Devanagari script, Roman transliteration, word-for-word gloss, and English translation. Includes audio playback, per-user bookmarks, and reading statistics.

See [PROJECT.md](./PROJECT.md) for full design rationale and architecture decisions.

---

## Prerequisites

- Docker (for PostgreSQL)
- Python 3.10+
- Node.js 18+

---

## External Services

Three services are used by the pipeline (one-time setup to populate the database):

**Azure Translator** — translates sentences and produces word-level alignment. Sign up at [portal.azure.com](https://portal.azure.com), create a Translator resource, and configure:
```
AZURE_TRANSLATOR_KEY=<key>
AZURE_TRANSLATOR_REGION=eastus
```

**Google Cloud Text-to-Speech** — generates Hindi pronunciation audio. Sign up at [console.cloud.google.com](https://console.cloud.google.com), enable the Cloud Text-to-Speech API, and configure:
```
GOOGLE_CLOUD_API_KEY=<key>
```

**AWS SES** — sends magic link authentication emails. Create an AWS account, configure SES, and set:
```
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
AWS_SES_REGION=us-east-1
FROM_EMAIL=noreply@yourdomain.com
```

---

## Getting Started

### 1. Start PostgreSQL

```bash
docker compose up -d
```

### 2. Backend

From the `backend` directory:

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env — set SECRET_KEY and AWS SES credentials at minimum
alembic upgrade head
python -m uvicorn app.main:app --reload
```

API runs at http://localhost:8000

### 3. Frontend

From the `frontend` directory:

```bash
npm install
npm run dev
```

App runs at http://localhost:5173

### 4. Pipeline (loading text content)

From the `pipeline` directory with the backend `.venv` active:

```bash
# Step 1 — fetch raw text from Wikisource
python fetch_text.py "सप्तसरोज/नमक का दारोगा"

# Step 2 — segment, translate, insert sentences
python process_sentences.py <slug>

# Step 3 — enrich each word with dictionary-level gloss
python enrich_glosses.py

# Step 4 — generate and store audio
python generate_audio.py
```

Steps 2–4 produce sentence-level English translations, word-level alignments, dictionary definitions, and audio files. Frontend corrections and additions are not yet implemented.

---

## Project Structure

```
hi/
├── backend/
│   ├── app/
│   │   ├── models.py        — SQLAlchemy models (all tables)
│   │   ├── schemas.py       — Pydantic request/response schemas
│   │   ├── database.py      — async engine and session dependency
│   │   ├── main.py          — FastAPI app, CORS, router registration
│   │   └── routes/
│   │       ├── auth.py      — magic link request + verify endpoints
│   │       ├── stories.py   — list stories, list sentences
│   │       ├── sentences.py — get single sentence with word alignment
│   │       └── stats.py     — reading statistics for current user
│   ├── alembic/             — database migrations
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── SentenceView.tsx  — four-layer sentence display
│       │   ├── WordGloss.tsx     — word-by-word toggle view
│       │   ├── Navigation.tsx    — previous / next sentence
│       │   ├── AudioPlayer.tsx   — Hindi pronunciation playback
│       │   └── Stats.tsx         — reading statistics display
│       └── pages/
│           ├── Reader.tsx        — main reading page
│           └── Auth.tsx          — magic link email entry
├── pipeline/
│   ├── fetch_text.py        — fetch Premchand stories from Wikisource / Internet Archive
│   ├── process_sentences.py — segment, translate (sentence-level), insert sentences + word alignment
│   ├── enrich_glosses.py    — per-word dictionary translation; populates lemmas + word_senses
│   └── generate_audio.py    — Google Cloud TTS; saves MP3s and updates sentences.audio_path
├── docker-compose.yml       — PostgreSQL 16
├── PROJECT.md               — design rationale and architecture
└── characters.md            — Devanagari character reference for the developer
```
