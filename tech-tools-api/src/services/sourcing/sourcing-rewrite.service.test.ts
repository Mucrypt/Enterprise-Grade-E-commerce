import { rewriteSourcedProduct, regenerateRewrite } from './sourcing-rewrite.service'
import { query } from '../../database/connection'
import { callOpenAI } from '../ai/openai-client'

jest.mock('../../database/connection', () => ({ query: jest.fn() }))
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))
jest.mock('../ai/openai-client', () => ({
  callOpenAI: jest.fn(),
  extractJsonObject: jest.requireActual('../ai/openai-client').extractJsonObject,
}))

const mockQuery = query as jest.Mock
const mockCallOpenAI = callOpenAI as jest.Mock

const SOURCED_ROW = {
  id: 'sp-1',
  source_platform: 'alibaba',
  captured_supplier_name: 'Shanxi Guangna Impex Co., Ltd.',
  captured_title: 'Cross-border Aluminum Alloy Cabinet Door Tool',
  captured_description_html: '<p>A useful installation aid.</p>',
  captured_specs: { Material: 'Aluminum alloy' },
  captured_price_tiers: [{ minQty: 1, price: 4.5, currency: 'USD' }],
}

const CATEGORY_ROWS = [
  { id: 'cat-tools', name: 'Tools & Emergency' },
  { id: 'cat-interior', name: 'Interior' },
]

function openAiResponse(content: string) {
  return { choices: [{ message: { content } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }, model: 'gpt-5.5' }
}

// Every successful call makes 4 queries in order: (1) getSourcedProductById's
// SELECT, (2) the 'rewriting' status UPDATE, (3) loadCategoryOptions' SELECT,
// (4) the final ready_for_review/rewrite_failed UPDATE.
function mockFourQueries(categoryRows: unknown[] = CATEGORY_ROWS) {
  mockQuery
    .mockResolvedValueOnce({ rows: [SOURCED_ROW] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: categoryRows })
    .mockResolvedValueOnce({ rows: [] })
}

describe('rewriteSourcedProduct', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns early (no queries beyond the lookup) if the sourced product does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await rewriteSourcedProduct('sp-missing')
    expect(mockQuery).toHaveBeenCalledTimes(1)
    expect(mockCallOpenAI).not.toHaveBeenCalled()
  })

  it('marks the row rewriting, increments the attempt count, then writes rewritten_* fields and ready_for_review on success', async () => {
    mockFourQueries()
    mockCallOpenAI.mockResolvedValue(
      openAiResponse(JSON.stringify({ title: 'Original Cabinet Door Tool', descriptionHtml: '<p>Rewritten.</p>', confidence: 85, notes: '' })),
    )

    await rewriteSourcedProduct('sp-1')

    const rewritingUpdate = mockQuery.mock.calls[1]
    expect(rewritingUpdate[0]).toContain("status = 'rewriting'")
    expect(rewritingUpdate[0]).toContain('rewrite_attempt_count = rewrite_attempt_count + 1')

    const successUpdate = mockQuery.mock.calls[3]
    expect(successUpdate[0]).toContain("status = 'ready_for_review'")
    // id, title, description, metaTitle, metaDescription, suggestedCategoryId, model, confidence, notes
    expect(successUpdate[1]).toEqual(['sp-1', 'Original Cabinet Door Tool', '<p>Rewritten.</p>', null, null, null, 'gpt-5.5', 85, ''])
  })

  it('sends platform/supplier context and the real category list to the model, never the source marketplace/supplier as a fact to repeat verbatim', async () => {
    mockFourQueries()
    mockCallOpenAI.mockResolvedValue(openAiResponse(JSON.stringify({ title: 'X', descriptionHtml: '<p>Y</p>', confidence: 70 })))

    await rewriteSourcedProduct('sp-1')

    const userMessage = mockCallOpenAI.mock.calls[0][0][1].content
    const payload = JSON.parse(userMessage)
    expect(payload.sourcePlatform).toBe('alibaba')
    expect(payload.supplierName).toBe('Shanxi Guangna Impex Co., Ltd.')
    expect(payload.CATEGORIES).toEqual([
      { id: 'cat-tools', name: 'Tools & Emergency' },
      { id: 'cat-interior', name: 'Interior' },
    ])
    // JSON mode requested (best-practice structured output, not just prompt instructions).
    expect(mockCallOpenAI.mock.calls[0][1]).toEqual({ jsonMode: true })
  })

  it('accepts a suggestedCategoryId that is genuinely one of the offered categories', async () => {
    mockFourQueries()
    mockCallOpenAI.mockResolvedValue(
      openAiResponse(JSON.stringify({ title: 'X', descriptionHtml: '<p>Y</p>', confidence: 70, suggestedCategoryId: 'cat-tools' })),
    )

    await rewriteSourcedProduct('sp-1')

    const successUpdate = mockQuery.mock.calls[3]
    expect(successUpdate[1][5]).toBe('cat-tools')
  })

  it('rejects a hallucinated suggestedCategoryId that is not in the offered list, storing null instead of trusting it', async () => {
    mockFourQueries()
    mockCallOpenAI.mockResolvedValue(
      openAiResponse(JSON.stringify({ title: 'X', descriptionHtml: '<p>Y</p>', confidence: 70, suggestedCategoryId: 'made-up-id' })),
    )

    await rewriteSourcedProduct('sp-1')

    const successUpdate = mockQuery.mock.calls[3]
    expect(successUpdate[1][5]).toBeNull()
  })

  it('clamps an out-of-range confidence value into 0-100', async () => {
    mockFourQueries()
    mockCallOpenAI.mockResolvedValue(openAiResponse(JSON.stringify({ title: 'X', descriptionHtml: '<p>Y</p>', confidence: 150 })))

    await rewriteSourcedProduct('sp-1')

    const successUpdate = mockQuery.mock.calls[3]
    expect(successUpdate[1][7]).toBe(100)
  })

  it('sets status=rewrite_failed and records the error, without throwing, on an OpenAI failure', async () => {
    mockFourQueries()
    mockCallOpenAI.mockRejectedValue(new Error('OPENAI_API_KEY is not configured'))

    await expect(rewriteSourcedProduct('sp-1')).resolves.toBeUndefined()

    const failureUpdate = mockQuery.mock.calls[3]
    expect(failureUpdate[0]).toContain("status = 'rewrite_failed'")
    expect(failureUpdate[1]).toEqual(['sp-1', 'OPENAI_API_KEY is not configured'])
  })

  it('sets status=rewrite_failed if the model response is missing title/descriptionHtml', async () => {
    mockFourQueries()
    mockCallOpenAI.mockResolvedValue(openAiResponse(JSON.stringify({ confidence: 80 })))

    await expect(rewriteSourcedProduct('sp-1')).resolves.toBeUndefined()

    const failureUpdate = mockQuery.mock.calls[3]
    expect(failureUpdate[0]).toContain("status = 'rewrite_failed'")
  })

  it('parses a fenced-markdown JSON response the same way ai.orchestrator.ts already tolerates', async () => {
    mockFourQueries()
    mockCallOpenAI.mockResolvedValue(
      openAiResponse('```json\n' + JSON.stringify({ title: 'X', descriptionHtml: '<p>Y</p>', confidence: 70 }) + '\n```'),
    )

    await rewriteSourcedProduct('sp-1')

    const successUpdate = mockQuery.mock.calls[3]
    expect(successUpdate[0]).toContain("status = 'ready_for_review'")
  })
})

describe('regenerateRewrite', () => {
  beforeEach(() => jest.clearAllMocks())

  it('delegates to the same rewrite logic (synchronous, for the dashboard button)', async () => {
    mockFourQueries()
    mockCallOpenAI.mockResolvedValue(openAiResponse(JSON.stringify({ title: 'X', descriptionHtml: '<p>Y</p>', confidence: 70 })))

    await regenerateRewrite('sp-1')
    expect(mockCallOpenAI).toHaveBeenCalledTimes(1)
  })
})
