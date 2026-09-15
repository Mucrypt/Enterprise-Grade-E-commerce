import {
  createDiscoverPost,
  likePost,
  unlikePost,
} from './discover.controller'
import { query, getClient } from '../../../database/connection'

jest.mock('../../../database/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}))
jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

const mockQuery = query as jest.Mock
const mockGetClient = getClient as jest.Mock

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
