/**
 * Market-scope enforcement for promotion_campaigns -- Production Review
 * Round 1 §8/§9. Reuses resolveStaffScope() from Analytics 2.0's helpers
 * (the exact same NULL-vs-empty-array-vs-populated staff-scope resolution
 * every other scoped surface in this codebase already uses) rather than
 * reimplementing it a third time.
 *
 * A campaign's own market_scope column follows the identical convention:
 * NULL = global, [] = scoped to nothing (fails closed), a populated array
 * = ISO country codes. Visibility/mutation rule for a SCOPED caller:
 * never a global (NULL) campaign, and only a campaign whose market_scope
 * overlaps the caller's own countries -- array-overlap, matching the
 * existing orderCountryScopeFilter/applyMarketScope convention elsewhere
 * (row-is-in-my-list), not strict subset containment.
 */
import { StaffScope } from '../analytics/analytics-query.helpers'

export interface CampaignScopeFilter {
  clause: string
  params: unknown[]
}

/**
 * SQL filter for a campaign-list query. Global caller: no restriction.
 * Scoped caller: only campaigns with a non-null market_scope that
 * overlaps their own countries -- global (NULL) campaigns are invisible,
 * per the explicit "must NOT list global campaigns" requirement.
 */
export function campaignScopeFilter(
  scope: StaffScope,
  nextParamIndex: number,
  columnExpression = 'pc.market_scope',
): CampaignScopeFilter {
  if (scope.isGlobal) return { clause: '', params: [] }
  if (scope.countries.length === 0) return { clause: 'AND 1 = 0', params: [] }
  return {
    clause: `AND ${columnExpression} IS NOT NULL AND ${columnExpression} && $${nextParamIndex}`,
    params: [scope.countries],
  }
}

/**
 * IDOR guard for a direct-by-ID campaign route -- a scoped caller must
 * not reach a campaign outside their market just by knowing its UUID,
 * even though the list endpoint already filters it out. Same fail-closed
 * semantics as campaignScopeFilter(). Global staff (no req.staff, or any
 * ACTIVE global membership) always returns true, matching
 * isCountryInScope()'s existing behavior for orders/suppliers.
 */
export function isCampaignInScope(scope: StaffScope, campaignMarketScope: string[] | null | undefined): boolean {
  if (scope.isGlobal) return true
  if (scope.countries.length === 0) return false
  if (!campaignMarketScope || campaignMarketScope.length === 0) return false
  const scopedSet = new Set(scope.countries.map((c) => c.toUpperCase()))
  return campaignMarketScope.some((c) => scopedSet.has(c.toUpperCase()))
}

/**
 * Validates a market_scope value a caller wants to CREATE a campaign
 * with, against their own StaffScope -- Production Review Round 1 §9.
 * Global callers may create global (NULL) or any explicitly-scoped
 * campaign. Scoped callers may only create a campaign scoped to a
 * non-empty subset of their own countries -- never NULL (would be an
 * unauthorized global campaign), never an empty array (policy: invalid,
 * not a silent fail-closed-to-nothing campaign), never a country outside
 * their own scope.
 */
export function validateCampaignScopeForCreation(
  scope: StaffScope,
  requestedMarketScope: string[] | null | undefined,
): { valid: boolean; error?: string } {
  if (scope.isGlobal) return { valid: true }

  if (requestedMarketScope === null || requestedMarketScope === undefined) {
    return { valid: false, error: 'A market-scoped staff member cannot create a global campaign.' }
  }
  if (requestedMarketScope.length === 0) {
    return { valid: false, error: 'market_scope cannot be an empty array -- omit it to use your own market scope, or specify explicit countries within it.' }
  }
  const allowed = new Set(scope.countries.map((c) => c.toUpperCase()))
  const outOfScope = requestedMarketScope.filter((c) => !allowed.has(c.toUpperCase()))
  if (outOfScope.length > 0) {
    return { valid: false, error: `Cannot create a campaign scoped to ${outOfScope.join(', ')} -- outside your own market scope.` }
  }
  return { valid: true }
}
