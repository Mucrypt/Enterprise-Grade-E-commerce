import {
  createDiscoverPost,
  updateDiscoverPost,
  deleteDiscoverPost,
  reviewDiscoverPost,
  likePost,
  unlikePost,
} from './discover.controller'
import { requireAdminOrOnboardedSeller } from '../../../middleware/seller-auth'
import { query, getClient } from '../../../database/connection'
import { processDiscoverVideo } from '../../../utils/media'

jest.mock('../../../database/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}))
jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))
// Real validate*/process* would spawn actual ffmpeg -- mocked so these
// tests exercise the controller's own pending/background-processing logic
// (see discover.controller.ts's resolveFastMedia/processDeferredMediaInBackground)
// without needing a real video file or ffmpeg binary.
jest.mock('../../../utils/media', () => ({
  validateVideoFile: jest.fn(() => ({ valid: true })),
  validateImageFile: jest.fn(() => ({ valid: true })),
  validateAudioFile: jest.fn(() => ({ valid: true })),
  processDiscoverImage: jest.fn(async () => ({
    optimized: { large: { url: 'https://cdn.example.com/poster.webp' } },
    original: { url: 'https://cdn.example.com/poster-original.webp' },
  })),
  processDiscoverVideo: jest.fn(async () => ({
    url: 'https://cdn.example.com/video.mp4',
    fileName: 'video.mp4',
    fileSize: 123,
    format: 'mp4',
  })),
  processDiscoverAudio: jest.fn(async () => ({ url: 'https://cdn.example.com/audio.m4a' })),
}))

const mockQuery = query as jest.Mock
const mockGetClient = getClient as jest.Mock
const mockProcessDiscoverVideo = processDiscoverVideo as jest.Mock

const makeRes = () => {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

const makeClient = () => ({
  query: jest.fn(),
  release: jest.fn(),
})

const POST_ID = '44444444-0000-0000-0000-000000000001'
const USER_ID = '11111111-0000-0000-0000-000000000001'

describe('createDiscoverPost -- required media validation, no fabricated posts', () => {
  beforeEach(() => jest.clearAllMocks())

  it('rejects an unrecognized mediaType before touching the database', async () => {
    const req: any = { body: { mediaType: 'gif' }, files: undefined }
    const res = makeRes()

    await createDiscoverPost(req, res)

    expect(mockQuery).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('rejects a video post with no video file and no videoUrl', async () => {
    const req: any = { body: { mediaType: 'video' }, files: undefined }
    const res = makeRes()

    await createDiscoverPost(req, res)

    expect(mockQuery).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('video file') }),
    )
  })

  it('rejects an image post with zero images', async () => {
    const req: any = { body: { mediaType: 'image' }, files: undefined }
    const res = makeRes()

    await createDiscoverPost(req, res)

    expect(mockQuery).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('allows a video post that supplies videoUrl directly (no file re-upload on an edit-like create)', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: POST_ID, media_type: 'video' }] })
    const req: any = { body: { mediaType: 'video', videoUrl: 'https://example.com/x.mp4' }, files: undefined }
    const res = makeRes()

    await createDiscoverPost(req, res)

    expect(mockQuery).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(201)
  })
})

describe('createDiscoverPost -- a real video FILE processes in the background, not inline', () => {
  beforeEach(() => jest.clearAllMocks())

  it('responds 201 with media_status=pending and a null video_url before ffmpeg finishes', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: POST_ID, media_type: 'video', video_url: null, media_status: 'pending' }],
    })

    // processDiscoverVideo's mock stays pending until resolveProcessing()
    // is called below -- if createDiscoverPost awaited it inline, the
    // assertions right after await createDiscoverPost(...) would never
    // run within this test's lifetime. They do, which proves the
    // response goes out without waiting for the transcode.
    let resolveProcessing: () => void = () => undefined
    const processing = new Promise<void>((resolve) => {
      resolveProcessing = resolve
    })
    mockProcessDiscoverVideo.mockImplementation(async () => {
      await processing
      return { url: 'https://cdn.example.com/video.mp4', fileName: 'v.mp4', fileSize: 1, format: 'mp4' }
    })

    const req: any = {
      body: { mediaType: 'video' },
      files: { video: [{ path: '/tmp/upload.mp4', originalname: 'upload.mp4' }] },
      user: { id: USER_ID },
    }
    const res = makeRes()

    await createDiscoverPost(req, res)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: expect.stringContaining('processing'),
        data: expect.objectContaining({ media_status: 'pending' }),
      }),
    )

    const insertParams = mockQuery.mock.calls[0][1]
    expect(insertParams[1]).toBeNull() // video_url -- not known yet
    expect(insertParams[11]).toBe('pending') // media_status

    resolveProcessing()
    await processing
  })
})

describe('likePost / unlikePost -- real, per-user, transactional counters', () => {
  beforeEach(() => jest.clearAllMocks())

  it('inserts a like row and increments like_count together, returning the new count', async () => {
    const client = makeClient()
    mockGetClient.mockResolvedValue(client)
    client.query
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'like-row-1' }] }) // INSERT ... RETURNING id (real insert)
      .mockResolvedValueOnce(undefined) // UPDATE like_count
      .mockResolvedValueOnce({ rows: [{ like_count: 4 }] }) // SELECT like_count
      .mockResolvedValueOnce(undefined) // COMMIT

    const req: any = { params: { id: POST_ID }, user: { userId: USER_ID } }
    const res = makeRes()

    await likePost(req, res)

    expect(client.query).toHaveBeenCalledWith('BEGIN')
    expect(client.query).toHaveBeenCalledWith('COMMIT')
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { count: 4 } })
    expect(client.release).toHaveBeenCalled()
  })

  it('does not double-increment when the like already exists (ON CONFLICT DO NOTHING -- zero rows returned)', async () => {
    const client = makeClient()
    mockGetClient.mockResolvedValue(client)
    client.query
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // INSERT ... ON CONFLICT DO NOTHING -- already liked, no row
      .mockResolvedValueOnce({ rows: [{ like_count: 4 }] }) // SELECT like_count (UPDATE skipped)
      .mockResolvedValueOnce(undefined) // COMMIT

    const req: any = { params: { id: POST_ID }, user: { userId: USER_ID } }
    const res = makeRes()

    await likePost(req, res)

    // The UPDATE like_count call must never have happened -- only BEGIN,
    // INSERT, SELECT, COMMIT (4 calls), not 5.
    expect(client.query).toHaveBeenCalledTimes(4)
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { count: 4 } })
  })

  it('unlikePost decrements but never goes below zero', async () => {
    const client = makeClient()
    mockGetClient.mockResolvedValue(client)
    client.query
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'like-row-1' }] }) // DELETE ... RETURNING id
      .mockResolvedValueOnce(undefined) // UPDATE GREATEST(0, like_count - 1)
      .mockResolvedValueOnce({ rows: [{ like_count: 0 }] }) // SELECT like_count
      .mockResolvedValueOnce(undefined) // COMMIT

    const req: any = { params: { id: POST_ID }, user: { userId: USER_ID } }
    const res = makeRes()

    await unlikePost(req, res)

    expect(res.json).toHaveBeenCalledWith({ success: true, data: { count: 0 } })
  })

  it('rolls back and returns 500 if the transaction fails partway through', async () => {
    const client = makeClient()
    mockGetClient.mockResolvedValue(client)
    client.query
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockRejectedValueOnce(new Error('connection reset')) // INSERT fails

    const req: any = { params: { id: POST_ID }, user: { userId: USER_ID } }
    const res = makeRes()

    await likePost(req, res)

    expect(client.query).toHaveBeenCalledWith('ROLLBACK')
    expect(res.status).toHaveBeenCalledWith(500)
    expect(client.release).toHaveBeenCalled()
  })

  it('returns 404 when the post does not exist', async () => {
    const client = makeClient()
    mockGetClient.mockResolvedValue(client)
    client.query
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'like-row-1' }] }) // INSERT
      .mockResolvedValueOnce(undefined) // UPDATE
      .mockResolvedValueOnce({ rows: [] }) // SELECT like_count -- post gone
      .mockResolvedValueOnce(undefined) // COMMIT

    const req: any = { params: { id: 'does-not-exist' }, user: { userId: USER_ID } }
    const res = makeRes()

    await likePost(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
  })
})

const SELLER_PROFILE_ID = '99999999-0000-0000-0000-000000000001'

describe('requireAdminOrOnboardedSeller -- real DB check, not a cached JWT claim', () => {
  beforeEach(() => jest.clearAllMocks())

  it('rejects with 401 when there is no authenticated user', async () => {
    const req: any = {}
    const res = makeRes()
    const next = jest.fn()

    await requireAdminOrOnboardedSeller(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('lets admin/super_admin through without touching seller_profiles', async () => {
    const req: any = { user: { id: USER_ID, userType: 'admin' } }
    const res = makeRes()
    const next = jest.fn()

    await requireAdminOrOnboardedSeller(req, res, next)

    expect(mockQuery).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalled()
  })

  it('rejects a signed-in customer with no seller_profiles row in good standing', async () => {
    mockQuery.mockResolvedValue({ rows: [] })
    const req: any = { user: { id: USER_ID, userType: 'customer' } }
    const res = makeRes()
    const next = jest.fn()

    await requireAdminOrOnboardedSeller(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('attaches sellerProfileId and calls next for an onboarded seller in good standing', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: SELLER_PROFILE_ID }] })
    const req: any = { user: { id: USER_ID, userType: 'customer' } }
    const res = makeRes()
    const next = jest.fn()

    await requireAdminOrOnboardedSeller(req, res, next)

    expect(req.sellerProfileId).toBe(SELLER_PROFILE_ID)
    expect(next).toHaveBeenCalled()
  })
})

describe('createDiscoverPost -- seller-authored posts are always pending review', () => {
  beforeEach(() => jest.clearAllMocks())

  it('forces is_active=false and stamps seller_profile_id, ignoring any isActive/position the seller sent', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: POST_ID, media_type: 'video' }] })
    const req: any = {
      body: { mediaType: 'video', videoUrl: 'https://example.com/x.mp4', isActive: true, position: 99 },
      files: undefined,
      user: { id: USER_ID },
      sellerProfileId: SELLER_PROFILE_ID,
    }
    const res = makeRes()

    await createDiscoverPost(req, res)

    const params = mockQuery.mock.calls[0][1]
    expect(params[5]).toBe(false) // is_active
    expect(params[6]).toBe(0) // position -- sellers can't pin the feed
    expect(params[10]).toBe(SELLER_PROFILE_ID) // seller_profile_id
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('admin/staff (no sellerProfileId) keep full control of isActive/position', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: POST_ID, media_type: 'video' }] })
    const req: any = {
      body: { mediaType: 'video', videoUrl: 'https://example.com/x.mp4', isActive: true, position: 5 },
      files: undefined,
      user: { id: USER_ID },
    }
    const res = makeRes()

    await createDiscoverPost(req, res)

    const params = mockQuery.mock.calls[0][1]
    expect(params[5]).toBe(true)
    expect(params[6]).toBe(5)
    expect(params[10]).toBeNull()
  })
})

describe('updateDiscoverPost / deleteDiscoverPost -- a seller can only touch their own posts', () => {
  beforeEach(() => jest.clearAllMocks())

  it('403s when a seller tries to update a post they did not create', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ created_by: 'someone-else' }] }) // ownership lookup
    const req: any = {
      params: { id: POST_ID },
      body: { caption: 'hijacked' },
      files: undefined,
      user: { id: USER_ID },
      sellerProfileId: SELLER_PROFILE_ID,
    }
    const res = makeRes()

    await updateDiscoverPost(req, res)

    expect(res.status).toHaveBeenCalledWith(403)
    // Only the ownership lookup ran -- no UPDATE was attempted.
    expect(mockQuery).toHaveBeenCalledTimes(1)
  })

  it('403s when a seller tries to delete a post they did not create', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ created_by: 'someone-else' }] })
    const req: any = { params: { id: POST_ID }, user: { id: USER_ID }, sellerProfileId: SELLER_PROFILE_ID }
    const res = makeRes()

    await deleteDiscoverPost(req, res)

    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('allows a seller to update their own post, but forces it back to pending', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ created_by: USER_ID }] }) // ownership lookup
      .mockResolvedValueOnce({ rows: [{ id: POST_ID, is_active: false }] }) // UPDATE ... RETURNING *

    const req: any = {
      params: { id: POST_ID },
      body: { caption: 'updated by the seller', isActive: true, position: 50 },
      files: undefined,
      user: { id: USER_ID },
      sellerProfileId: SELLER_PROFILE_ID,
    }
    const res = makeRes()

    await updateDiscoverPost(req, res)

    const updateCall = mockQuery.mock.calls[1]
    expect(updateCall[0]).toContain('is_active = $')
    expect(updateCall[0]).not.toContain('position = $')
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    )
  })

  it('re-uploading a video file on edit sets media_status=pending and defers the URL, same as create', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ created_by: USER_ID }] }) // ownership lookup
      .mockResolvedValueOnce({ rows: [{ id: POST_ID, media_status: 'pending', video_url: null }] }) // UPDATE ... RETURNING *

    let resolveProcessing: () => void = () => undefined
    const processing = new Promise<void>((resolve) => {
      resolveProcessing = resolve
    })
    mockProcessDiscoverVideo.mockImplementation(async () => {
      await processing
      return { url: 'https://cdn.example.com/replacement.mp4', fileName: 'v.mp4', fileSize: 1, format: 'mp4' }
    })

    const req: any = {
      params: { id: POST_ID },
      body: { caption: 'same post, new video' },
      files: { video: [{ path: '/tmp/replacement.mp4', originalname: 'replacement.mp4' }] },
      user: { id: USER_ID },
    }
    const res = makeRes()

    await updateDiscoverPost(req, res)

    const updateCall = mockQuery.mock.calls[1]
    expect(updateCall[0]).toContain('media_status = $')
    expect(updateCall[0]).not.toContain('video_url = $') // deferred -- no file-derived URL to write yet
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: expect.stringContaining('processing'),
        data: expect.objectContaining({ media_status: 'pending' }),
      }),
    )

    resolveProcessing()
    await processing
  })
})

describe('reviewDiscoverPost -- admin-only approval for a pending seller post', () => {
  beforeEach(() => jest.clearAllMocks())

  it('approves (is_active=true) a pending seller-authored post', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: POST_ID, is_active: true, seller_profile_id: SELLER_PROFILE_ID }] })
    const req: any = { params: { id: POST_ID } }
    const res = makeRes()

    await reviewDiscoverPost(req, res)

    expect(mockQuery.mock.calls[0][0]).toContain('SET is_active = TRUE')
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: expect.objectContaining({ is_active: true }) }),
    )
  })

  it('404s when there is no matching pending seller post', async () => {
    mockQuery.mockResolvedValue({ rows: [] })
    const req: any = { params: { id: 'does-not-exist' } }
    const res = makeRes()

    await reviewDiscoverPost(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
  })
})
