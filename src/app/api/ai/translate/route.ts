import { NextRequest, NextResponse } from 'next/server'
import { resolveGroqKey, resolveGroqModel, translateWithGroq } from '@/lib/groq'

// POST /api/ai/translate
// Body: { text: string, targetLanguage: string, apiKey?: string, model?: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const text = typeof body?.text === 'string' ? body.text : ''
    const targetLanguage = typeof body?.targetLanguage === 'string' ? body.targetLanguage : ''
    const explicitKey = typeof body?.apiKey === 'string' ? body.apiKey : undefined
    const requestedModel = typeof body?.model === 'string' ? body.model : undefined

    if (!text.trim()) {
      return NextResponse.json({ error: 'Text to translate is required' }, { status: 400 })
    }

    if (!targetLanguage || targetLanguage === 'auto') {
      return NextResponse.json(
        { error: 'targetLanguage must be a specific language code (not "auto")' },
        { status: 400 }
      )
    }

    const apiKey = resolveGroqKey(req, explicitKey)
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'Groq API key not found. Please add your Groq API key in Settings or set GROQ_API_KEY in your .env file.',
          needsKey: true,
        },
        { status: 401 }
      )
    }

    const model = await resolveGroqModel(apiKey, requestedModel)

    const translatedText = await translateWithGroq({
      text,
      targetLanguage,
      apiKey,
      model,
    })

    return NextResponse.json({
      translatedText,
      targetLanguage,
      model,
      provider: 'groq',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
