import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mapSession } from '@/lib/session-mapper'
import { getLanguageLabel } from '@/lib/constants'
import { getZAI } from '@/lib/zai'

type Params = { params: Promise<{ id: string }> }

async function translateText(text: string, langLabel: string): Promise<string> {
  if (!text.trim()) return text
  const SYSTEM_PROMPT =
    `You are a professional translator. Translate the provided text into ${langLabel}. ` +
    'Preserve meaning, tone, and any markdown formatting. Output ONLY the translated text — no commentary.'
  const zai = await getZAI()
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: SYSTEM_PROMPT },
      { role: 'user', content: text },
    ],
    thinking: { type: 'disabled' },
  })
  const out: string = completion?.choices?.[0]?.message?.content ?? ''
  return out.trim() || text
}

// POST /api/sessions/:id/translate
// Body: { targetLanguage }  (a real language code, not 'auto')
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const targetLanguage = typeof body?.targetLanguage === 'string' ? body.targetLanguage : ''

    if (!targetLanguage || targetLanguage === 'auto') {
      return NextResponse.json(
        { error: 'targetLanguage must be a specific language code (not "auto")' },
        { status: 400 }
      )
    }

    const row = await db.transcriptionSession.findUnique({ where: { id } })
    if (!row) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const langLabel = getLanguageLabel(targetLanguage)

    const translatedTranscript = await translateText(row.transcript || '', langLabel)
    const translatedSummary = row.summary ? await translateText(row.summary, langLabel) : row.summary

    const updated = await db.transcriptionSession.update({
      where: { id },
      data: {
        transcript: translatedTranscript,
        summary: translatedSummary,
        language: targetLanguage,
        status: 'completed',
      },
    })

    return NextResponse.json({ session: mapSession(updated) })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
