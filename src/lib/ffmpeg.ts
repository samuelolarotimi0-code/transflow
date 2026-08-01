import { spawn, execFileSync } from 'node:child_process'

// Resolve ffmpeg: explicit env var > PATH lookup > bare 'ffmpeg'.
function resolveFfmpeg(): string {
  if (process.env.FFMPEG_BIN) return process.env.FFMPEG_BIN
  try {
    const which = execFileSync('which', ['ffmpeg'], { encoding: 'utf8' }).trim()
    if (which) return which
  } catch {
    // Windows has no `which` — fall through to bare name.
  }
  return 'ffmpeg'
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
