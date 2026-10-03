import { NextRequest, NextResponse } from 'next/server'
import { testGroqKey, DEFAULT_GROQ_MODEL } from '@/lib/groq'

// GET /api/ai/config - Check AI provider status and active environment configuration
export async function GET(req: NextRequest) {
  const envKey = process.env.GROQ_API_KEY?.trim() || ''
  const hasEnvKey = Boolean(envKey)
  const headerKey = req.headers.get('x-groq-api-key')?.trim() || ''

  return NextResponse.json({
    groq: {
      hasEnvKey,
      isConfigured: hasEnvKey || Boolean(headerKey),
      defaultModel: DEFAULT_GROQ_MODEL,
      availableModels: [
        { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B (Recommended)' },
        { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B' },
        { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout 17B' },
      ],
    },
  })
}

// POST /api/ai/config - Validate a user-provided Groq API key
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : ''

    if (!apiKey) {
      return NextResponse.json({ valid: false, error: 'API key is required' }, { status: 400 })
    }

    const result = await testGroqKey(apiKey)
    if (!result.valid) {
      return NextResponse.json({ valid: false, error: result.error }, { status: 400 })
    }

    return NextResponse.json({ valid: true, message: 'Groq API key verified successfully!' })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ valid: false, error: message }, { status: 500 })
  }
}
