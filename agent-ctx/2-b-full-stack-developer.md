# Task 2-b — full-stack-developer — Backend REST API routes

## Scope
Implement all Next.js 16 App Router route handlers for TranscriptFlow's REST API, plus two shared helpers (`src/lib/ffmpeg.ts`, `src/lib/zai.ts`).

## Files created (all lint-clean, all TS-clean)
- `src/lib/ffmpeg.ts` — `runFfmpeg(args: string[]): Promise<void>` (spawns `/usr/bin/ffmpeg -y ...`, rejects with stderr on non-zero exit).
- `src/lib/zai.ts` — `getZAI(): Promise<any>` (caches `ZAI.create()`).
- `src/app/api/sessions/route.ts` — `GET` (list newest-first), `POST` (create with status 'completed').
- `src/app/api/sessions/[id]/route.ts` — `GET` (404 if missing), `PATCH` (partial update), `DELETE` ({ success: true }).
- `src/app/api/sessions/[id]/summarize/route.ts` — `POST { language? }`. Sets status 'summarizing', calls LLM with strict-JSON system prompt, strips ```json fences, parses; on parse-fail falls back to raw text as summary + empty actionItems; on LLM-call-fail resets to 'completed' with an error-message summary.
- `src/app/api/sessions/[id]/translate/route.ts` — `POST { targetLanguage }`. Two LLM calls (transcript + summary), updates language, status 'completed'.
- `src/app/api/sessions/[id]/export/route.ts` — `POST { format }`. Validates against `EXPORT_FORMATS`, `formatExport`s, returns `{ content, mimeType, filename }` with sanitized title filename.
- `src/app/api/transcribe/upload/route.ts` — `POST` multipart. Validates file + 100MB cap, writes to tmp, `runFfmpeg` to 16k mono wav, base64 → ASR, creates session type 'upload', cleans up in finally. Returns 201.
- `src/app/api/transcribe/youtube/route.ts` — `POST { url, language?, title? }`. Validates YouTube URL, `yt-dlp -f bestaudio/best` (180s SIGKILL timeout), `runFfmpeg` to wav, ASR, creates session type 'youtube'. 400 on yt-dlp/ffmpeg failure.

## Verification
- `bun run lint` — **clean** (0 errors, 0 warnings).
- `bunx tsc --noEmit` — no errors in any new file. Pre-existing TS errors remain in `mini-services/transcription-service/index.ts` (different agent's scope) and `skills/**` (unrelated), both outside this task's scope.

## Decisions / risks
- **YouTube two-step**: chose yt-dlp download + own `runFfmpeg` conversion (instead of single-step `--audio-format wav --postprocessor-args`) to honor the "reuse `runFfmpeg` in upload + youtube" directive and gain explicit ffmpeg error visibility.
- **yt-dlp fragility**: inherent YouTube-side risk; mitigated by 180s timeout, `--no-playlist`, surfaced stderr in the 400 response. Operator remedy: `pip install -U yt-dlp` in `/home/z/.venv`.
- **Summarize LLM-call failure** (not parse failure): spec only covered parse-failure fallback; for full LLM-call failure I reset status to 'completed' and store `_(Summarization failed: <msg>)_` as summary. Easy to switch to a 500 if preferred.
- **Translate**: two sequential LLM calls; acceptable for typical transcript sizes.
- **ASR language**: SDK contract is `{ file_base64 }` only — `language` is stored as session metadata, ASR auto-detects.

## Did NOT touch
- `src/app/page.tsx`, `src/lib/constants.ts`, `src/lib/session-mapper.ts`, `src/lib/exporters.ts`, `prisma/schema.prisma`, `src/app/layout.tsx`.
- No test files created. Dev server not started (orchestrator manages it).
