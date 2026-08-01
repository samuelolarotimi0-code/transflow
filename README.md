# TranscriptFlow

Live & video transcription with AI-powered summaries, action items, translation, and project-management export (Notion / Trello / Jira).

## Features

- **Live transcription** — real-time mic capture streamed to a speech-recognition service via WebSocket.
- **Video / audio upload** — drag-and-drop MP4, MOV, MP3, WAV, M4A… (ffmpeg extracts audio automatically).
- **YouTube URL** — paste a link and the audio is downloaded & transcribed.
- **20+ languages** — transcribe and summarize in English, Spanish, French, Chinese, Japanese, Arabic, Swahili, Yoruba, Igbo, Hausa, and more.
- **AI summaries & action items** — structured markdown summary plus prioritized action items with assignees and due dates.
- **Translation** — one-click translate the transcript + summary into any supported language.
- **7 export formats** — TXT, Markdown, JSON, SRT subtitles, Notion (markdown), Trello (card JSON), Jira (CSV). Plus copy-to-clipboard.

---

## Run on localhost

### 1. Prerequisites

| Tool | Why | Install |
|------|-----|---------|
| **Node.js 18+** | Next.js runtime | <https://nodejs.org> |
| **Bun** | Package manager + runs the mini-service | `curl -fsSL https://bun.sh/install \| bash` |
| **ffmpeg** | Audio extraction from video/any audio format | macOS: `brew install ffmpeg` · Ubuntu: `sudo apt install ffmpeg` · Windows: `choco install ffmpeg` |
| **yt-dlp** *(optional)* | YouTube downloads | `pip install -U yt-dlp` |
| **Git** | To clone/transfer the project | <https://git-scm.com> |

### 2. Get the code onto your machine

Since the project currently lives in a cloud sandbox, transfer the whole project folder to your machine. You can:

- **Zip & download** the project folder, or
- **git init + push** to a private GitHub repo, then `git clone` locally, or
- **scp/rsync** from the sandbox to your machine.

### 3. Configure environment

```bash
cd TranscriptFlow        # or whatever you named the folder
cp .env.example .env     # creates the SQLite DATABASE_URL
```

The default `.env` uses a relative path so the database file lives at `db/custom.db` inside the project — no external database server needed.

### 4. Install dependencies

```bash
bun install
cd mini-services/transcription-service && bun install && cd ../..
```

### 5. Set up the database

```bash
bun run db:push      # creates the SQLite file + tables
```

### 6. Start both services

You need **two** processes running: the Next.js app (port 3000) and the live-transcription WebSocket service (port 3003).

**Option A — one command (recommended):**

```bash
./start.sh
```

This script checks prerequisites, installs deps if missing, syncs the DB, and launches both services. Press `Ctrl+C` to stop both.

**Option B — two terminals:**

```bash
# Terminal 1 — Next.js app
bun run dev

# Terminal 2 — live transcription service
cd mini-services/transcription-service
bun run dev
```

### 7. Open the app

Go to **<http://localhost:3000>** in your browser.

> **Microphone note:** Browsers only allow mic access on `localhost` or `https://`. Live transcription works out of the box on `http://localhost:3000`.

---

## How it works

```
Browser (localhost:3000)
  ├── REST API ─────────────► Next.js API routes (port 3000)
  │                            ├── /api/sessions (CRUD)
  │                            ├── /api/sessions/:id/summarize   → LLM
  │                            ├── /api/sessions/:id/translate   → LLM
  │                            ├── /api/sessions/:id/export
  │                            ├── /api/transcribe/upload        → ffmpeg + ASR
  │                            └── /api/transcribe/youtube       → yt-dlp + ASR
  │
  └── WebSocket ────────────► mini-services/transcription-service (port 3003)
                               └── socket.io → ffmpeg → ASR → transcript events
```

- The **Next.js app** serves the UI and all REST APIs.
- The **mini-service** is an independent Bun + Socket.io server that handles real-time live transcription (it can't run inside Next.js because it needs a long-lived WebSocket server).
- The frontend auto-detects localhost and connects directly to port 3003 (no proxy needed). In the cloud preview it uses the gateway's `XTransformPort` query param.

---

## Ports

| Port | Service | Purpose |
|------|---------|---------|
| 3000 | Next.js | Web UI + REST API |
| 3003 | mini-service | Live transcription WebSocket |

Both must be free. If something is already using a port, kill it or change the port in `package.json` (app) and `mini-services/transcription-service/index.ts` (`PORT` constant) plus the matching URL in `src/components/transcription/live-tab.tsx`.

---

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `file:./db/custom.db` | SQLite database location |
| `FFMPEG_BIN` | *(auto-detected on PATH)* | Override ffmpeg binary path |

---

## Troubleshooting

**"Microphone permission denied"** — Click the camera/mic icon in your browser's address bar and allow access, then reload.

**Live tab shows "Could not connect to transcription service"** — The mini-service on port 3003 isn't running. Start it: `cd mini-services/transcription-service && bun run dev`.

**YouTube upload fails with "Sign in to confirm you're not a bot"** — YouTube sometimes blocks automated downloads. On your own machine (with a normal residential IP) this usually works. If not, try `pip install -U yt-dlp` to get the latest version, or run with cookies: edit `src/app/api/transcribe/youtube/route.ts` and add `--cookies-from-browser`, `chrome` to `downloadArgs`.

**ffmpeg not found** — Install it (see table above) and ensure it's on your PATH, or set `FFMPEG_BIN=/full/path/to/ffmpeg` in `.env`.

**Port already in use** — Find and kill the process: `lsof -i :3000` (macOS/Linux) or `netstat -ano | findstr :3000` (Windows).

---

## Project structure

```
.
├── prisma/schema.prisma              # TranscriptionSession model
├── src/
│   ├── app/
│   │   ├── page.tsx                  # Main UI (Live/Upload/YouTube/Library tabs)
│   │   ├── layout.tsx
│   │   └── api/                      # REST routes
│   │       ├── sessions/             # CRUD + summarize + translate + export
│   │       └── transcribe/           # upload + youtube
│   ├── components/
│   │   ├── ui/                       # shadcn/ui components
│   │   └── transcription/            # App-specific components
│   └── lib/
│       ├── constants.ts              # Languages + export formats + types
│       ├── db.ts                     # Prisma client
│       ├── ffmpeg.ts                 # ffmpeg helper
│       ├── zai.ts                    # z-ai-web-dev-sdk cache
│       ├── exporters.ts              # txt/md/json/srt/notion/trello/jira
│       └── hooks.ts                  # apiFetch + useSessions
├── mini-services/
│   └── transcription-service/        # Socket.io live transcription (port 3003)
├── .env.example
└── start.sh                          # One-command launcher
```
