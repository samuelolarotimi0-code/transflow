import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mapSession } from '@/lib/session-mapper'
import { runFfmpeg } from '@/lib/ffmpeg'
import { transcribeWavFile } from '@/lib/local-asr'
import { spawn, execFileSync } from 'node:child_process'
import { accessSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { readFile, unlink, readdir } from 'node:fs/promises'

const YT_DLP_TIMEOUT_MS = 180_000

function pathExists(path: string): boolean {
  try {
    accessSync(path)
    return true
  } catch {
    return false
  }
}

function findExecutable(name: string): string | null {
  try {
    const command = process.platform === 'win32' ? 'where' : 'which'
    const resolved = execFileSync(command, [name], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'], // Suppresses "INFO: Could not find files..." from where.exe
    })
      .trim()
      .split(/\r?\n/)[0]
    return resolved || null
  } catch {
    return null
  }
}

function resolveYtDlp(): string | null {
  if (process.env.YT_DLP_BIN) return process.env.YT_DLP_BIN
  return findExecutable('yt-dlp') || findExecutable('yt-dlp.exe')
}

const YT_DLP_BIN = resolveYtDlp()

interface ExecResult {
  code: number
  stdout: string
  stderr: string
}

// Run yt-dlp with a hard timeout. yt-dlp doesn't always respect timeouts
// gracefully, so we SIGKILL the process if it exceeds the limit.
function runYtDlp(args: string[], timeoutMs: number): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    if (!YT_DLP_BIN) {
      reject(
        new Error(
          'yt-dlp binary not found. Install yt-dlp or set YT_DLP_BIN to the yt-dlp executable path.'
        )
      )
      return
    }
    const proc = spawn(YT_DLP_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let timedOut = false

    if (proc.stdout) proc.stdout.on('data', (c: Buffer) => (stdout += c.toString()))
    if (proc.stderr) proc.stderr.on('data', (c: Buffer) => (stderr += c.toString()))

    const timer = setTimeout(() => {
      timedOut = true
      proc.kill('SIGKILL')
    }, timeoutMs)

    proc.on('error', (err) => {
      clearTimeout(timer)
      reject(new Error(`yt-dlp failed to start: ${err.message}`))
    })

    proc.on('close', (code) => {
      clearTimeout(timer)
      if (timedOut) {
        reject(new Error('yt-dlp timed out after ' + Math.round(timeoutMs / 1000) + 's'))
        return
      }
      resolve({ code: code ?? -1, stdout, stderr })
    })
  })
}

function extractVideoId(url: string): string | null {
  const m1 = url.match(/youtube\.com\/watch\?v=([\w-]{6,})/)
  if (m1) return m1[1]
  const m2 = url.match(/youtu\.be\/([\w-]{6,})/)
  if (m2) return m2[1]
  const m3 = url.match(/youtube\.com\/(?:shorts|embed)\/([\w-]{6,})/)
  if (m3) return m3[1]
  return null
}

async function safeUnlink(p: string) {
  try {
    await unlink(p)
  } catch {
    // ignore
  }
}

// Find the file yt-dlp wrote to tmpdir that starts with `prefix`. yt-dlp
// replaces %(ext)s with the actual extension, so the file is `<prefix>.<ext>`.
async function findDownloadedFile(dir: string, prefix: string): Promise<string | null> {
  const entries = await readdir(dir)
  for (const e of entries) {
    if (e.startsWith(prefix + '.') && !e.endsWith('.wav')) {
      return join(dir, e)
    }
  }
  return null
}

// POST /api/transcribe/youtube
// Body: { url, language?, title? }
export async function POST(req: NextRequest) {
  const uuidPrefix = `tf-yt-${randomUUID()}`
  const tmpDir = tmpdir()
  const wavPath = join(tmpDir, `${uuidPrefix}.wav`)

  let downloadedPath: string | null = null

  try {
    const body = await req.json().catch(() => ({}))
    const url = typeof body?.url === 'string' ? body.url.trim() : ''
    const language = typeof body?.language === 'string' && body.language ? body.language : 'auto'
    const title = typeof body?.title === 'string' && body.title.trim() ? body.title.trim() : undefined

    if (!url) {
      return NextResponse.json({ error: 'Missing "url" in body' }, { status: 400 })
    }

    const videoId = extractVideoId(url)
    if (!videoId) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL. Expected youtube.com/watch?v=... or youtu.be/...' },
        { status: 400 }
      )
    }

    // Step 1: download bestaudio (or best muxed fallback) without conversion.
    // yt-dlp writes to <tmpDir>/<uuid>.<ext>; we'll find the file afterwards.
    const outTemplate = join(tmpDir, `${uuidPrefix}.%(ext)s`)
    const downloadArgs = [
      '-f', 'bestaudio/best',
      '--no-playlist',
      '--no-warnings',
      // Use the Android player client which often bypasses YouTube's
      // "Sign in to confirm you're not a bot" checks in server environments.
      '--extractor-args', 'youtube:player_client=android,web',
      '--user-agent',
      'com.google.android.youtube/19.09.37 (Linux; U; Android 14)',
      '-o', outTemplate,
      url,
    ]

    let result: ExecResult
    try {
      result = await runYtDlp(downloadArgs, YT_DLP_TIMEOUT_MS)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return NextResponse.json(
        { error: `Could not download YouTube audio: ${msg}` },
        { status: 400 }
      )
    }

    if (result.code !== 0) {
      const tail = (result.stderr || result.stdout || '').slice(-1500)
      return NextResponse.json(
        { error: `Could not download YouTube audio: ${tail || `yt-dlp exited with code ${result.code}`}` },
        { status: 400 }
      )
    }

    downloadedPath = await findDownloadedFile(tmpDir, uuidPrefix)
    if (!downloadedPath) {
      return NextResponse.json(
        { error: 'Could not download YouTube audio: yt-dlp did not produce an audio file' },
        { status: 400 }
      )
    }

    // Step 2: convert the downloaded audio to 16kHz mono WAV using our shared
    // ffmpeg helper (reused from the upload route).
    try {
      await runFfmpeg([
        '-i', downloadedPath,
        '-vn',
        '-acodec', 'pcm_s16le',
        '-ar', '16000',
        '-ac', '1',
        wavPath,
      ])
    } catch (ffErr) {
      const msg = ffErr instanceof Error ? ffErr.message : String(ffErr)
      return NextResponse.json(
        { error: `Could not download YouTube audio: ffmpeg conversion failed: ${msg}` },
        { status: 400 }
      )
    }

    // Step 3: ASR.
    const wavBytes = await readFile(wavPath)
    const file_base64 = wavBytes.toString('base64')

    const transcript = await transcribeWavFile(wavPath)

    const finalTitle = title || `YouTube: ${videoId}`

    const row = await db.transcriptionSession.create({
      data: {
        title: finalTitle,
        type: 'youtube',
        source: url,
        language,
        status: 'completed',
        transcript,
      },
    })

    return NextResponse.json({ session: mapSession(row) }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    // Clean up any temp files we created: the downloaded audio, the wav, and
    // any intermediates yt-dlp may have left with our uuid prefix.
    try {
      const entries = await readdir(tmpDir)
      await Promise.all(
        entries
          .filter((e) => e.startsWith(uuidPrefix))
          .map((e) => safeUnlink(join(tmpDir, e)))
      )
    } catch {
      // ignore cleanup errors
    }
    if (downloadedPath) await safeUnlink(downloadedPath)
  }
}
