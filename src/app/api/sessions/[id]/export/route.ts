import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mapSession } from '@/lib/session-mapper'
import { EXPORT_FORMATS } from '@/lib/constants'
import { formatExport } from '@/lib/exporters'

type Params = { params: Promise<{ id: string }> }

// POST /api/sessions/:id/export
// Body: { format }  where format ∈ EXPORT_FORMATS ids
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const format = typeof body?.format === 'string' ? body.format : ''

    const fmt = EXPORT_FORMATS.find((f) => f.id === format)
    if (!fmt) {
      return NextResponse.json(
        { error: `Unsupported format: ${format || '(none)'}` },
        { status: 400 }
      )
    }

    const row = await db.transcriptionSession.findUnique({ where: { id } })
    if (!row) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const mapped = mapSession(row)
    const content = formatExport(fmt.id, mapped)

    const safeTitle = (row.title || 'transcript').replace(/[^a-z0-9-_]+/gi, '_')
    const filename = `${safeTitle}.${fmt.ext}`
    const mimeType = fmt.mime

    return NextResponse.json({ content, mimeType, filename })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
