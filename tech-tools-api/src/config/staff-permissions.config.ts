// Single authoritative permission matrix for the staff system. Enforced
// entirely server-side, in code -- deliberately NOT a seeded database table.
// The original admin_permissions/admin_role_permissions tables (see
// docs/MARKET-OPS-STAFF-ACCESS-AUDIT.md §2.2) already tried the seeded-
// table approach and it was never actually wired to any request-time
// check -- purely decorative. This file exists so that mistake isn't
// repeated: every permission check in this codebase reads from here.

export type StaffRole =
  | 'OWNER'
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'MARKET_MANAGER'
  | 'CATALOG_MANAGER'
  | 'ORDER_MANAGER'
  | 'MARKETING_MANAGER'
  | 'SUPPORT_AGENT'

export const STAFF_ROLES: StaffRole[] = [
  'OWNER',
  'SUPER_ADMIN',
  'ADMIN',
  'MARKET_MANAGER',
  'CATALOG_MANAGER',
  'ORDER_MANAGER',
  'MARKETING_MANAGER',
  'SUPPORT_AGENT',
]

export type Permission =
  | 'dashboard.view'
  | 'analytics.view'
  | 'analytics.view_global'
  | 'analytics.view_market'
  | 'orders.view'
  | 'orders.manage'
  | 'orders.cancel'
  | 'orders.refund'
  | 'customers.view'
  | 'customers.manage'
  | 'customers.view_pii'
  | 'catalog.view'
  | 'catalog.manage'
  | 'catalog.publish'
  | 'inventory.view'
  | 'inventory.manage'
  | 'suppliers.view'
  | 'suppliers.manage'
  | 'suppliers.import'
  | 'marketing.view'
  | 'marketing.manage'
  | 'campaigns.view'
  | 'campaigns.manage'
  | 'social.view'
  | 'social.publish'
  | 'social.schedule'
  | 'social.analytics'
  | 'social.accounts.view'
  | 'social.accounts.manage'
  | 'channels.tiktok.view'
  | 'channels.tiktok.products'
  | 'channels.tiktok.orders'
  | 'channels.tiktok.fulfillment'
  | 'channels.tiktok.finance'
  | 'channels.tiktok.manage'
  | 'channels.tiktok.connections'
  | 'channels.tiktok.analytics'
  // SOURCING-1: in-house Alibaba/Amazon product importer. Catalog-adjacent
  // authoring work with no orders/finance sub-domain to split off (unlike
  // channels.tiktok.* above) -- see the grant matrix below.
  | 'sourcing.view'
  | 'sourcing.import'
  | 'sourcing.manage'
  | 'support.view'
  | 'support.manage'
  | 'shipping.view'
  | 'shipping.manage'
  | 'staff.view'
  | 'staff.manage'
  | 'staff.grant'
  | 'staff.revoke'
  | 'settings.view'
  | 'settings.manage'
  | 'payments.view'
  | 'payments.manage'
  | 'security.view'
  | 'security.manage'

const ALL_PERMISSIONS: Permission[] = [
  'dashboard.view',
  'analytics.view',
  'analytics.view_global',
  'analytics.view_market',
  'orders.view',
  'orders.manage',
  'orders.cancel',
  'orders.refund',
  'customers.view',
  'customers.manage',
  'customers.view_pii',
  'catalog.view',
  'catalog.manage',
  'catalog.publish',
  'inventory.view',
  'inventory.manage',
  'suppliers.view',
  'suppliers.manage',
  'suppliers.import',
  'marketing.view',
  'marketing.manage',
  'campaigns.view',
  'campaigns.manage',
  'social.view',
  'social.publish',
  'social.schedule',
  'social.analytics',
  'social.accounts.view',
  'social.accounts.manage',
  'channels.tiktok.view',
  'channels.tiktok.products',
  'channels.tiktok.orders',
  'channels.tiktok.fulfillment',
  'channels.tiktok.finance',
  'channels.tiktok.manage',
  'channels.tiktok.connections',
  'channels.tiktok.analytics',
  'sourcing.view',
  'sourcing.import',
  'sourcing.manage',
  'support.view',
  'support.manage',
  'shipping.view',
  'shipping.manage',
  'staff.view',
  'staff.manage',
  'staff.grant',
  'staff.revoke',
  'settings.view',
  'settings.manage',
  'payments.view',
  'payments.manage',
  'security.view',
  'security.manage',
]

/**
 * Role -> granted permissions. OWNER and SUPER_ADMIN intentionally hold
 * identical permission sets here -- the distinction between them (e.g.
 * OWNER cannot be revoked by a SUPER_ADMIN, only an OWNER can grant OWNER)
 * is a role-*hierarchy* rule, enforced separately in staff.controller.ts
 * via ROLE_AUTHORITY_RANK below, not a difference in what either role is
 * permitted to *do* day to day.
 */
export const STAFF_ROLE_PERMISSIONS: Record<StaffRole, ReadonlySet<Permission>> = {
  OWNER: new Set(ALL_PERMISSIONS),
  SUPER_ADMIN: new Set(ALL_PERMISSIONS),

  // Broad operational access, matching what the legacy `admin` user_type
  // could already do -- but never staff mutations (inviteAdmin was always
  // super_admin-only, see the original audit) and never
  // settings/security/payments configuration.
  ADMIN: new Set<Permission>([
    'dashboard.view',
    'analytics.view',
    'analytics.view_global',
    'orders.view',
    'orders.manage',
    'orders.cancel',
    'orders.refund',
    'customers.view',
    'customers.manage',
    'customers.view_pii',
    'catalog.view',
    'catalog.manage',
    'catalog.publish',
    'inventory.view',
    'inventory.manage',
    'suppliers.view',
    'suppliers.manage',
    'suppliers.import',
    'marketing.view',
    'marketing.manage',
    'campaigns.view',
    'campaigns.manage',
    'social.view',
    'social.publish',
    'social.schedule',
    'social.analytics',
    // TIKTOK-COMMERCE-1: same split PROMOTION-OPS-1 already established
    // for social.* -- operating the channel (view/products/orders/
    // fulfillment/finance/manage/analytics) is broad operational access
    // ADMIN already holds elsewhere; connecting/disconnecting the account
    // itself (channels.tiktok.connections) is grouped with this
    // codebase's other sensitive-configuration permissions
    // (social.accounts.manage, settings.*, security.*, staff.manage),
    // OWNER/SUPER_ADMIN-only.
    'channels.tiktok.view',
    'channels.tiktok.products',
    'channels.tiktok.orders',
    'channels.tiktok.fulfillment',
    'channels.tiktok.finance',
    'channels.tiktok.manage',
    'channels.tiktok.analytics',
    // SOURCING-1: no orders/finance sub-domain to split off here (unlike
    // channels.tiktok.connections) -- sourcing is catalog-adjacent
    // authoring work, so ADMIN gets the full set including .manage.
    'sourcing.view',
    'sourcing.import',
    'sourcing.manage',
    'support.view',
    'support.manage',
    'shipping.view',
    'shipping.manage',
    'staff.view',
  ]),

  // Deliberately restricted -- Part F of the phase brief. Everything here
  // is additionally filtered by applyMarketScope() at query time (see
  // MARKET_SCOPED_PERMISSIONS below). No refunds, no catalog mutation, no
  // shipping/payment configuration, no staff access -- intentionally
  // narrower than what a market manager might eventually need, expanded
  // later once the first real deployment is proven out, not guessed at
  // up front.
  // PROMOTION-OPS-1: deliberately holds none of the 6 new social.*
  // permissions -- keeps 'marketing.view' only, unchanged. A market-scoped
  // manager must never silently gain global social-publishing authority;
  // see staff-permissions.config.test.ts's matrix regression test for this
  // exact invariant.
  // TIKTOK-COMMERCE-1: same reasoning, deliberately holds none of the 8
  // new channels.tiktok.* permissions either -- expanded later once a
  // real deployment proves the workflow, not guessed at up front.
  MARKET_MANAGER: new Set<Permission>([
    'dashboard.view',
    'analytics.view_market',
    'orders.view',
    'orders.manage',
    'customers.view',
    'inventory.view',
    'suppliers.view',
    'suppliers.manage',
    'marketing.view',
    'support.view',
    'support.manage',
  ]),

  CATALOG_MANAGER: new Set<Permission>([
    'dashboard.view',
    'analytics.view',
    'catalog.view',
    'catalog.manage',
    'catalog.publish',
    'inventory.view',
    'inventory.manage',
    'suppliers.view',
    'suppliers.manage',
    'suppliers.import',
    // TIKTOK-COMMERCE-1: in-remit -- product/SKU mappings and inventory
    // diffs are catalog work, not order or finance work.
    'channels.tiktok.view',
    'channels.tiktok.products',
    // SOURCING-1: the natural owner -- importing/pricing/publishing new
    // catalog listings is squarely what CATALOG_MANAGER exists for. Full
    // set including .manage, since there's no separate orders/finance
    // sub-domain here to withhold (unlike channels.tiktok.connections).
    'sourcing.view',
    'sourcing.import',
    'sourcing.manage',
  ]),

  ORDER_MANAGER: new Set<Permission>([
    'dashboard.view',
    'analytics.view',
    'orders.view',
    'orders.manage',
    'orders.cancel',
    'orders.refund',
    'customers.view',
    'inventory.view',
    'shipping.view',
    // TIKTOK-COMMERCE-1: in-remit -- imported channel orders are order
    // work, not product/finance/connection work.
    'channels.tiktok.view',
    'channels.tiktok.orders',
  ]),

  // PROMOTION-OPS-1: campaigns.view/manage already existed but were unused
  // anywhere in code before this phase -- adopted here as their evidently-
  // intended purpose (campaign CRUD/composer/list/detail). The new
  // social.* grants split "run a campaign" (view/publish/schedule/
  // analytics) from "connect a platform account" (social.accounts.*) --
  // MARKETING_MANAGER deliberately does NOT get social.accounts.*, per the
  // explicit requirement that posting content and connecting company
  // accounts are not the same privilege. That stays OWNER/SUPER_ADMIN-only
  // this phase, expanded later once a real deployment proves the workflow
  // (same "not guessed at up front" reasoning already used for
  // MARKET_MANAGER above).
  MARKETING_MANAGER: new Set<Permission>([
    'dashboard.view',
    'analytics.view',
    'catalog.view',
    'marketing.view',
    'marketing.manage',
    'campaigns.view',
    'campaigns.manage',
    'social.view',
    'social.publish',
    'social.schedule',
    'social.analytics',
  ]),

  SUPPORT_AGENT: new Set<Permission>([
    'dashboard.view',
    'orders.view',
    'customers.view',
    'support.view',
    'support.manage',
  ]),
}

/**
 * Permissions where, if the caller's staff_membership has a non-null
 * market_scope, applyMarketScope() must additionally filter the query --
 * holding the permission is necessary but not sufficient; it only grants
 * access within the caller's scope. Global-scope memberships (market_scope
 * IS NULL) are unaffected -- see applyMarketScope() in
 * middleware/staff.ts.
 */
export const MARKET_SCOPED_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
  'orders.view',
  'orders.manage',
  'orders.cancel',
  'orders.refund',
  'customers.view',
  'suppliers.view',
  'suppliers.manage',
  'suppliers.import',
  'analytics.view_market',
  'support.view',
  'support.manage',
  // TIKTOK-COMMERCE-1: scoped by the channel account's own market_country
  // (commerce_channel_accounts.market_country), not a per-order buyer
  // country -- see RESOURCE_COUNTRY_EXPRESSIONS['channel_orders'] in
  // middleware/staff.ts.
  'channels.tiktok.orders',
])

/**
 * Relative authority, used only for staff-management rules (who can grant/
 * modify/revoke which roles) -- never consulted for ordinary permission
 * checks. Higher number = more authority.
 */
export const ROLE_AUTHORITY_RANK: Record<StaffRole, number> = {
  OWNER: 100,
  SUPER_ADMIN: 90,
  ADMIN: 70,
  MARKET_MANAGER: 50,
  CATALOG_MANAGER: 40,
  ORDER_MANAGER: 40,
  MARKETING_MANAGER: 40,
  SUPPORT_AGENT: 30,
}

export function roleHasPermission(role: StaffRole, permission: Permission): boolean {
  return STAFF_ROLE_PERMISSIONS[role]?.has(permission) ?? false
}

export function isMarketScopedPermission(permission: Permission): boolean {
  return MARKET_SCOPED_PERMISSIONS.has(permission)
}

export function isValidStaffRole(value: string): value is StaffRole {
  return (STAFF_ROLES as string[]).includes(value)
}
