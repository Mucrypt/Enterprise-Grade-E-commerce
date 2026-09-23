const mockValidate = jest.fn()
jest.mock('sns-validator', () => {
  return jest.fn().mockImplementation(() => ({ validate: mockValidate }))
})

jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

const mockFindSessionIdByChannelArn = jest.fn()
const mockStartSession = jest.fn()
const mockEndSession = jest.fn()
jest.mock('../../../services/live/live-session.service', () => ({
  findSessionIdByChannelArn: (...args: unknown[]) => mockFindSessionIdByChannelArn(...args),
  startSession: (...args: unknown[]) => mockStartSession(...args),
  endSession: (...args: unknown[]) => mockEndSession(...args),
}))

import { handleIvsSnsEvent } from './live-webhook.controller'

const originalFetch = global.fetch

const makeRes = () => {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

const makeReq = (body: unknown) => ({
  rawBody: Buffer.from(JSON.stringify(body)),
})

beforeEach(() => {
  jest.clearAllMocks()
  process.env.AWS_IVS_SNS_TOPIC_ARN = 'arn:aws:sns:us-east-1:123:ivs-topic'
})

afterEach(() => {
  global.fetch = originalFetch
  delete process.env.AWS_IVS_SNS_TOPIC_ARN
})

describe('handleIvsSnsEvent -- signature verification gates everything', () => {
  it('rejects a message that fails SNS signature verification, never touching session state', async () => {
    mockValidate.mockImplementation((_msg: unknown, cb: (err: Error | null, m?: unknown) => void) =>
      cb(new Error('bad signature')),
    )

    const req = makeReq({ Type: 'Notification', TopicArn: 'arn:aws:sns:us-east-1:123:ivs-topic', Message: '{}' })
    const res = makeRes()

    await handleIvsSnsEvent(req as any, res as any)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(mockFindSessionIdByChannelArn).not.toHaveBeenCalled()
  })

  it('rejects a message with an unexpected TopicArn even if the signature is valid', async () => {
    mockValidate.mockImplementation((msg: unknown, cb: (err: Error | null, m?: unknown) => void) => cb(null, msg))

    const req = makeReq({ Type: 'Notification', TopicArn: 'arn:aws:sns:us-east-1:999:someone-elses-topic', Message: '{}' })
    const res = makeRes()

    await handleIvsSnsEvent(req as any, res as any)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(mockFindSessionIdByChannelArn).not.toHaveBeenCalled()
  })

  it('returns 400 without crashing when the body is not valid JSON', async () => {
    const req = { rawBody: Buffer.from('not json') }
    const res = makeRes()

    await handleIvsSnsEvent(req as any, res as any)

    expect(res.status).toHaveBeenCalledWith(400)
  })
})

describe('handleIvsSnsEvent -- subscription confirmation handshake', () => {
  it('visits SubscribeURL to confirm the subscription', async () => {
    mockValidate.mockImplementation((msg: unknown, cb: (err: Error | null, m?: unknown) => void) => cb(null, msg))
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch

    const req = makeReq({
      Type: 'SubscriptionConfirmation',
      TopicArn: 'arn:aws:sns:us-east-1:123:ivs-topic',
      SubscribeURL: 'https://sns.amazonaws.com/confirm?token=abc',
    })
    const res = makeRes()

    await handleIvsSnsEvent(req as any, res as any)

    expect(global.fetch).toHaveBeenCalledWith('https://sns.amazonaws.com/confirm?token=abc')
    expect(res.status).toHaveBeenCalledWith(200)
  })
})

describe('handleIvsSnsEvent -- stream state changes', () => {
  it('starts the matching session on "Stream Start"', async () => {
    mockValidate.mockImplementation((msg: unknown, cb: (err: Error | null, m?: unknown) => void) => cb(null, msg))
    mockFindSessionIdByChannelArn.mockResolvedValue('session-1')

    const req = makeReq({
      Type: 'Notification',
      TopicArn: 'arn:aws:sns:us-east-1:123:ivs-topic',
      Message: JSON.stringify({
        'detail-type': 'IVS Stream State Change',
        resources: ['arn:aws:ivs:us-east-1:123:channel/abc'],
        detail: { state: 'Stream Start' },
      }),
    })
    const res = makeRes()

    await handleIvsSnsEvent(req as any, res as any)

    expect(mockStartSession).toHaveBeenCalledWith('session-1')
    expect(mockEndSession).not.toHaveBeenCalled()
  })

  it('ends the matching session on "Stream End" (e.g. the seller\'s encoder disconnected)', async () => {
    mockValidate.mockImplementation((msg: unknown, cb: (err: Error | null, m?: unknown) => void) => cb(null, msg))
    mockFindSessionIdByChannelArn.mockResolvedValue('session-1')

    const req = makeReq({
      Type: 'Notification',
      TopicArn: 'arn:aws:sns:us-east-1:123:ivs-topic',
      Message: JSON.stringify({
        'detail-type': 'IVS Stream State Change',
        resources: ['arn:aws:ivs:us-east-1:123:channel/abc'],
        detail: { state: 'Stream End' },
      }),
    })
    const res = makeRes()

    await handleIvsSnsEvent(req as any, res as any)

    expect(mockEndSession).toHaveBeenCalledWith('session-1', 'webhook')
  })

  it('ends the session on "Stream Failure" too, not just a clean Stream End', async () => {
    mockValidate.mockImplementation((msg: unknown, cb: (err: Error | null, m?: unknown) => void) => cb(null, msg))
    mockFindSessionIdByChannelArn.mockResolvedValue('session-1')

    const req = makeReq({
      Type: 'Notification',
      TopicArn: 'arn:aws:sns:us-east-1:123:ivs-topic',
      Message: JSON.stringify({
        'detail-type': 'IVS Stream State Change',
        resources: ['arn:aws:ivs:us-east-1:123:channel/abc'],
        detail: { state: 'Stream Failure' },
      }),
    })
    const res = makeRes()

    await handleIvsSnsEvent(req as any, res as any)

    expect(mockEndSession).toHaveBeenCalledWith('session-1', 'webhook')
  })

  it('is a no-op (200, no session mutation) when no open session matches the channel ARN', async () => {
    mockValidate.mockImplementation((msg: unknown, cb: (err: Error | null, m?: unknown) => void) => cb(null, msg))
    mockFindSessionIdByChannelArn.mockResolvedValue(null)

    const req = makeReq({
      Type: 'Notification',
      TopicArn: 'arn:aws:sns:us-east-1:123:ivs-topic',
      Message: JSON.stringify({
        'detail-type': 'IVS Stream State Change',
        resources: ['arn:aws:ivs:us-east-1:123:channel/unknown'],
        detail: { state: 'Stream Start' },
      }),
    })
    const res = makeRes()

    await handleIvsSnsEvent(req as any, res as any)

    expect(mockStartSession).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('ignores an unrelated EventBridge detail-type', async () => {
    mockValidate.mockImplementation((msg: unknown, cb: (err: Error | null, m?: unknown) => void) => cb(null, msg))

    const req = makeReq({
      Type: 'Notification',
      TopicArn: 'arn:aws:sns:us-east-1:123:ivs-topic',
      Message: JSON.stringify({ 'detail-type': 'Some Other Event' }),
    })
    const res = makeRes()

    await handleIvsSnsEvent(req as any, res as any)

    expect(mockFindSessionIdByChannelArn).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
  })
})

describe('handleIvsSnsEvent -- resilience', () => {
  it('returns 400 when the raw body was never captured', async () => {
    const res = makeRes()

    await handleIvsSnsEvent({} as any, res as any)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('returns 200 even on an internal error after verification, to avoid an SNS retry storm', async () => {
    mockValidate.mockImplementation((msg: unknown, cb: (err: Error | null, m?: unknown) => void) => cb(null, msg))
    mockFindSessionIdByChannelArn.mockRejectedValue(new Error('db down'))

    const req = makeReq({
      Type: 'Notification',
      TopicArn: 'arn:aws:sns:us-east-1:123:ivs-topic',
      Message: JSON.stringify({
        'detail-type': 'IVS Stream State Change',
        resources: ['arn:aws:ivs:us-east-1:123:channel/abc'],
        detail: { state: 'Stream Start' },
      }),
    })
    const res = makeRes()

    await handleIvsSnsEvent(req as any, res as any)

    expect(res.status).toHaveBeenCalledWith(200)
  })
})
