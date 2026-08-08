import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { accessSync, promises as fs } from 'node:fs'
import { execFile, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'
import { Server } from 'socket.io'
import ffmpegStatic from 'ffmpeg-static'
import { transcribeWavFile } from '../../src/lib/local-asr'

const execFileAsync = promisify(execFile)

const PORT = 3003

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

// Resolve ffmpeg binary: use explicit env var, ffmpeg-static package, or PATH lookup.
function resolveFfmpeg(): string {
  if (process.env.FFMPEG_BIN) return process.env.FFMPEG_BIN
  if (typeof ffmpegStatic === 'string' && ffmpegStatic && pathExists(ffmpegStatic)) {
    return ffmpegStatic
  }
  const found = findExecutable('ffmpeg')
  if (found) return found
  return 'ffmpeg'
}
const FFMPEG_BIN = resolveFfmpeg()

// ---------------------------------------------------------------------------
// Audio helpers
// ---------------------------------------------------------------------------

/** Pick a sensible file extension for a recorded blob based on mimeType. */
function extensionForMimeType(mimeType: string): string {
  const mt = (mimeType || '').toLowerCase()
  if (mt.includes('webm')) return '.webm'
  if (mt.includes('ogg')) return '.ogg'
  if (mt.includes('wav')) return '.wav'
  if (mt.includes('mp3')) return '.mp3'
  if (mt.includes('mp4') || mt.includes('m4a') || mt.includes('aac')) return '.m4a'
  if (mt.includes('flac')) return '.flac'
  // Default to webm — MediaRecorder on the web produces audio/webm;codecs=opus
  return '.webm'
}

/** Convert any audio file to a 16 kHz mono WAV using ffmpeg. */
async function convertToWav(inputPath: string, outputPath: string): Promise<void> {
  // ffmpeg writes progress to stderr; we capture (and ignore) stdout/stderr
  // via execFile's default behavior. On non-zero exit we throw with the tail.
  const { stderr } = await execFileAsync(FFMPEG_BIN, [
    '-y',
    '-i', inputPath,
    '-vn',
    '-acodec', 'pcm_s16le',
    '-ar', '16000',
    '-ac', '1',
    outputPath,
  ])
  // Keep stderr out of the noisy logs but available for debugging if needed.
  void stderr
}

/** Safely delete a file (ignore errors if it doesn't exist). */
async function safeRemove(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath)
  } catch {
    /* ignore — file may not exist */
  }
}

interface AudioChunkPayload {
  base64?: string
  mimeType?: string
  language?: string
}

interface StartPayload {
  sessionId?: string
  language?: string
}

// ---------------------------------------------------------------------------
// HTTP + Socket.io server
// ---------------------------------------------------------------------------

const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  // Minimal health-check endpoint. The gateway may hit "/" with GET during
  // polling transport negotiation; socket.io will handle the WS upgrade.
  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, service: 'transcription-service', port: PORT }))
    return
  }
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'not found' }))
})

const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// Map socket ID -> session audio header / chunks
const socketHeaderMap = new Map<string, Buffer>()
const socketAudioBuffers = new Map<string, Buffer[]>()

io.on('connection', (socket) => {
  const clientIp = socket.handshake.address
  console.log(`[socket] connected id=${socket.id} ip=${clientIp}`)

  socket.on('start', (payload: StartPayload) => {
    try {
      socketHeaderMap.delete(socket.id)
      socketAudioBuffers.set(socket.id, [])
      const sessionId = payload?.sessionId
      const language = payload?.language || 'auto'
      console.log(`[socket] start id=${socket.id} session=${sessionId ?? '-'} lang=${language}`)
      socket.emit('status', { status: 'listening' })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[socket] start handler error id=${socket.id}:`, message)
      socket.emit('error', { message })
      socket.emit('status', { status: 'error', message })
    }
  })

  socket.on('audio-chunk', async (payload: AudioChunkPayload) => {
    const { base64, mimeType, language } = payload || {}
    const chunkLanguage = language || 'auto'
    const mt = mimeType || 'audio/webm'

    if (!base64 || typeof base64 !== 'string') {
      const message = 'audio-chunk received without base64 payload'
      console.warn(`[socket] id=${socket.id} ${message}`)
      socket.emit('error', { message })
      socket.emit('status', { status: 'error', message })
      return
    }

    const inputExt = extensionForMimeType(mt)
    const inputPath = join(tmpdir(), `asr-in-${randomUUID()}${inputExt}`)
    const outputPath = join(tmpdir(), `asr-out-${randomUUID()}.wav`)

    try {
      // Decode base64 → temp input file. Buffer.from handles standard b64.
      const buffer = Buffer.from(base64, 'base64')
      
      // Store header chunk from chunk #0 so subsequent streaming chunks have valid WebM headers
      if (!socketHeaderMap.has(socket.id)) {
        socketHeaderMap.set(socket.id, buffer)
        await fs.writeFile(inputPath, buffer)
      } else {
        const header = socketHeaderMap.get(socket.id)!
        await fs.writeFile(inputPath, Buffer.concat([header, buffer]))
      }

      // Convert to 16 kHz mono WAV.
      try {
        await convertToWav(inputPath, outputPath)
      } catch (convErr) {
        const message =
          convErr instanceof Error ? convErr.message : String(convErr)
        console.error(
          `[socket] ffmpeg conversion failed id=${socket.id} ext=${inputExt}:`,
          message,
        )
        socket.emit('error', { message: `ffmpeg conversion failed: ${message}` })
        socket.emit('status', { status: 'error', message })
        return
      }

      // Notify client we are transcribing.
      socket.emit('status', { status: 'transcribing' })

      // Read WAV, base64-encode, send to ASR.
      const wavBuffer = await fs.readFile(outputPath)
      const file_base64 = wavBuffer.toString('base64')

      const text = await transcribeAudioBuffer(Buffer.from(wavBuffer))

      console.log(
        `[socket] transcript id=${socket.id} lang=${chunkLanguage} len=${text.length} preview=${JSON.stringify(
          text.slice(0, 80),
        )}`,
      )

      socket.emit('transcript', { text, isFinal: true })
      socket.emit('status', { status: 'listening' })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[socket] transcription error id=${socket.id}:`, message)
      socket.emit('error', { message })
      socket.emit('status', { status: 'error', message })
      // Do NOT crash the server — continue listening for further chunks.
    } finally {
      // ALWAYS clean up temp files.
      await Promise.all([safeRemove(inputPath), safeRemove(outputPath)])
    }
  })

  socket.on('stop', () => {
    console.log(`[socket] stop id=${socket.id}`)
    socketHeaderMap.delete(socket.id)
    socketAudioBuffers.delete(socket.id)
    socket.emit('status', { status: 'stopped' })
  })

  socket.on('disconnect', (reason) => {
    console.log(`[socket] disconnected id=${socket.id} reason=${reason}`)
    socketHeaderMap.delete(socket.id)
    socketAudioBuffers.delete(socket.id)
  })

  socket.on('error', (error) => {
    console.error(`[socket] socket error id=${socket.id}:`, error)
  })
})

async function transcribeAudioBuffer(wavBuffer: Buffer): Promise<string> {
  const tempPath = join(tmpdir(), `tf-local-asr-${randomUUID()}.wav`)
  try {
    await fs.writeFile(tempPath, wavBuffer)
    return await transcribeWavFile(tempPath)
  } finally {
    await safeRemove(tempPath)
  }
}

httpServer.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`)
})

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
let shuttingDown = false
function shutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[server] received ${signal}, shutting down...`)
  // Close existing socket.io connections first so clients get a clean close.
  io.close((err) => {
    if (err) console.error('[server] socket.io close error:', err)
  })
  httpServer.close((err) => {
    if (err) console.error('[server] http close error:', err)
    console.log('[server] closed')
    process.exit(err ? 1 : 0)
  })
  // Hard exit fallback in case something hangs.
  setTimeout(() => {
    console.error('[server] shutdown timed out, forcing exit')
    process.exit(1)
  }, 8000)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// Keep the process resilient to unhandled rejections (don't crash on one bad
// chunk's promise), but always log them.
process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandledRejection:', reason)
})
process.on('uncaughtException', (err) => {
  console.error('[server] uncaughtException:', err)
})
