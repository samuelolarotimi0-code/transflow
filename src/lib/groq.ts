import { getLanguageLabel, type ActionItem } from './constants'

// Preferred chat models in priority order — first available one wins
const GROQ_MODEL_PRIORITY = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
]

export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b'
const GROQ_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODELS_URL = 'https://api.groq.com/openai/v1/models'

export interface GroqTranslateOptions {
  text: string
  targetLanguage: string
  apiKey?: string
  model?: string
}

export interface GroqSummarizeOptions {
  text: string
  language?: string
  apiKey?: string
  model?: string
}

/**
 * Resolves the Groq API key from explicit arg, incoming request header, or process.env.
 */
export function resolveGroqKey(req?: Request, explicitKey?: string): string | null {
  if (explicitKey && explicitKey.trim()) {
    return explicitKey.trim()
  }
  if (req) {
    const fromHeader = req.headers.get('x-groq-api-key')
    if (fromHeader && fromHeader.trim()) {
      return fromHeader.trim()
    }
  }
  const fromEnv = process.env.GROQ_API_KEY
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.trim()
  }
  return null
}

/**
 * Validates a Groq API key by querying the Groq models endpoint.
 */
export async function testGroqKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  const trimmed = apiKey.trim()
  if (!trimmed) {
    return { valid: false, error: 'Groq API key cannot be empty' }
  }

  try {
    const res = await fetch(GROQ_MODELS_URL, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${trimmed}`,
      },
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      const msg = body?.error?.message || `Groq validation failed with HTTP ${res.status}`
      return { valid: false, error: msg }
    }

    return { valid: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { valid: false, error: `Could not reach Groq API: ${msg}` }
  }
}

/**
 * Resolve the best available Groq chat model for the given API key.
 * Falls back to DEFAULT_GROQ_MODEL if the models list cannot be fetched.
 */
export async function resolveGroqModel(apiKey: string, requestedModel?: string): Promise<string> {
  try {
    const res = await fetch(GROQ_MODELS_URL, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) return DEFAULT_GROQ_MODEL
    const data = await res.json()
    const available: string[] = (data?.data ?? []).map((m: any) => m.id as string)
    if (requestedModel && available.includes(requestedModel)) return requestedModel
    for (const model of GROQ_MODEL_PRIORITY) {
      if (available.includes(model)) return model
    }
    return DEFAULT_GROQ_MODEL
  } catch {
    return DEFAULT_GROQ_MODEL
  }
}

export async function translateWithGroq({
  text,
  targetLanguage,
  apiKey,
  model,
}: GroqTranslateOptions): Promise<string> {
  const content = text.trim()
  if (!content) return ''

  const resolvedKey = apiKey?.trim() || process.env.GROQ_API_KEY?.trim()
  if (!resolvedKey) {
    throw new Error('Groq API key is not configured. Please provide your Groq API key in Settings or .env.')
  }
  const selectedModel = model || (await resolveGroqModel(resolvedKey))

  const langLabel = getLanguageLabel(targetLanguage)
  const systemPrompt =
    `You are an expert multilingual translator. Translate the provided transcript text into ${langLabel}. ` +
    'Preserve the original meaning, natural speech tone, line breaks, punctuation, speaker tags (if present), and any markdown formatting. ' +
    'Do NOT add explanatory notes, preambles, or conversational replies. Output ONLY the translated text.'

  const response = await fetch(GROQ_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resolvedKey}`,
    },
    body: JSON.stringify({
      model: selectedModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: content },
      ],
      temperature: 0.3,
    }),
  })

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}))
    const errorMsg = errBody?.error?.message || `Groq API error (${response.status})`
    throw new Error(errorMsg)
  }

  const data = await response.json()
  const result = data?.choices?.[0]?.message?.content ?? ''
  return result.trim() || content
}

/**
 * Summarizes a transcript and extracts action items using Groq.
 */
export async function summarizeWithGroq({
  text,
  language = 'en',
  apiKey,
  model = DEFAULT_GROQ_MODEL,
}: GroqSummarizeOptions): Promise<{ summary: string; actionItems: ActionItem[] }> {
  const content = text.trim()
  if (!content) {
    return { summary: '', actionItems: [] }
  }

  const resolvedKey = apiKey?.trim() || process.env.GROQ_API_KEY?.trim()
  if (!resolvedKey) {
    throw new Error('Groq API key is not configured. Please provide your Groq API key in Settings or .env.')
  }

  const langLabel = getLanguageLabel(language)
  const systemPrompt =
    'You are an expert meeting analyst. Read the transcript and produce a concise summary plus actionable next steps. ' +
    'You MUST respond with STRICT JSON only — no markdown fences, no commentary. ' +
    'The JSON shape is: {"summary": string, "actionItems": [{"text": string, "assignee": string, "priority": "high"|"medium"|"low", "due": string}]}. ' +
    'The summary should be 3-5 short paragraphs or bullet points in markdown. ' +
    'actionItems should capture concrete tasks, decisions, and follow-ups mentioned. ' +
    'assignee/priority/due may be empty strings or omitted if unknown. ' +
    `Respond in the language: ${langLabel}.`

  const response = await fetch(GROQ_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resolvedKey}`,
    },
    body: JSON.stringify({
      model: model || DEFAULT_GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: content },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}))
    const errorMsg = errBody?.error?.message || `Groq API error (${response.status})`
    throw new Error(errorMsg)
  }

  const data = await response.json()
  const rawText: string = data?.choices?.[0]?.message?.content ?? ''

  function stripFences(s: string): string {
    let out = s.trim()
    const fenceStart = out.match(/^```(?:json)?\s*/i)
    if (fenceStart) out = out.slice(fenceStart[0].length)
    if (out.endsWith('```')) out = out.slice(0, -3)
    return out.trim()
  }

  try {
    const parsed = JSON.parse(stripFences(rawText))
    const summary = typeof parsed?.summary === 'string' && parsed.summary.trim() ? parsed.summary : rawText
    const actionItems: ActionItem[] = Array.isArray(parsed?.actionItems)
      ? parsed.actionItems
          .filter((a: any) => !!a && typeof a === 'object')
          .map((a: any) => ({
            text: String(a.text ?? ''),
            assignee: typeof a.assignee === 'string' ? a.assignee : undefined,
            priority: ['high', 'medium', 'low'].includes(a.priority) ? a.priority : undefined,
            due: typeof a.due === 'string' ? a.due : undefined,
          }))
          .filter((a: ActionItem) => a.text.length > 0)
      : []

    return { summary, actionItems }
  } catch {
    return { summary: rawText, actionItems: [] }
  }
}
