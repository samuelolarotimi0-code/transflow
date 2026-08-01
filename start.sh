#!/usr/bin/env bash
# Start TranscriptFlow on localhost.
# Launches the Next.js app (port 3000) and the live-transcription
# mini-service (port 3003) in parallel. Press Ctrl+C to stop both.
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# --- Preflight checks -------------------------------------------------------
check_bin() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "✗ $1 is not installed. $2"
    exit 1
  fi
}
check_bin node "Install Node.js 18+ from https://nodejs.org"
check_bin bun "Install Bun: curl -fsSL https://bun.sh/install | bash"
check_bin ffmpeg "Install ffmpeg:
  • macOS:  brew install ffmpeg
  • Ubuntu: sudo apt install ffmpeg
  • Win:    choco install ffmpeg"
command -v yt-dlp >/dev/null 2>&1 || echo "⚠ yt-dlp not found (YouTube uploads will be disabled). Install: pip install -U yt-dlp"

# --- Ensure .env exists -----------------------------------------------------
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✓ Created .env from .env.example"
fi

# --- Install deps if missing ------------------------------------------------
if [ ! -d node_modules ]; then
  echo "↯ Installing root dependencies…"
  bun install
fi
if [ ! -d mini-services/transcription-service/node_modules ]; then
  echo "↯ Installing mini-service dependencies…"
  (cd mini-services/transcription-service && bun install)
fi

# --- Database ---------------------------------------------------------------
echo "↯ Syncing database schema…"
bun run db:push

# --- Launch -----------------------------------------------------------------
cleanup() {
  echo ""
  echo "↯ Stopping services…"
  kill "$APP_PID" "$WS_PID" 2>/dev/null || true
  wait 2>/dev/null || true
  echo "✓ Stopped. Bye!"
}
trap cleanup EXIT INT TERM

echo "↯ Starting live-transcription service on :3003"
(cd mini-services/transcription-service && bun run dev) &
WS_PID=$!

echo "↯ Starting Next.js app on :3000"
bun run dev &
APP_PID=$!

echo ""
echo "============================================================"
echo "  TranscriptFlow is running!"
echo "  → App:           http://localhost:3000"
echo "  → Transcription: ws://localhost:3003 (internal)"
echo "  Press Ctrl+C to stop both services."
echo "============================================================"
echo ""

wait
