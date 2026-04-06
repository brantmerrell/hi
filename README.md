# Hindi Language Learning App

A sentence-by-sentence reader of Hindi prose displaying each sentence in four simultaneous layers: Devanagari script, Roman transliteration, word-for-word gloss, and natural English translation. Includes audio playback, per-user bookmarks, and reading statistics.

See [PROJECT.md](./PROJECT.md) for full design rationale and architecture decisions.

---

## Prerequisites

- Docker (for PostgreSQL)
- Python 3.10+
- Node.js 18+

---

## Accounts and Tokens

Three external services are used. They have different scopes — not all are needed to run the app locally.

### Resend — required to run the app

Used for magic link authentication emails.

1. Sign up at [resend.com](https://resend.com)
2. Create an API key (Dashboard → API Keys)
3. Add a verified sending domain, or use Resend's onboarding domain for testing
4. Free tier: 3,000 emails/month, 100/day — sufficient for personal + small shared use

Environment variables provided:
```
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@yourdomain.com
```

---

### Azure Translator — required for the pre-processing pipeline only

Used to translate Hindi sentences to English and produce word-level alignment (which Hindi word maps to which English word). The app never calls this at runtime — it is used once per sentence during pre-processing, with results stored in the database.

1. Sign up at [portal.azure.com](https://portal.azure.com)
2. Create a resource → search "Translator"
3. Select the **F0 free tier** (2M characters/month)
4. After creation: go to the resource → Keys and Endpoint
5. Copy Key 1 and the Region (e.g. `eastus`)

The endpoint URL is standard and does not need to be configured:
`https://api.cognitive.microsofttranslator.com`

Environment variables provided:
```
AZURE_TRANSLATOR_KEY=...
AZURE_TRANSLATOR_REGION=eastus
```

---

### Google Cloud Text-to-Speech — required for the pre-processing pipeline only

Used to generate Hindi audio (MP3) for each sentence. Like Azure, this is a one-time pre-processing step — audio files are stored as static files and served directly. The app never calls this API at runtime.

1. Sign up at [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project
3. Enable the **Cloud Text-to-Speech API** (APIs & Services → Library)
4. Create credentials: APIs & Services → Credentials → Create Credentials → API Key
5. Free tier: 1M WaveNet characters/month (permanent, resets monthly)

Environment variables provided:
```
GOOGLE_CLOUD_API_KEY=...
```

---

## Getting Started

### 1. Start PostgreSQL

```bash
docker compose up -d
```

### 2. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env — at minimum set SECRET_KEY and RESEND_API_KEY
alembic revision --autogenerate -m "initial"
alembic upgrade head
uvicorn app.main:app --reload
```

API runs at http://localhost:8000. Health check: http://localhost:8000/health

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at http://localhost:5173.

### 4. Pipeline (loading text content)

The pipeline is run once per story to populate the database. All three steps require the backend `.venv` to be active and `backend/.env` to be configured.

```bash
cd pipeline

# Step 1 — fetch raw text from Hindi Wikisource
python fetch_text.py "सप्तसरोज/नमक का दारोगा"
# prints the slug, e.g. story-938-92a-94d-924

# Step 2 — segment, translate, and insert sentences + word alignment
python process_sentences.py <slug>

# Step 3 — enrich each word with a dictionary-level gloss
python enrich_glosses.py

# Step 4 — generate Hindi pronunciation MP3s via Google Cloud TTS
python generate_audio.py
```

**Why four steps?**

`process_sentences.py` translates full sentences and uses Azure's word-alignment to map Hindi words to fragments of the English translation. This is the *contextual* gloss — useful but incomplete. Idiomatic expressions (e.g. चोरी छिपे → "secretly") produce empty glosses for the individual words because their meaning was absorbed into the sentence translation.

`enrich_glosses.py` translates each unique word form individually, producing a *dictionary-level* gloss ("theft", "hidden"). The word-for-word display layer uses this. The sentence-level English translation remains the contextual one from Step 2.

`generate_audio.py` calls Google Cloud TTS (voice: hi-IN-Wavenet-D) for each sentence, saves MP3s to `data/audio/<story_id>/<seq>.mp3`, and writes the relative path to `sentences.audio_path`. Audio files are served as static files by FastAPI at `/audio/`.

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
