import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mapSession } from '@/lib/session-mapper'
import { runFfmpeg } from '@/lib/ffmpeg'
import { transcribeWavFile } from '@/lib/local-asr'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { extname, basename, join } from 'node:path'
import { writeFile, readFile, unlink } from 'node:fs/promises'

const MAX_BYTES = 100 * 1024 * 1024 // 100 MB

async function safeUnlink(p: string) {
  try {
    await unlink(p)
  } catch {
    // ignore — file may not exist
  }
}

// POST /api/transcribe/upload
// Multipart form: file (audio or video), language (optional, default 'auto'), title (optional)
export async function POST(req: NextRequest) {
  const tempPaths: string[] = []
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const language = (formData.get('language') as string) || 'auto'
    const title = (formData.get('title') as string) || undefined

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }
    if (file.size === 0) {
      return NextResponse.json({ error: 'Uploaded file is empty' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `File too large (${file.size} bytes). Max is 100MB.` },
        { status: 413 }
      )
    }

    const originalName = file.name || 'upload'
    const originalExt = extname(originalName) || '.bin'
    const isVideo = (file.type || '').startsWith('video/')

    const inputPath = join(tmpdir(), `tf-up-${randomUUID()}${originalExt}`)
    const outputPath = join(tmpdir(), `tf-up-${randomUUID()}.wav`)
    tempPaths.push(inputPath, outputPath)

    const bytes = Buffer.from(await file.arrayBuffer())
    await writeFile(inputPath, bytes)

    // Convert to 16kHz mono WAV. For both audio and video inputs, this strips
    // any video stream (-vn) and re-encodes the audio as PCM s16le.
    const ffmpegArgs = isVideo
      ? ['-i', inputPath, '-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', outputPath]
      : ['-i', inputPath, '-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', outputPath]

    await runFfmpeg(ffmpegArgs)

    const wavBytes = await readFile(outputPath)
    const file_base64 = wavBytes.toString('base64')

    const transcript = await transcribeWavFile(outputPath)

    const baseName = basename(originalName, originalExt) || originalName
    const finalTitle = title && title.trim() ? title.trim() : baseName

    const row = await db.transcriptionSession.create({
      data: {
        title: finalTitle,
        type: 'upload',
        source: originalName,
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
    await Promise.all(tempPaths.map(safeUnlink))
  }
}
