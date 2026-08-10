import jwt from 'jsonwebtoken'
import { resolveDashboardAccess } from './websocket.service'
import { JWT_SECRET } from '../config/jwt.config'
import { loadStaffContext } from '../middleware/staff'

jest.mock('../middleware/staff', () => ({
  loadStaffContext: jest.fn(),
}))

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

const mockLoadStaffContext = loadStaffContext as jest.Mock

function signToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' })
}

/**
 * ADMIN-2B Production Review Round 1 -- this function is the entire fix
 * for a real pre-existing hole: the Socket.IO 'dashboard' room previously
 * had NO authentication or authorization at all (any socket, logged in or
 * not, could `emit('register', {type:'dashboard'})` and receive live
 * global revenue/orders/conversion/alert data). These tests exist to make
 * that regression impossible to reintroduce silently.
 */
describe('resolveDashboardAccess', () => {
  beforeEach(() => jest.clearAllMocks())

  it('denies a connection with no token at all', async () => {
    expect(await resolveDashboardAccess(undefined)).toBe('denied')
    expect(await resolveDashboardAccess(null)).toBe('denied')
    expect(await resolveDashboardAccess('')).toBe('denied')
  })

  it('denies a non-string token (e.g. a client sending garbage in the auth payload)', async () => {
    expect(await resolveDashboardAccess({ malicious: true })).toBe('denied')
    expect(await resolveDashboardAccess(12345)).toBe('denied')
  })

  it('denies an invalid/forged token', async () => {
    expect(await resolveDashboardAccess('not-a-real-jwt')).toBe('denied')
    expect(await resolveDashboardAccess(jwt.sign({ userId: 'x' }, 'wrong-secret'))).toBe('denied')
  })

  it('denies an expired token', async () => {
    const expired = jwt.sign({ userId: 'u1', userType: 'admin' }, JWT_SECRET, { expiresIn: '-1s' })
    expect(await resolveDashboardAccess(expired)).toBe('denied')
    expect(mockLoadStaffContext).not.toHaveBeenCalled()
  })

  it('grants global access to a legacy admin/super_admin token without ever touching staff_memberships', async () => {
    expect(await resolveDashboardAccess(signToken({ userId: 'a1', userType: 'admin' }))).toBe('global')
    expect(await resolveDashboardAccess(signToken({ userId: 'a2', userType: 'super_admin' }))).toBe('global')
    expect(mockLoadStaffContext).not.toHaveBeenCalled()
  })

  it('grants global access to a staff member holding any ACTIVE global (market_scope IS NULL) membership', async () => {
    mockLoadStaffContext.mockResolvedValue({
      memberships: [{ id: 'm1', role: 'OWNER', marketScope: null }],
      permissions: new Set(['analytics.view_market']),
    })
    const token = signToken({ userId: 'u1', userType: 'customer' })
    expect(await resolveDashboardAccess(token)).toBe('global')
  })

  it('marks a MARKET_MANAGER (scoped, non-null market_scope) as "scoped" -- NOT global, and NOT silently denied', async () => {
    mockLoadStaffContext.mockResolvedValue({
      memberships: [{ id: 'm1', role: 'MARKET_MANAGER', marketScope: ['CM'] }],
      permissions: new Set(['analytics.view_market']),
    })
    const token = signToken({ userId: 'u2', userType: 'customer' })
    expect(await resolveDashboardAccess(token)).toBe('scoped')
  })

  it('denies a plain customer with no staff role and no legacy privilege', async () => {
    mockLoadStaffContext.mockResolvedValue({ memberships: [], permissions: new Set() })
    const token = signToken({ userId: 'u3', userType: 'customer' })
    expect(await resolveDashboardAccess(token)).toBe('denied')
  })

  it('denies a SUSPENDED/REVOKED MARKET_MANAGER the same as having no staff role at all (loadStaffContext only ever returns ACTIVE rows)', async () => {
    // loadStaffContext's own query filters WHERE status = 'ACTIVE' -- a
    // suspended/revoked-only user is indistinguishable here from "never
    // had a membership," which is exactly the fail-closed behavior every
    // other staff-gated surface in this codebase already relies on.
    mockLoadStaffContext.mockResolvedValue({ memberships: [], permissions: new Set() })
    const token = signToken({ userId: 'u4', userType: 'customer' })
    expect(await resolveDashboardAccess(token)).toBe('denied')
  })

  it('fails closed (denied) if a staff member somehow holds market_scope=[] and no analytics.view_market permission', async () => {
    mockLoadStaffContext.mockResolvedValue({
      memberships: [{ id: 'm1', role: 'SUPPORT_AGENT', marketScope: ['CM'] }],
      permissions: new Set(['support.view']),
    })
    const token = signToken({ userId: 'u5', userType: 'customer' })
    expect(await resolveDashboardAccess(token)).toBe('denied')
  })

  it('denies (does not crash) if the staff_memberships lookup itself throws', async () => {
    mockLoadStaffContext.mockRejectedValue(new Error('connection reset'))
    const token = signToken({ userId: 'u6', userType: 'customer' })
    await expect(resolveDashboardAccess(token)).resolves.toBe('denied')
  })

  it('denies a token missing userId entirely', async () => {
    const token = signToken({ userType: 'customer' })
    expect(await resolveDashboardAccess(token)).toBe('denied')
    expect(mockLoadStaffContext).not.toHaveBeenCalled()
  })
})
