import { STAFF_ROLE_PERMISSIONS, Permission, StaffRole } from './staff-permissions.config'

/**
 * PROMOTION-OPS-1 -- regression tests for the exact access-control
 * invariants the phase spec was most explicit about: a market-scoped
 * manager must never silently gain global social-publishing authority, and
 * "can run a campaign" must stay a strictly narrower grant than "can
 * connect/disconnect a platform account." These are cheap, pure assertions
 * against the permission matrix itself -- no DB, no HTTP -- so a future
 * accidental edit to staff-permissions.config.ts fails loudly here instead
 * of only being caught by a live-server permission-denial bug report.
 */
describe('staff-permissions.config -- PROMOTION-OPS-1 social.* invariants', () => {
  const SOCIAL_PERMISSIONS: Permission[] = [
    'social.view',
    'social.publish',
    'social.schedule',
    'social.analytics',
    'social.accounts.view',
    'social.accounts.manage',
  ]

  const ACCOUNT_MANAGEMENT_PERMISSIONS: Permission[] = ['social.accounts.view', 'social.accounts.manage']

  function grantedOf(role: StaffRole, permissions: Permission[]): Permission[] {
    const roleSet = STAFF_ROLE_PERMISSIONS[role]
    return permissions.filter((p) => roleSet.has(p))
  }

  it('MARKET_MANAGER holds none of the social.* permissions -- never silently gains global publishing authority', () => {
    expect(grantedOf('MARKET_MANAGER', SOCIAL_PERMISSIONS)).toEqual([])
    expect(STAFF_ROLE_PERMISSIONS.MARKET_MANAGER.has('marketing.view')).toBe(true)
  })

  it('MARKETING_MANAGER may run campaigns but holds neither social.accounts.view nor social.accounts.manage', () => {
    expect(STAFF_ROLE_PERMISSIONS.MARKETING_MANAGER.has('social.view')).toBe(true)
    expect(STAFF_ROLE_PERMISSIONS.MARKETING_MANAGER.has('social.publish')).toBe(true)
    expect(STAFF_ROLE_PERMISSIONS.MARKETING_MANAGER.has('social.schedule')).toBe(true)
    expect(STAFF_ROLE_PERMISSIONS.MARKETING_MANAGER.has('social.analytics')).toBe(true)
    expect(grantedOf('MARKETING_MANAGER', ACCOUNT_MANAGEMENT_PERMISSIONS)).toEqual([])
  })

  it('ADMIN may run campaigns but holds neither social.accounts.view nor social.accounts.manage, matching its existing exclusion from settings/security/staff.manage', () => {
    expect(STAFF_ROLE_PERMISSIONS.ADMIN.has('social.view')).toBe(true)
    expect(STAFF_ROLE_PERMISSIONS.ADMIN.has('social.publish')).toBe(true)
    expect(grantedOf('ADMIN', ACCOUNT_MANAGEMENT_PERMISSIONS)).toEqual([])
  })

  it('social.accounts.* is held only by OWNER and SUPER_ADMIN this phase', () => {
    const rolesHoldingAccountManagement = (Object.keys(STAFF_ROLE_PERMISSIONS) as StaffRole[]).filter(
      (role) => grantedOf(role, ACCOUNT_MANAGEMENT_PERMISSIONS).length > 0,
    )
    expect(rolesHoldingAccountManagement.sort()).toEqual(['OWNER', 'SUPER_ADMIN'])
  })

  it('OWNER and SUPER_ADMIN hold all 6 social.* permissions', () => {
    expect(grantedOf('OWNER', SOCIAL_PERMISSIONS)).toEqual(SOCIAL_PERMISSIONS)
    expect(grantedOf('SUPER_ADMIN', SOCIAL_PERMISSIONS)).toEqual(SOCIAL_PERMISSIONS)
  })

  it('CATALOG_MANAGER, ORDER_MANAGER, and SUPPORT_AGENT hold none of the social.* permissions -- out of remit', () => {
    expect(grantedOf('CATALOG_MANAGER', SOCIAL_PERMISSIONS)).toEqual([])
    expect(grantedOf('ORDER_MANAGER', SOCIAL_PERMISSIONS)).toEqual([])
    expect(grantedOf('SUPPORT_AGENT', SOCIAL_PERMISSIONS)).toEqual([])
  })
})
