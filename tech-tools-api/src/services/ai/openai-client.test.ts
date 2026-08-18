import { postOpenAi, callOpenAI, extractJsonObject, parseResponsesText } from './openai-client'
import https from 'https'

jest.mock('https')

const REAL_ENV = process.env

function mockHttpsRequest(statusCode: number, bodyText: string) {
  ;(https.request as jest.Mock).mockImplementation((_options: any, callback: any) => {
    const res: any = {
      statusCode,
      on: (event: string, handler: any) => {
        if (event === 'data') handler(Buffer.from(bodyText))
        if (event === 'end') handler()
      },
    }
    callback(res)
    return { on: jest.fn(), write: jest.fn(), end: jest.fn(), destroy: jest.fn() }
  })
}

describe('postOpenAi', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...REAL_ENV, OPENAI_API_KEY: 'test-key' }
  })
  afterAll(() => {
    process.env = REAL_ENV
  })

  it('throws if OPENAI_API_KEY is not configured', async () => {
    delete process.env.OPENAI_API_KEY
    await expect(postOpenAi('/v1/chat/completions', {})).rejects.toThrow('OPENAI_API_KEY is not configured')
    expect(https.request).not.toHaveBeenCalled()
  })

  it('resolves statusCode/bodyText from a real HTTP round-trip', async () => {
    mockHttpsRequest(200, '{"ok":true}')
    const result = await postOpenAi('/v1/chat/completions', { model: 'gpt-5.5' })
    expect(result).toEqual({ statusCode: 200, bodyText: '{"ok":true}' })
  })
})

describe('callOpenAI -- chat completions success', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...REAL_ENV, OPENAI_API_KEY: 'test-key' }
  })
  afterAll(() => {
    process.env = REAL_ENV
  })

  it('returns the parsed chat-completion response directly when the API succeeds', async () => {
    const response = { choices: [{ message: { content: 'hi' } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }, model: 'gpt-5.5' }
    mockHttpsRequest(200, JSON.stringify(response))

    const result = await callOpenAI([{ role: 'user', content: 'hello' }])
    expect(result).toEqual(response)
    expect(https.request).toHaveBeenCalledTimes(1)
  })
})

describe('callOpenAI -- Responses API fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...REAL_ENV, OPENAI_API_KEY: 'test-key' }
  })
  afterAll(() => {
    process.env = REAL_ENV
  })

  it('falls back to /v1/responses when chat.completions returns >= 400, and reshapes the result', async () => {
    let callCount = 0
    ;(https.request as jest.Mock).mockImplementation((options: any, callback: any) => {
      callCount += 1
      const isFirstCall = callCount === 1
      const statusCode = isFirstCall ? 404 : 200
      const bodyText = isFirstCall
        ? '{"error":"not found"}'
        : JSON.stringify({ output_text: 'fallback text', usage: { input_tokens: 5, output_tokens: 3, total_tokens: 8 }, model: 'gpt-5.5' })
      const res: any = { statusCode, on: (event: string, handler: any) => { if (event === 'data') handler(Buffer.from(bodyText)); if (event === 'end') handler() } }
      callback(res)
      return { on: jest.fn(), write: jest.fn(), end: jest.fn(), destroy: jest.fn() }
    })

    const result = await callOpenAI([{ role: 'user', content: 'hello' }])

    expect(https.request).toHaveBeenCalledTimes(2)
    expect(result.choices[0].message.content).toBe('fallback text')
    expect(result.usage).toEqual({ prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 })
  })

  it('throws with both status codes when both chat.completions and responses fail', async () => {
    mockHttpsRequest(500, '{"error":"server error"}')
    await expect(callOpenAI([{ role: 'user', content: 'hello' }])).rejects.toThrow(/chat=500/)
  })
})

describe('parseResponsesText', () => {
  it('prefers output_text when present', () => {
    expect(parseResponsesText({ output_text: 'direct text' })).toBe('direct text')
  })

  it('falls back to walking output[].content[].text', () => {
    const raw = { output: [{ content: [{ text: 'chunk one' }, { text: 'chunk two' }] }] }
    expect(parseResponsesText(raw)).toBe('chunk one\nchunk two')
  })

  it('throws if no text can be extracted at all', () => {
    expect(() => parseResponsesText({})).toThrow('OpenAI Responses API returned no text output')
  })
})

describe('extractJsonObject', () => {
  it('returns already-clean JSON as-is', () => {
    expect(extractJsonObject('{"a":1}')).toBe('{"a":1}')
  })

  it('extracts JSON from a markdown code fence', () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toBe('{"a":1}')
  })

  it('extracts JSON embedded in surrounding prose via first/last brace', () => {
    expect(extractJsonObject('Here is the result: {"a":1} -- done')).toBe('{"a":1}')
  })

  it('throws when no JSON object can be found', () => {
    expect(() => extractJsonObject('no json here')).toThrow('AI did not return JSON content')
  })
})
