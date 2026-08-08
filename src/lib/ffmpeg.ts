import { spawn, execFileSync } from 'node:child_process'
import { accessSync } from 'node:fs'
import ffmpegStatic from 'ffmpeg-static'

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

// Resolve ffmpeg: explicit env var > ffmpeg-static > PATH lookup > bare 'ffmpeg'.
function resolveFfmpeg(): string | null {
  if (process.env.FFMPEG_BIN) return process.env.FFMPEG_BIN
  if (typeof ffmpegStatic === 'string' && ffmpegStatic && pathExists(ffmpegStatic)) {
    return ffmpegStatic
  }
  return findExecutable('ffmpeg')
}
const FFMPEG_BIN = resolveFfmpeg()

/**
 * Runs ffmpeg with the given args (without the leading `-y`, which is added
 * automatically so we always overwrite outputs). Resolves on a clean exit,
 * rejects with an Error containing stderr on a non-zero exit code or spawn
 * failure.
 */
export function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!FFMPEG_BIN) {
      reject(
        new Error(
          'ffmpeg binary not found. Install ffmpeg or set FFMPEG_BIN to the ffmpeg executable path.'
        )
      )
      return
    }
    const proc = spawn(FFMPEG_BIN, ['-y', ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stderr = ''
    if (proc.stderr) {
      proc.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString()
      })
    }

    proc.on('error', (err) => {
      reject(new Error(`ffmpeg failed to start: ${err.message}`))
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        const tail = stderr.length > 4000 ? stderr.slice(-4000) : stderr
        reject(new Error(`ffmpeg exited with code ${code}: ${tail}`))
      }
    })
  })
}
