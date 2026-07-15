#!/usr/bin/env bash
# Coordinator for hi's dev servers: allocates ephemeral ports for the
# FastAPI backend and vite frontend, then hands each side what it needs
# to find the other. See ../../diagrams/manual/dev/ports.d2 (layer 2).
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

read -r BACKEND_PORT FRONTEND_PORT < <(python3 -c '
import socket
s1 = socket.socket(); s1.bind(("127.0.0.1", 0))
s2 = socket.socket(); s2.bind(("127.0.0.1", 0))
print(s1.getsockname()[1], s2.getsockname()[1])
s1.close(); s2.close()
')

echo "hi dev: backend -> http://localhost:${BACKEND_PORT}  frontend -> http://localhost:${FRONTEND_PORT}"

# Hand the backend's port to the frontend via a port file it reads at
# startup (vite.config.ts calls loadEnv, which picks up frontend/.env.local).
cat > frontend/.env.local <<EOF
VITE_BACKEND_PORT=${BACKEND_PORT}
EOF

# Same pattern the other way: backend/app/main.py loads backend/.env.local
# (override=True) after backend/.env, so this wins over the static
# FRONTEND_URL checked into backend/.env.
cat > backend/.env.local <<EOF
FRONTEND_URL=http://localhost:${FRONTEND_PORT}
EOF

(
  cd backend
  .venv/bin/uvicorn app.main:app --reload --port "${BACKEND_PORT}"
) &
BACKEND_PID=$!

cleanup() {
  kill "${BACKEND_PID}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

cd frontend
npm run dev -- --port "${FRONTEND_PORT}" --strictPort
