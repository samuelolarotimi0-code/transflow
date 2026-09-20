# TranscriptFlow (Transflow)

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-SQLite-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![Whisper](https://img.shields.io/badge/ASR-OpenAI_Whisper-orange?style=flat-square)](https://github.com/openai/whisper)

**TranscriptFlow** is a modern, full-stack AI audio & video transcription platform with real-time speech recognition, local Whisper ASR processing, AI-powered meeting summaries, automated action-item extraction, multilingual translation, and one-click export to project management workflows (**Notion, Trello, Jira**).

---

## Highlights & Features

- 🎙️ **Real-Time Live Transcription**: In-browser speech recognition via Web Speech API with live interim streaming and audio visualizer, plus an optional background WebSocket mini-service.
- 📁 **Universal Audio & Video Upload**: Drag-and-drop support for MP4, MOV, MP3, WAV, M4A, FLAC, OGG, and WebM (up to 100MB). FFmpeg automatically strips video and resamples audio to 16 kHz mono 16-bit PCM WAV.
- 📺 **YouTube Audio Extraction**: Paste any YouTube link (videos, shorts, embeds); downloads audio via `yt-dlp` using optimized Android player client headers to bypass bot-detection safeguards.
- 🧠 **Local Whisper ASR Engine**: Subprocess-driven offline transcription powered by `openai-whisper` (`tiny`, `base`, `small`, `medium`, `large`). Audio data stays private on your machine.
- 🤖 **AI Summaries & Action Items**: Generates executive summaries in markdown alongside prioritized action items with assignees, priorities (`high`, `medium`, `low`), and due dates.
- 🌐 **20+ Supported Languages**: Transcribe, detect, and translate across English, Spanish, French, German, Italian, Portuguese, Dutch, Russian, Arabic, Chinese, Japanese, Korean, Hindi, Turkish, Polish, Swahili, Yoruba, Igbo, Hausa, and more.
- 📤 **7 Export Formats + Clipboard**:
  - **Documents**: Plain Text (`.txt`), Markdown (`.md`), Structured JSON (`.json`)
  - **Subtitles**: SubRip Timestamps (`.srt`)
  - **Project Management**: **Notion** (Markdown pages), **Trello** (Cards & checklists JSON), **Jira** (Issues CSV)
  - **Quick Copy**: One-click copy formatted transcript and summaries to clipboard.
- 🌗 **Responsive Modern Interface**: Built with Tailwind CSS v4, Lucide icons, Sonner toasts, and dynamic dark/light mode.

---

## Architecture Overview

```text
Browser (http://localhost:3000)
  │
  ├── Web Speech API ────────► Instant client-side live mic transcription
  │
  ├── REST API ──────────────► Next.js 16 App Router (port 3000)
  │                             ├── /api/sessions             → CRUD (Prisma SQLite)
  │                             ├── /api/sessions/:id/summarize → LLM (Summary + Action Items)
  │                             ├── /api/sessions/:id/translate → LLM (Multilingual Translation)
  │                             ├── /api/sessions/:id/export    → TXT / MD / JSON / SRT / Notion / Trello / Jira
  │                             ├── /api/transcribe/upload      → FFmpeg WAV conversion → local_asr.py (Whisper)
  │                             └── /api/transcribe/youtube     → yt-dlp download → FFmpeg → local_asr.py (Whisper)
  │
  └── WebSocket (Optional) ──► mini-services/transcription-service (port 3003)
                                └── Socket.io → FFmpeg audio streaming → Whisper ASR
```

---

## System Requirements & Prerequisites

| Tool | Recommended Version | Purpose | Installation |
| :--- | :--- | :--- | :--- |
| **Node.js** | `v18+` or `v20+` | Next.js runtime | [nodejs.org](https://nodejs.org/) |
| **Bun** (or **npm**) | `v1.1+` | Package manager & scripts | `curl -fsSL https://bun.sh/install \| bash` |
| **Python** | `3.10` – `3.13` | Runs local OpenAI Whisper ASR | [python.org](https://www.python.org/) or Microsoft Store |
| **openai-whisper** | Latest | Speech-to-text model | `pip install -U openai-whisper` |
| **FFmpeg** | `v5.0+` | Audio re-encoding & video strip | System package manager or project `./bin/` |
| **yt-dlp** *(optional)*| Latest | YouTube audio extraction | `pip install -U yt-dlp` or project `./bin/` |

### Installing External Binaries by OS

- **Windows**:
  - FFmpeg & yt-dlp can be placed directly in `./bin/ffmpeg.exe` and `./bin/yt-dlp.exe` (Transflow automatically checks the `./bin` folder first!).
  - Or install via package manager: `winget install Gyan.FFmpeg` and `winget install yt-dlp.yt-dlp`.
- **macOS**:
  ```bash
  brew install ffmpeg yt-dlp
  ```
- **Ubuntu / Debian Linux**:
  ```bash
  sudo apt update && sudo apt install -y ffmpeg
  pip install -U yt-dlp
  ```

---

## Step-by-Step Local Setup

### 1. Clone & Navigate to Repository

```bash
git clone https://github.com/your-username/transflow.git
cd transflow
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Review your `.env` settings:

```dotenv
DATABASE_URL="file:./db/custom.db"

# Path to the Python executable where openai-whisper is installed
# Windows example:
LOCAL_ASR_PYTHON="C:\Python312\python.exe"
# macOS/Linux example:
# LOCAL_ASR_PYTHON="./.venv/bin/python"

# Whisper model size (tiny, base, small, medium, large)
WHISPER_MODEL="base"

# Optional: Custom binary paths if not in system PATH or ./bin
# FFMPEG_BIN="./bin/ffmpeg.exe"
# YT_DLP_BIN="./bin/yt-dlp.exe"
```

### 3. Install Python Whisper Dependencies

Create a virtual environment or install into your active Python environment:

```bash
# Using python venv:
python -m venv .venv

# Activate venv:
# Windows (PowerShell): .\.venv\Scripts\Activate.ps1
# Windows (cmd): .\.venv\Scripts\activate.bat
# macOS/Linux: source .venv/bin/activate

# Install Whisper & PyTorch
pip install -r mini-services/transcription-service/requirements.txt
```

> **Note on PyTorch**: If you have an NVIDIA GPU and want GPU acceleration, install the CUDA-enabled build of PyTorch via [pytorch.org](https://pytorch.org/get-started/locally/). Otherwise, Whisper will run reliably on CPU using `fp16=False`.

### 4. Install Node Dependencies

```bash
# Using Bun (preferred):
bun install
cd mini-services/transcription-service && bun install && cd ../..

# OR using npm:
npm install
cd mini-services/transcription-service && npm install && cd ../..
```

### 5. Initialize the SQLite Database

Run Prisma to generate the client and synchronize the local SQLite database schema:

```bash
# Using Bun:
bun run db:push

# OR using npm:
npm run db:push
```

### 6. Run the Application

#### Option A: One-Command Start (Bash / macOS / Linux / WSL)

```bash
./start.sh
```

#### Option B: Standard Terminal Commands

**Terminal 1 — Next.js Web App (Port 3000):**
```bash
bun run dev
# OR: npm run dev
```

**Terminal 2 (Optional) — WebSocket Live Transcription Service (Port 3003):**
```bash
cd mini-services/transcription-service
bun run dev
# OR: npm run dev
```

Open your browser at **[http://localhost:3000](http://localhost:3000)**.

---

## Environment Variables Reference

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `file:./db/custom.db` | SQLite database connection string for Prisma. |
| `LOCAL_ASR_PYTHON` | Auto-detected | Path to the Python executable with `openai-whisper` installed. |
| `WHISPER_MODEL` | `base` | Whisper model size (`tiny`, `base`, `small`, `medium`, `large`). |
| `FFMPEG_BIN` | Auto-detected | Path to the `ffmpeg` binary (checked in `./bin`, PATH, or custom). |
| `YT_DLP_BIN` | Auto-detected | Path to the `yt-dlp` binary (checked in `./bin`, PATH, or custom). |

---

## REST API Reference

### Sessions API

- **`GET /api/sessions`**  
  List all saved transcription sessions, sorted by newest first.

- **`POST /api/sessions`**  
  Create a new session record manually.  
  *Payload*: `{ title, type, language, transcript, duration? }`

- **`GET /api/sessions/:id`**  
  Fetch detailed session object including transcript, segments, summary, and action items.

- **`DELETE /api/sessions/:id`**  
  Delete a session by ID.

- **`POST /api/sessions/:id/summarize`**  
  Generate or regenerate executive summary and prioritized action items using AI.  
  *Payload*: `{ language?: string }`

- **`POST /api/sessions/:id/translate`**  
  Translate the session transcript and summary into a designated language.  
  *Payload*: `{ targetLanguage: string }` (e.g. `'es'`, `'fr'`, `'de'`)

- **`GET /api/sessions/:id/export?format=<format>`**  
  Export session in one of 7 formats (`txt`, `md`, `json`, `srt`, `notion`, `trello`, `jira`).

### Transcription API

- **`POST /api/transcribe/upload`**  
  Multipart form upload (`file`, optional `language`, optional `title`). Converts audio to 16 kHz mono WAV via FFmpeg, transcribes via local Whisper, and stores session in SQLite.

- **`POST /api/transcribe/youtube`**  
  JSON body (`url`, optional `language`, optional `title`). Downloads audio via `yt-dlp`, converts to WAV, transcribes via local Whisper, and stores session.

---

## Project Structure

```text
transflow/
├── bin/                                # Local pre-compiled binaries (ffmpeg.exe, yt-dlp.exe)
├── mini-services/
│   └── transcription-service/
│       ├── index.ts                    # Socket.io live streaming server (port 3003)
│       ├── local_asr.py                # Whisper Python runner script
│       ├── requirements.txt            # Python dependencies (openai-whisper)
│       └── package.json
├── prisma/
│   ├── schema.prisma                   # SQLite schema definition (TranscriptionSession)
│   └── db/
│       └── custom.db                   # Local SQLite database file
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── sessions/               # CRUD, summarize, translate, export endpoints
│   │   │   └── transcribe/             # Upload and YouTube transcription endpoints
│   │   ├── globals.css                 # Custom styles, equalizer, animations
│   │   ├── layout.tsx                  # Root layout with theme provider & Sonner toast
│   │   └── page.tsx                    # Main 4-tab interface (Live, Upload, YouTube, Library)
│   ├── components/
│   │   ├── theme-toggle.tsx            # Light/Dark mode switcher
│   │   ├── ui/                         # shadcn/ui primitives
│   │   └── transcription/              # Feature components:
│   │       ├── live-tab.tsx            # In-browser speech recognition + live controls
│   │       ├── upload-tab.tsx          # Drag-and-drop file upload & progress
│   │       ├── youtube-tab.tsx         # YouTube link intake & thumbnail preview
│   │       ├── library-tab.tsx         # Saved sessions grid & filters
│   │       ├── session-detail.tsx      # Modal with summary, actions, translation, & export
│   │       ├── language-select.tsx     # 20-language picker with flags
│   │       └── export-menu.tsx         # 7-format export dropdown
│   └── lib/
│       ├── constants.ts                # Supported languages, export formats, TypeScript types
│       ├── db.ts                       # Prisma client singleton
│       ├── exporters.ts                # Serializers for TXT, MD, JSON, SRT, Notion, Trello, Jira
│       ├── ffmpeg.ts                   # Robust cross-platform FFmpeg execution helper
│       ├── hooks.ts                    # SWR-like data fetcher and session state hook
│       ├── local-asr.ts                # Cross-platform Python/Whisper subprocess runner
│       ├── session-mapper.ts           # DB row to frontend JSON mapper
│       └── zai.ts                      # AI SDK client
├── .env.example                        # Environment template
├── package.json                        # Node dependencies & scripts
├── start.sh                            # Bash startup automation script
└── tsconfig.json                       # TypeScript compiler configuration
```

---

## Troubleshooting

### 1. `whisper import failed` or Local Transcription Fails
- Ensure you have installed `openai-whisper` in your Python environment:
  ```bash
  pip install -U openai-whisper
  ```
- Set `LOCAL_ASR_PYTHON` in `.env` to the absolute path of your Python binary (for example: `C:\Python312\python.exe` or `./.venv/Scripts/python.exe`).

### 2. Microphone Permission Denied
- Live recording requires browser microphone permission.
- Browsers enforce that microphone access is restricted to secure contexts (`https://` or `http://localhost`).
- If blocked, click the lock/settings icon in your browser's address bar, enable the **Microphone** permission, and reload the tab.

### 3. YouTube Download Blocked ("Sign in to confirm you're not a bot")
- YouTube frequently updates bot-detection for automated IP ranges.
- `Transflow` already passes `--extractor-args youtube:player_client=android,web` with an Android user-agent to bypass standard checks.
- If issues persist on your IP, upgrade yt-dlp to the latest release:
  ```bash
  pip install -U yt-dlp
  ```
- Or pass browser cookies to yt-dlp in `src/app/api/transcribe/youtube/route.ts` via `--cookies-from-browser chrome`.

### 4. FFmpeg Not Found
- Ensure FFmpeg is accessible:
  - Place `ffmpeg.exe` inside the project's `./bin` folder, or
  - Install it via your OS package manager (`winget`, `choco`, `brew`, or `apt`), or
  - Specify the exact path in `.env`: `FFMPEG_BIN="/path/to/ffmpeg"`.

### 5. Port Already in Use (Port 3000 or 3003)
- Check and terminate any existing process occupying the port:
  - **Windows**: `netstat -ano | findstr :3000` then `taskkill /PID <PID> /F`
  - **macOS / Linux**: `lsof -ti:3000 | xargs kill -9`

---

## License

This project is licensed under the MIT License.
