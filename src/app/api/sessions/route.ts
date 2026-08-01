import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mapSession } from '@/lib/session-mapper'
import type { SessionType } from '@/lib/constants'

// GET /api/sessions — list all sessions newest-first
export async function GET() {
  try {
    const rows = await db.transcriptionSession.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ sessions: rows.map(mapSession) })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/sessions — create a session (used by live flow to persist transcript)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const title = typeof body?.title === 'string' && body.title.trim() ? body.title.trim() : 'Untitled session'
    const type = (typeof body?.type === 'string' ? body.type : 'live') as SessionType
    const language = typeof body?.language === 'string' && body.language ? body.language : 'auto'
    const transcript = typeof body?.transcript === 'string' ? body.transcript : ''
    const source = typeof body?.source === 'string' && body.source ? body.source : null
    const duration =
      typeof body?.duration === 'number' && Number.isFinite(body.duration) ? Math.max(0, Math.floor(body.duration)) : null

    const row = await db.transcriptionSession.create({
      data: {
        title,
        type,
        language,
        status: 'completed',
        transcript,
        source,
        duration,
      },
    })
    return NextResponse.json({ session: mapSession(row) }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
