// Forces module scope (vs. TS "script" scope) -- without a top-level
// import/export, this file's loadServiceFresh collides with the
// identically-named, also-import-less helper in
// seller-payout.service.test.ts (both would otherwise be declared into
// the same global namespace).
export {}

const mockIvsSend = jest.fn()
const mockIvsChatSend = jest.fn()

jest.mock('@aws-sdk/client-ivs', () => {
  const actual = jest.requireActual('@aws-sdk/client-ivs')
  return {
    ...actual,
    IvsClient: jest.fn().mockImplementation(() => ({ send: (...args: unknown[]) => mockIvsSend(...args) })),
  }
})

jest.mock('@aws-sdk/client-ivschat', () => {
  const actual = jest.requireActual('@aws-sdk/client-ivschat')
  return {
    ...actual,
    IvschatClient: jest.fn().mockImplementation(() => ({ send: (...args: unknown[]) => mockIvsChatSend(...args) })),
  }
})

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

const ORIGINAL_ENV = { ...process.env }

function loadServiceFresh() {
  jest.resetModules()
  process.env.AWS_IVS_ACCESS_KEY_ID = 'test-key'
  process.env.AWS_IVS_SECRET_ACCESS_KEY = 'test-secret'
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('./ivs.service') as typeof import('./ivs.service')
}

afterEach(() => {
  jest.clearAllMocks()
  process.env = { ...ORIGINAL_ENV }
})

describe('ivs.service -- createChannel', () => {
  it('returns the channel + stream key from a successful CreateChannel call', async () => {
    const ivs = loadServiceFresh()
    mockIvsSend.mockResolvedValue({
      channel: { arn: 'arn:channel:1', ingestEndpoint: 'ingest.example', playbackUrl: 'https://play.example/1' },
      streamKey: { arn: 'arn:key:1', value: 'sk_live_abc' },
    })

    const result = await ivs.createChannel('test-channel')

    expect(result).toEqual({
      channelArn: 'arn:channel:1',
      ingestEndpoint: 'ingest.example',
      playbackUrl: 'https://play.example/1',
      streamKeyArn: 'arn:key:1',
      streamKeyValue: 'sk_live_abc',
    })
  })

  it('throws rather than returning a half-populated channel if AWS omits a field', async () => {
    const ivs = loadServiceFresh()
    mockIvsSend.mockResolvedValue({ channel: { arn: 'arn:channel:1' }, streamKey: undefined })

    await expect(ivs.createChannel('test-channel')).rejects.toThrow(/incomplete channel/)
  })
})

describe('ivs.service -- getStreamState', () => {
  it('reports live with the real viewer count when broadcasting', async () => {
    const ivs = loadServiceFresh()
    mockIvsSend.mockResolvedValue({
      stream: { state: 'LIVE', viewerCount: 42, startTime: new Date('2026-01-01T00:00:00Z') },
    })

    const result = await ivs.getStreamState('arn:channel:1')

    expect(result).toEqual({ isLive: true, viewerCount: 42, startedAt: new Date('2026-01-01T00:00:00Z') })
  })

  it('treats a "not broadcasting" error as offline, not a thrown failure', async () => {
    const ivs = loadServiceFresh()
    const error = new Error('not broadcasting')
    error.name = 'ChannelNotBroadcasting'
    mockIvsSend.mockRejectedValue(error)

    const result = await ivs.getStreamState('arn:channel:1')

    expect(result).toEqual({ isLive: false, viewerCount: 0, startedAt: null })
  })

  it('propagates a genuine AWS failure rather than silently reporting offline', async () => {
    const ivs = loadServiceFresh()
    mockIvsSend.mockRejectedValue(new Error('AWS is down'))

    await expect(ivs.getStreamState('arn:channel:1')).rejects.toThrow('AWS is down')
  })
})

describe('ivs.service -- stopStream (the kill switch)', () => {
  it('calls StopStream successfully', async () => {
    const ivs = loadServiceFresh()
    mockIvsSend.mockResolvedValue({})

    await expect(ivs.stopStream('arn:channel:1')).resolves.toBeUndefined()
    expect(mockIvsSend).toHaveBeenCalledTimes(1)
  })

  it('treats stopping an already-offline channel as a no-op, not an error', async () => {
    const ivs = loadServiceFresh()
    const error = new Error('not broadcasting')
    error.name = 'ChannelNotBroadcasting'
    mockIvsSend.mockRejectedValue(error)

    await expect(ivs.stopStream('arn:channel:1')).resolves.toBeUndefined()
  })

  it('propagates a genuine failure to stop a live stream -- this is the safety kill switch, it must never fail silently', async () => {
    const ivs = loadServiceFresh()
    mockIvsSend.mockRejectedValue(new Error('AWS throttled the request'))

    await expect(ivs.stopStream('arn:channel:1')).rejects.toThrow('AWS throttled the request')
  })
})

describe('ivs.service -- chat', () => {
  it('creates a chat room and returns its ARN', async () => {
    const ivs = loadServiceFresh()
    mockIvsChatSend.mockResolvedValue({ arn: 'arn:room:1' })

    const result = await ivs.createChatRoom('test-room')

    expect(result).toEqual({ roomArn: 'arn:room:1' })
  })

  it('grants a viewer only SEND_MESSAGE, never moderation capabilities', async () => {
    const ivs = loadServiceFresh()
    mockIvsChatSend.mockResolvedValue({ token: 'chat-token', tokenExpirationTime: null })

    await ivs.createChatToken('arn:room:1', 'user-1', { isModerator: false })

    const commandInput = mockIvsChatSend.mock.calls[0][0].input
    expect(commandInput.capabilities).toEqual(['SEND_MESSAGE'])
  })

  it('grants the broadcasting seller full moderation capabilities', async () => {
    const ivs = loadServiceFresh()
    mockIvsChatSend.mockResolvedValue({ token: 'chat-token', tokenExpirationTime: null })

    await ivs.createChatToken('arn:room:1', 'seller-user-1', { isModerator: true })

    const commandInput = mockIvsChatSend.mock.calls[0][0].input
    expect(commandInput.capabilities).toEqual(['SEND_MESSAGE', 'DELETE_MESSAGE', 'DISCONNECT_USER'])
  })
})

describe('ivs.service -- credentials', () => {
  it('throws a clear error when AWS credentials are not configured, rather than an opaque SDK failure', async () => {
    jest.resetModules()
    delete process.env.AWS_IVS_ACCESS_KEY_ID
    delete process.env.AWS_IVS_SECRET_ACCESS_KEY
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ivs = require('./ivs.service') as typeof import('./ivs.service')

    await expect(ivs.createChannel('test')).rejects.toThrow(/AWS_IVS_ACCESS_KEY_ID is required/)
  })
})
