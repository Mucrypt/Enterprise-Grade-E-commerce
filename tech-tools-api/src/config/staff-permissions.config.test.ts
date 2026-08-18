import { STAFF_ROLE_PERMISSIONS, Permission, StaffRole, MARKET_SCOPED_PERMISSIONS } from './staff-permissions.config'

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

/**
 * TIKTOK-COMMERCE-1 -- regression tests for the channels.tiktok.*
 * permission matrix, following the exact same invariants and reasoning
 * PROMOTION-OPS-1's social.* tests above already established: a
 * market-scoped manager must never silently gain channel authority, and
 * "can operate the channel day to day" must stay a strictly narrower grant
 * than "can connect/disconnect the account."
 */
describe('staff-permissions.config -- TIKTOK-COMMERCE-1 channels.tiktok.* invariants', () => {
  const CHANNEL_PERMISSIONS: Permission[] = [
    'channels.tiktok.view',
    'channels.tiktok.products',
    'channels.tiktok.orders',
    'channels.tiktok.fulfillment',
    'channels.tiktok.finance',
    'channels.tiktok.manage',
    'channels.tiktok.connections',
    'channels.tiktok.analytics',
  ]

  const CONNECTION_PERMISSIONS: Permission[] = ['channels.tiktok.connections']

  function grantedOf(role: StaffRole, permissions: Permission[]): Permission[] {
    const roleSet = STAFF_ROLE_PERMISSIONS[role]
    return permissions.filter((p) => roleSet.has(p))
  }

  it('MARKET_MANAGER holds none of the channels.tiktok.* permissions -- never silently gains channel authority', () => {
    expect(grantedOf('MARKET_MANAGER', CHANNEL_PERMISSIONS)).toEqual([])
  })

  it('MARKETING_MANAGER and SUPPORT_AGENT hold none of the channels.tiktok.* permissions -- out of remit', () => {
    expect(grantedOf('MARKETING_MANAGER', CHANNEL_PERMISSIONS)).toEqual([])
    expect(grantedOf('SUPPORT_AGENT', CHANNEL_PERMISSIONS)).toEqual([])
  })

  it('ADMIN may operate the channel but holds neither channels.tiktok.connections -- connecting the account stays separate from day-to-day operation', () => {
    expect(STAFF_ROLE_PERMISSIONS.ADMIN.has('channels.tiktok.view')).toBe(true)
    expect(STAFF_ROLE_PERMISSIONS.ADMIN.has('channels.tiktok.products')).toBe(true)
    expect(STAFF_ROLE_PERMISSIONS.ADMIN.has('channels.tiktok.orders')).toBe(true)
    expect(STAFF_ROLE_PERMISSIONS.ADMIN.has('channels.tiktok.finance')).toBe(true)
    expect(STAFF_ROLE_PERMISSIONS.ADMIN.has('channels.tiktok.manage')).toBe(true)
    expect(STAFF_ROLE_PERMISSIONS.ADMIN.has('channels.tiktok.analytics')).toBe(true)
    expect(grantedOf('ADMIN', CONNECTION_PERMISSIONS)).toEqual([])
  })

  it('channels.tiktok.connections is held only by OWNER and SUPER_ADMIN', () => {
    const rolesHoldingConnections = (Object.keys(STAFF_ROLE_PERMISSIONS) as StaffRole[]).filter(
      (role) => grantedOf(role, CONNECTION_PERMISSIONS).length > 0,
    )
    expect(rolesHoldingConnections.sort()).toEqual(['OWNER', 'SUPER_ADMIN'])
  })

  it('OWNER and SUPER_ADMIN hold all 8 channels.tiktok.* permissions', () => {
    expect(grantedOf('OWNER', CHANNEL_PERMISSIONS)).toEqual(CHANNEL_PERMISSIONS)
    expect(grantedOf('SUPER_ADMIN', CHANNEL_PERMISSIONS)).toEqual(CHANNEL_PERMISSIONS)
  })

  it('CATALOG_MANAGER holds only channels.tiktok.view/products -- in-remit subset only', () => {
    expect(grantedOf('CATALOG_MANAGER', CHANNEL_PERMISSIONS).sort()).toEqual(
      ['channels.tiktok.products', 'channels.tiktok.view'].sort(),
    )
  })

  it('ORDER_MANAGER holds only channels.tiktok.view/orders -- in-remit subset only', () => {
    expect(grantedOf('ORDER_MANAGER', CHANNEL_PERMISSIONS).sort()).toEqual(
      ['channels.tiktok.orders', 'channels.tiktok.view'].sort(),
    )
  })

  it('channels.tiktok.orders is a market-scoped permission', () => {
    expect(MARKET_SCOPED_PERMISSIONS.has('channels.tiktok.orders')).toBe(true)
  })
})

/**
 * SOURCING-1 -- regression tests for the sourcing.* permission matrix.
 * Unlike channels.tiktok.*, sourcing has no orders/finance sub-domain to
 * split off -- CATALOG_MANAGER and ADMIN both get the full set including
 * sourcing.manage, since importing/pricing/publishing a catalog listing
 * is squarely in-remit for the role that already owns catalog.manage.
 */
describe('staff-permissions.config -- SOURCING-1 sourcing.* invariants', () => {
  const SOURCING_PERMISSIONS: Permission[] = ['sourcing.view', 'sourcing.import', 'sourcing.manage']

  function grantedOf(role: StaffRole, permissions: Permission[]): Permission[] {
    const roleSet = STAFF_ROLE_PERMISSIONS[role]
    return permissions.filter((p) => roleSet.has(p))
  }

  it('MARKET_MANAGER holds none of the sourcing.* permissions -- never silently gains catalog-authoring authority', () => {
    expect(grantedOf('MARKET_MANAGER', SOURCING_PERMISSIONS)).toEqual([])
  })

  it('MARKETING_MANAGER, ORDER_MANAGER, and SUPPORT_AGENT hold none of the sourcing.* permissions -- out of remit', () => {
    expect(grantedOf('MARKETING_MANAGER', SOURCING_PERMISSIONS)).toEqual([])
    expect(grantedOf('ORDER_MANAGER', SOURCING_PERMISSIONS)).toEqual([])
    expect(grantedOf('SUPPORT_AGENT', SOURCING_PERMISSIONS)).toEqual([])
  })

  it('OWNER, SUPER_ADMIN, ADMIN, and CATALOG_MANAGER hold all 3 sourcing.* permissions', () => {
    expect(grantedOf('OWNER', SOURCING_PERMISSIONS).sort()).toEqual([...SOURCING_PERMISSIONS].sort())
    expect(grantedOf('SUPER_ADMIN', SOURCING_PERMISSIONS).sort()).toEqual([...SOURCING_PERMISSIONS].sort())
    expect(grantedOf('ADMIN', SOURCING_PERMISSIONS).sort()).toEqual([...SOURCING_PERMISSIONS].sort())
    expect(grantedOf('CATALOG_MANAGER', SOURCING_PERMISSIONS).sort()).toEqual([...SOURCING_PERMISSIONS].sort())
  })

  it('sourcing.* is not a market-scoped permission set -- a sourced product has no market/country dimension yet', () => {
    expect(MARKET_SCOPED_PERMISSIONS.has('sourcing.view')).toBe(false)
    expect(MARKET_SCOPED_PERMISSIONS.has('sourcing.import')).toBe(false)
    expect(MARKET_SCOPED_PERMISSIONS.has('sourcing.manage')).toBe(false)
  })
})
