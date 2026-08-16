import crypto from 'crypto'
import { handleTikTokShopWebhook } from './channel-webhook.controller'
import { query } from '../../../database/connection'

jest.mock('../../../database/connection', () => ({ query: jest.fn() }))
jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

const mockQuery = query as jest.Mock
const APP_KEY = 'test-app-key'
const APP_SECRET = 'test-app-secret'

const makeRes = () => {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

function sign(rawBody: string): string {
  return crypto.createHmac('sha256', APP_SECRET).update(`${APP_KEY}${rawBody}`).digest('hex')
}

function makeReq(payload: object, overrideSignature?: string) {
  const rawBody = JSON.stringify(payload)
  return {
    rawBody: Buffer.from(rawBody, 'utf8'),
    headers: { authorization: overrideSignature ?? sign(rawBody) },
  } as any
}

describe('handleTikTokShopWebhook', () => {
  const REAL_ENV = process.env
  beforeEach(() => {
    // resetAllMocks (not clearAllMocks) -- clearAllMocks leaves queued
    // mockResolvedValueOnce/mockRejectedValueOnce values in place across
    // tests, which silently shifts later tests' mocked responses onto the
    // wrong query() call.
    jest.resetAllMocks()
    process.env = { ...REAL_ENV, CHANNEL_TIKTOK_SHOP_APP_KEY: APP_KEY, CHANNEL_TIKTOK_SHOP_APP_SECRET: APP_SECRET }
  })
  afterAll(() => {
    process.env = REAL_ENV
  })

  it('returns 500 without processing anything if the app credentials are not configured', async () => {
    delete process.env.CHANNEL_TIKTOK_SHOP_APP_KEY
    const req = makeReq({ tts_notification_id: '1', event_type: 'ORDER_STATUS_CHANGE' })
    const res = makeRes()
    await handleTikTokShopWebhook(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns 400 if no raw body was captured', async () => {
    const req: any = { rawBody: undefined, headers: {} }
    const res = makeRes()
    await handleTikTokShopWebhook(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('rejects a webhook with an invalid signature -- 401, never touches the database', async () => {
    const req = makeReq({ tts_notification_id: '1', event_type: 'ORDER_STATUS_CHANGE' }, 'a'.repeat(64))
    const res = makeRes()
    await handleTikTokShopWebhook(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('rejects a payload with no tts_notification_id -- cannot deduplicate', async () => {
    const req = makeReq({ event_type: 'ORDER_STATUS_CHANGE' })
    const res = makeRes()
    await handleTikTokShopWebhook(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('rejects a malformed (non-JSON) body without crashing', async () => {
    const req: any = { rawBody: Buffer.from('not json', 'utf8'), headers: { authorization: sign('not json') } }
    const res = makeRes()
    await handleTikTokShopWebhook(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('a duplicate tts_notification_id (INSERT ... ON CONFLICT returns 0 rows) is acknowledged without reprocessing', async () => {
    // No shop_id in the payload -- resolveChannelAccountId() short-circuits
    // without querying, so the idempotency insert is the only query() call.
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }) // idempotency insert -- duplicate

    const req = makeReq({ tts_notification_id: 'dup-1', event_type: 'ORDER_STATUS_CHANGE' })
    const res = makeRes()
    await handleTikTokShopWebhook(req, res)

    expect(res.json).toHaveBeenCalledWith({ received: true, duplicate: true })
  })

  it('an unrecognized event_type is stored and acknowledged with 200, never a 500', async () => {
    // No shop_id -- resolveChannelAccountId() short-circuits without a query.
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'event-1' }], rowCount: 1 }) // idempotency insert -- new
    mockQuery.mockResolvedValueOnce({ rows: [] }) // mark processed_at

    const req = makeReq({ tts_notification_id: 'unk-1', event_type: 'SOME_FUTURE_TOPIC' })
    const res = makeRes()
    await handleTikTokShopWebhook(req, res)

    expect(res.status).not.toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ received: true })
  })

  it('a known event_type with no matching channel account is still acknowledged (never blocks on an unmatched shop_id)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }) // resolveChannelAccountId -- no match
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'event-1' }], rowCount: 1 }) // idempotency insert
    mockQuery.mockResolvedValueOnce({ rows: [] }) // mark processed_at

    const req = makeReq({ tts_notification_id: 'ok-1', event_type: 'PRODUCT_STATUS_CHANGE', shop_id: 'unknown-shop' })
    const res = makeRes()
    await handleTikTokShopWebhook(req, res)

    expect(res.json).toHaveBeenCalledWith({ received: true })
    // No activity-log insert, since there's no channel account to attribute it to.
    expect(mockQuery.mock.calls.some((c: any[]) => c[0].includes('INSERT INTO channel_activity_log'))).toBe(false)
  })

  it('SELLER_DEAUTHORIZATION downgrades the matched connection to NEEDS_CREDENTIALS -- the one webhook-driven state change this handler makes', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'account-1' }] }) // resolveChannelAccountId -- match
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'event-1' }], rowCount: 1 }) // idempotency insert
    mockQuery.mockResolvedValueOnce({ rows: [] }) // activity log insert
    mockQuery.mockResolvedValueOnce({ rows: [] }) // UPDATE commerce_channel_accounts
    mockQuery.mockResolvedValueOnce({ rows: [] }) // mark processed_at

    const req = makeReq({ tts_notification_id: 'deauth-1', event_type: 'SELLER_DEAUTHORIZATION', shop_id: 'shop-123' })
    const res = makeRes()
    await handleTikTokShopWebhook(req, res)

    const updateCall = mockQuery.mock.calls.find((c: any[]) => c[0].includes("SET status = 'NEEDS_CREDENTIALS'"))
    expect(updateCall).toBeDefined()
    expect(updateCall![1]).toEqual(['account-1'])
    expect(res.json).toHaveBeenCalledWith({ received: true })
  })

  it('never mutates channel_orders, channel_product_mappings, or inventory directly from a webhook -- only channel_activity_log / connection status', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'account-1' }] })
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'event-1' }], rowCount: 1 })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({ rows: [] })

    const req = makeReq({ tts_notification_id: 'order-1', event_type: 'ORDER_STATUS_CHANGE', shop_id: 'shop-123' })
    const res = makeRes()
    await handleTikTokShopWebhook(req, res)

    const mutatedForbiddenTables = mockQuery.mock.calls.filter(
      (c: any[]) => /UPDATE\s+(channel_orders|channel_product_mappings|inventory)\b/i.test(c[0]) || /INSERT INTO\s+channel_orders/i.test(c[0]),
    )
    expect(mutatedForbiddenTables).toHaveLength(0)
  })

  it('acknowledges receipt even if downstream processing throws, recording the error instead of leaving the delivery unacknowledged', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'account-1' }] })
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'event-1' }], rowCount: 1 })
    mockQuery.mockRejectedValueOnce(new Error('activity log insert failed'))
    mockQuery.mockResolvedValueOnce({ rows: [] }) // processing_error update

    const req = makeReq({ tts_notification_id: 'err-1', event_type: 'ORDER_STATUS_CHANGE', shop_id: 'shop-123' })
    const res = makeRes()
    await handleTikTokShopWebhook(req, res)

    expect(res.json).toHaveBeenCalledWith({ received: true, processingError: true })
  })
})
