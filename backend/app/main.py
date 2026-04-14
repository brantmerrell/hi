import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(override=True)

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.routes import auth, bookmark, sentences, stats, stories

app = FastAPI(
    title="Hindi Language Learning API",
    description="Backend for a Hindi reading / vocabulary app powered by Premchand stories.",
    version="0.1.0",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Allow Vite dev server by default; additional origins can be set via env.
_frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[_frontend_url, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(stories.router, prefix="/api/stories", tags=["stories"])
app.include_router(sentences.router, prefix="/api/sentences", tags=["sentences"])
app.include_router(bookmark.router, prefix="/api/bookmarks", tags=["bookmarks"])
app.include_router(stats.router, prefix="/api/stats", tags=["stats"])


# ── Audio serving ─────────────────────────────────────────────────────────────
_audio_dir = Path(__file__).parent.parent.parent / "data" / "audio"
_audio_dir.mkdir(parents=True, exist_ok=True)
_audio_s3_url = os.environ.get("AUDIO_S3_URL")  # e.g. https://hi-audio-jbm.s3.amazonaws.com


@app.get("/audio/{path:path}")
async def serve_audio(path: str):
    local_file = _audio_dir / path
    if local_file.exists():
        return FileResponse(str(local_file), media_type="audio/mpeg")
    if _audio_s3_url:
        return RedirectResponse(f"{_audio_s3_url}/{path}")
    raise HTTPException(status_code=404, detail="Audio file not found")


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["health"])
async def health() -> dict:
    return {"status": "ok"}
