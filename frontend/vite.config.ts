import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Picks up frontend/.env.local, where scripts/dev.sh writes the
  // backend's ephemeral port (falls back to :8000 for non-coordinated runs).
  const env = loadEnv(mode, process.cwd())
  const backendTarget = `http://127.0.0.1:${env.VITE_BACKEND_PORT || '8000'}`

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api": {
          target: backendTarget,
        },
        "/audio": {
          target: backendTarget,
        },
      },
    },
  }
})
