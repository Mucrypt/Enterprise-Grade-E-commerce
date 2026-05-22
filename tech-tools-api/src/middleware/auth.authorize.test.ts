import { authorize } from './auth'

const makeRes = () => {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

describe('authorize middleware', () => {
  it('returns 401 when user is missing', () => {
    const middleware = authorize('admin', 'super_admin')
    const req: any = {}
    const res = makeRes()
    const next = jest.fn()

    middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 403 when role is not allowed', () => {
    const middleware = authorize('admin', 'super_admin')
    const req: any = { user: { userType: 'customer' } }
    const res = makeRes()
    const next = jest.fn()

    middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('calls next when role is allowed', () => {
    const middleware = authorize('admin', 'super_admin')
    const req: any = { user: { userType: 'admin' } }
    const res = makeRes()
    const next = jest.fn()

    middleware(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
  })
})
