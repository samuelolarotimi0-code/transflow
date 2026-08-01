import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mapSession } from '@/lib/session-mapper'
import { getLanguageLabel, type ActionItem } from '@/lib/constants'
import { getZAI } from '@/lib/zai'

type Params = { params: Promise<{ id: string }> }

// Strip ```json ... ``` / ``` ... ``` fences and surrounding whitespace
// from an LLM response so we can JSON.parse it.
function stripFences(raw: string): string {
  let s = raw.trim()
  const fenceStart = s.match(/^```(?:json)?\s*/i)
  if (fenceStart) {
    s = s.slice(fenceStart[0].length)
  }
  if (s.endsWith('```')) {
    s = s.slice(0, -3)
  }
  return s.trim()
}

function coerceActionItems(raw: unknown): ActionItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
    .map((a) => {
      const item: ActionItem = { text: String(a.text ?? '') }
      if (typeof a.assignee === 'string' && a.assignee) item.assignee = a.assignee
      if (a.priority === 'high' || a.priority === 'medium' || a.priority === 'low') {
        item.priority = a.priority
      }
      if (typeof a.due === 'string' && a.due) item.due = a.due
      return item
    })
    .filter((a) => a.text.length > 0)
}

// POST /api/sessions/:id/summarize
// Body: { language? }  (default = session.language; if 'auto' use 'en')
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))

    const row = await db.transcriptionSession.findUnique({ where: { id } })
    if (!row) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const requestedLang = typeof body?.language === 'string' && body.language ? body.language : row.language
    const langCode = !requestedLang || requestedLang === 'auto' ? 'en' : requestedLang
    const langLabel = getLanguageLabel(langCode)

    // Mark as summarizing
    await db.transcriptionSession.update({
      where: { id },
      data: { status: 'summarizing' },
    })

    const transcript = row.transcript || ''

    const SYSTEM_PROMPT =
      'You are an expert meeting analyst. Read the transcript and produce a concise summary plus actionable next steps. ' +
      'You MUST respond with STRICT JSON only — no markdown fences, no commentary. ' +
      'The JSON shape is: {"summary": string, "actionItems": [{"text": string, "assignee": string, "priority": "high"|"medium"|"low", "due": string}]}. ' +
      'The summary should be 3-5 short paragraphs or bullet points in markdown. ' +
      'actionItems should capture concrete tasks, decisions, and follow-ups mentioned. ' +
      'assignee/priority/due may be empty strings or omitted if unknown. ' +
      `Respond in the language: ${langLabel}.`

    const USER_PROMPT = transcript

    let summary = ''
    let actionItems: ActionItem[] = []

    try {
      const zai = await getZAI()
      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'assistant', content: SYSTEM_PROMPT },
          { role: 'user', content: USER_PROMPT },
        ],
        thinking: { type: 'disabled' },
      })
      const text: string = completion?.choices?.[0]?.message?.content ?? ''

      try {
        const parsed = JSON.parse(stripFences(text))
        if (typeof parsed?.summary === 'string' && parsed.summary.trim()) {
          summary = parsed.summary
        } else {
          // Shape was unexpected — fall back to raw text.
          summary = text
        }
        actionItems = coerceActionItems(parsed?.actionItems)
      } catch {
        // JSON parse failed — fall back to storing the raw text as summary
        // and an empty actionItems array (per spec).
        summary = text
        actionItems = []
      }
    } catch (llmErr) {
      // The LLM call itself failed. Reset status to 'completed' (so the UI
      // doesn't get stuck on 'summarizing') and store a friendly error
      // message as the summary so the user has feedback.
      const msg = llmErr instanceof Error ? llmErr.message : String(llmErr)
      const updated = await db.transcriptionSession.update({
        where: { id },
        data: {
          status: 'completed',
          summary: `_(Summarization failed: ${msg})_`,
          actionItems: JSON.stringify([]),
          segments: null,
        },
      })
      return NextResponse.json({ session: mapSession(updated) })
    }

    const updated = await db.transcriptionSession.update({
      where: { id },
      data: {
        status: 'completed',
        summary,
        actionItems: JSON.stringify(actionItems),
        segments: null,
      },
    })

    return NextResponse.json({ session: mapSession(updated) })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
