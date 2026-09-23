jest.mock('../../database/connection', () => ({ query: jest.fn() }))
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

const mockCreateChannel = jest.fn()
const mockCreateChatRoom = jest.fn()
const mockGetStreamKeyValue = jest.fn()
const mockGetStreamState = jest.fn()
const mockStopStream = jest.fn()
const mockCreateChatToken = jest.fn()
jest.mock('./ivs.service', () => ({
  createChannel: (...args: unknown[]) => mockCreateChannel(...args),
  createChatRoom: (...args: unknown[]) => mockCreateChatRoom(...args),
  getStreamKeyValue: (...args: unknown[]) => mockGetStreamKeyValue(...args),
  getStreamState: (...args: unknown[]) => mockGetStreamState(...args),
  stopStream: (...args: unknown[]) => mockStopStream(...args),
  createChatToken: (...args: unknown[]) => mockCreateChatToken(...args),
}))

const mockSendToRoom = jest.fn()
jest.mock('../websocket.service', () => ({
  webSocketService: { sendToRoom: (...args: unknown[]) => mockSendToRoom(...args) },
}))

import { query } from '../../database/connection'
import * as liveSessionService from './live-session.service'

const mockQuery = query as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

describe('createSession', () => {
  it('creates a real AWS IVS channel + chat room and persists their identifiers', async () => {
    mockCreateChannel.mockResolvedValue({
      channelArn: 'arn:channel:1',
      ingestEndpoint: 'ingest.example',
      playbackUrl: 'https://play.example/1',
      streamKeyArn: 'arn:key:1',
      streamKeyValue: 'sk_live_abc',
    })
    mockCreateChatRoom.mockResolvedValue({ roomArn: 'arn:room:1' })
    mockQuery.mockResolvedValue({
      rows: [
        {
          id: 'session-1',
          seller_profile_id: 'seller-1',
          title: 'My live sale',
          status: 'scheduled',
          ivs_ingest_endpoint: 'ingest.example',
          ivs_playback_url: 'https://play.example/1',
          thumbnail_url: null,
          scheduled_start_at: null,
          started_at: null,
          ended_at: null,
          viewer_count_peak: 0,
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
    })

    const result = await liveSessionService.createSession({ sellerProfileId: 'seller-1', title: 'My live sale' })

    expect(result.id).toBe('session-1')
    expect(result.status).toBe('scheduled')
    expect(mockCreateChannel).toHaveBeenCalledTimes(1)
    expect(mockCreateChatRoom).toHaveBeenCalledTimes(1)
    const insertParams = mockQuery.mock.calls[0][1]
    expect(insertParams).toEqual([
      'seller-1',
      'My live sale',
      'arn:channel:1',
      'ingest.example',
      'arn:key:1',
      'https://play.example/1',
      'arn:room:1',
      null,
    ])
  })
})

describe('startSession', () => {
  it('transitions to live and broadcasts to mobile-app and web-store rooms', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ id: 'session-1', title: 'My live sale', status: 'live' }],
    })

    const result = await liveSessionService.startSession('session-1')

    expect(result?.status).toBe('live')
    expect(mockSendToRoom).toHaveBeenCalledWith('mobile-app', 'live-session-started', {
      sessionId: 'session-1',
      title: 'My live sale',
    })
    expect(mockSendToRoom).toHaveBeenCalledWith('web-store', 'live-session-started', {
      sessionId: 'session-1',
      title: 'My live sale',
    })
  })

  it('returns null for a session that cannot be started (e.g. already ended)', async () => {
    mockQuery.mockResolvedValue({ rows: [] })

    const result = await liveSessionService.startSession('session-1')

    expect(result).toBeNull()
    expect(mockSendToRoom).not.toHaveBeenCalled()
  })
})

describe('endSession -- the kill switch', () => {
  it('stops the real AWS stream, records the peak viewer count, and broadcasts the end', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'session-1', status: 'live', ivs_channel_arn: 'arn:channel:1', viewer_count_peak: 10 }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 'session-1', status: 'ended', viewer_count_peak: 25 }],
      })
    mockGetStreamState.mockResolvedValue({ isLive: true, viewerCount: 25, startedAt: null })
    mockStopStream.mockResolvedValue(undefined)

    const result = await liveSessionService.endSession('session-1', 'seller')

    expect(mockStopStream).toHaveBeenCalledWith('arn:channel:1')
    expect(result?.status).toBe('ended')
    const updateParams = mockQuery.mock.calls[1][1]
    expect(updateParams).toEqual(['session-1', 25])
    expect(mockSendToRoom).toHaveBeenCalledWith('live:session-1', 'live-session-ended', {
      sessionId: 'session-1',
      endedBy: 'seller',
    })
  })

  it('is idempotent -- ending an already-ended session does not call stopStream again', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'session-1', status: 'ended', viewer_count_peak: 25 }] })

    const result = await liveSessionService.endSession('session-1', 'admin')

    expect(result?.status).toBe('ended')
    expect(mockStopStream).not.toHaveBeenCalled()
  })

  it('still marks the session ended even if the AWS stopStream call itself fails -- a viewer-facing "stream is over" beats a stuck live session', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'session-1', status: 'live', ivs_channel_arn: 'arn:channel:1', viewer_count_peak: 5 }],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'session-1', status: 'ended', viewer_count_peak: 5 }] })
    mockGetStreamState.mockResolvedValue({ isLive: true, viewerCount: 5, startedAt: null })
    mockStopStream.mockRejectedValue(new Error('AWS throttled'))

    const result = await liveSessionService.endSession('session-1', 'admin')

    expect(result?.status).toBe('ended')
  })

  it('returns null for a session that does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    const result = await liveSessionService.endSession('missing', 'admin')

    expect(result).toBeNull()
  })
})

describe('pinProduct', () => {
  it('unpins any other product in the session so only one stays pinned', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'p1', name: 'Widget' }] })

    await liveSessionService.pinProduct('session-1', 'p1')

    const unpinCall = mockQuery.mock.calls.find((c: any[]) => c[0].includes('is_pinned = FALSE') && c[0].includes('product_id != $2'))
    expect(unpinCall).toBeDefined()
    expect(unpinCall![1]).toEqual(['session-1', 'p1'])
    expect(mockSendToRoom).toHaveBeenCalledWith(
      'live:session-1',
      'live-product-pinned',
      expect.objectContaining({ sessionId: 'session-1' }),
    )
  })
})

describe('getSessionForViewer', () => {
  it('returns live state, pinned product, and a viewer-scoped (non-moderator) chat token', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'session-1', ivs_channel_arn: 'arn:channel:1', ivs_chat_room_arn: 'arn:room:1', status: 'live' }],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'p1', name: 'Widget' }] })
    mockGetStreamState.mockResolvedValue({ isLive: true, viewerCount: 7, startedAt: null })
    mockCreateChatToken.mockResolvedValue({ token: 'viewer-token', expiresAt: null })

    const result = await liveSessionService.getSessionForViewer('session-1', 'viewer-user-1')

    expect(result?.isLive).toBe(true)
    expect(result?.viewerCount).toBe(7)
    expect(result?.pinnedProduct).toEqual({ id: 'p1', name: 'Widget' })
    expect(result?.chatToken).toBe('viewer-token')
    expect(mockCreateChatToken).toHaveBeenCalledWith('arn:room:1', 'viewer-user-1', { isModerator: false })
  })

  it('returns null for a session that does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    const result = await liveSessionService.getSessionForViewer('missing', 'viewer-user-1')

    expect(result).toBeNull()
  })
})
