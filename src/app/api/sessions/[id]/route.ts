import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mapSession } from '@/lib/session-mapper'

type Params = { params: Promise<{ id: string }> }

// GET /api/sessions/:id
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const row = await db.transcriptionSession.findUnique({ where: { id } })
    if (!row) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    return NextResponse.json({ session: mapSession(row) })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH /api/sessions/:id
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))

    const data: Record<string, unknown> = {}
    if (typeof body?.title === 'string') data.title = body.title
    if (typeof body?.transcript === 'string') data.transcript = body.transcript
    if (typeof body?.language === 'string') data.language = body.language
    if (typeof body?.status === 'string') data.status = body.status

    const row = await db.transcriptionSession.update({
      where: { id },
      data,
    })
    return NextResponse.json({ session: mapSession(row) })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status = /Record to update not found|does not exist/i.test(message) ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

// DELETE /api/sessions/:id
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    await db.transcriptionSession.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status = /Record to delete does not exist|does not exist/i.test(message) ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
