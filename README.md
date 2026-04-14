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

## Deployment

### Backend (Heroku)

```bash
# Create Heroku app (first time only)
heroku create hi-api

# Add PostgreSQL database
heroku addons:create heroku-postgresql:essential-0 -a hi-api

# Configure environment variables from your .env
heroku config:set AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID -a hi-api
heroku config:set AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY -a hi-api
heroku config:set FROM_EMAIL=$FROM_EMAIL -a hi-api
heroku config:set AZURE_TRANSLATOR_KEY=$AZURE_TRANSLATOR_KEY -a hi-api
heroku config:set GOOGLE_CLOUD_API_KEY=$GOOGLE_CLOUD_API_KEY -a hi-api
heroku config:set FRONTEND_URL=https://hi.jbm.eco -a hi-api
heroku config:set FROM_EMAIL=$FROM_EMAIL -a hi-api

# Deploy
git push heroku main

# Run database migrations
heroku run "cd backend && alembic upgrade head" -a hi-api

# Enable automatic SSL certificate management
heroku certs:auto:enable -a hi-api

# Set custom domain
heroku domains:add hi-api.jbm.eco -a hi-api
```

Update your DNS provider to point `hi-api.jbm.eco` to the DNS target shown by `heroku domains -a hi-api`.

To migrate data from a local Docker-based PostgreSQL to Heroku:

```bash
docker exec hi-db-1 pg_dump -U postgres hindi_app | psql $(heroku config:get DATABASE_URL -a hi-api)
```

### Frontend (GitHub Pages)

The frontend automatically deploys via GitHub Actions when you push to `main`. The workflow:
1. Builds the React app with `VITE_API_URL=https://hi-api.jbm.eco`
2. Deploys the `frontend/dist` directory to GitHub Pages

To set up the custom domain for GitHub Pages:
1. Go to repository Settings → Pages → Source → **GitHub Actions** (not "Deploy from a branch")
2. Set Custom domain to `hi.jbm.eco`
3. Update your DNS provider to point `hi.jbm.eco` to GitHub Pages (CNAME to `brantmerrell.github.io`)

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
