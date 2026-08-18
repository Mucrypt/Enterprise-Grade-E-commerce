/**
 * Low-level OpenAI HTTP client -- extracted from services/ai.orchestrator.ts
 * (SOURCING-1) so a second, independent domain (product-listing rewriting)
 * can call OpenAI without duplicating the request/parsing/fallback logic.
 * Behavior-preserving extraction: every function here is verbatim from
 * ai.orchestrator.ts, only made exported and moved to its own module.
 * Mirrors the createSecretCipher() factory-extraction precedent already
 * used once in this codebase (utils/secret-encryption.ts) -- one shared
 * low-level primitive, multiple independent call sites, never duplicated.
 *
 * Reads only two env vars: OPENAI_API_KEY (required) and AI_MODEL
 * (optional, defaults 'gpt-5.5') -- no coupling to either calling domain.
 */
import https from 'https'

export interface OpenAiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface OpenAiResponse {
  choices: Array<{
    message: {
      content: string
      function_call?: { name: string; arguments: string }
    }
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  model: string
}

export interface OpenAiHttpResult {
  statusCode: number
  bodyText: string
}

export async function postOpenAi(
  path: string,
  payload: Record<string, unknown>,
): Promise<OpenAiHttpResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')

  const body = JSON.stringify(payload)

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.openai.com',
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 30000,
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 500,
            bodyText: data,
          })
        })
      },
    )
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('OpenAI request timed out'))
    })
    req.write(body)
    req.end()
  })
}

export function parseResponsesText(raw: any): string {
  if (typeof raw?.output_text === 'string' && raw.output_text.trim()) {
    return raw.output_text
  }

  const outputs = Array.isArray(raw?.output) ? raw.output : []
  const textChunks: string[] = []

  for (const item of outputs) {
    const content = Array.isArray(item?.content) ? item.content : []
    for (const part of content) {
      if (typeof part?.text === 'string') {
        textChunks.push(part.text)
      }
    }
  }

  const combined = textChunks.join('\n').trim()
  if (!combined) {
    throw new Error('OpenAI Responses API returned no text output')
  }
  return combined
}

// ─── OpenAI API caller with compatibility fallback ───────────
export async function callOpenAI(messages: OpenAiMessage[]): Promise<OpenAiResponse> {
  const model = process.env.AI_MODEL || 'gpt-5.5'

  // First attempt: Chat Completions API
  const chatResult = await postOpenAi('/v1/chat/completions', {
    model,
    messages,
    max_tokens: 2000,
  })

  if (chatResult.statusCode < 400) {
    try {
      return JSON.parse(chatResult.bodyText) as OpenAiResponse
    } catch {
      throw new Error('Failed to parse OpenAI chat completion response')
    }
  }

  // Fallback: Responses API (for models/projects not supporting chat.completions)
  const flattenedInput = messages
    .map((m) => `${m.role.toUpperCase()}:\n${m.content}`)
    .join('\n\n')

  const responsesResult = await postOpenAi('/v1/responses', {
    model,
    input: flattenedInput,
    max_output_tokens: 2000,
  })

  if (responsesResult.statusCode >= 400) {
    throw new Error(
      `OpenAI API error chat=${chatResult.statusCode} responses=${
        responsesResult.statusCode
      }: ${responsesResult.bodyText.slice(0, 400)}`,
    )
  }

  let responsesJson: any
  try {
    responsesJson = JSON.parse(responsesResult.bodyText)
  } catch {
    throw new Error('Failed to parse OpenAI responses API payload')
  }

  const responseText = parseResponsesText(responsesJson)

  return {
    choices: [
      {
        message: {
          content: responseText,
        },
      },
    ],
    usage: {
      prompt_tokens: responsesJson?.usage?.input_tokens || 0,
      completion_tokens: responsesJson?.usage?.output_tokens || 0,
      total_tokens: responsesJson?.usage?.total_tokens || 0,
    },
    model: responsesJson?.model || model,
  }
}

export function extractJsonObject(text: string): string {
  const trimmed = text.trim()

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fencedMatch?.[1]) {
    const fenced = fencedMatch[1].trim()
    if (fenced.startsWith('{') && fenced.endsWith('}')) {
      return fenced
    }
  }

  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1)
  }

  throw new Error('AI did not return JSON content')
}
