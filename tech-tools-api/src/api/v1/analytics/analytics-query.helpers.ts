/**
 * Shared helpers for the Analytics 2.0 (ADMIN-2B) endpoints -- date-range
 * parsing, period-comparison math, and market-scope resolution. Pulled out
 * of the controller so every endpoint (overview/sales/funnel/products/
 * search-demand/acquisition/operations/country-performance) uses the exact
 * same rules rather than seven slightly-different reimplementations.
 *
 * Every numeric helper here is written to the explicit ADMIN-2B
 * requirement: "Every metric transformation must tolerate zero
 * denominator, null, empty data, missing comparison period" -- never
 * NaN/Infinity/undefined, never a null.toFixed() crash. See
 * analytics-query.helpers.test.ts for the exact scenarios this is tested
 * against.
 */
import { Response } from 'express'
import { StaffAuthRequest } from '../../../middleware/staff'
import { expandCountryScopeForMatching } from '../../../config/country-reference.config'

// ============================================================
// Date range + comparison period
// ============================================================

export interface DateRange {
  from: Date
  to: Date
}

export interface ResolvedDateRange extends DateRange {
  compare: DateRange | null
  /** Echoed back in responses so the frontend can label "vs previous 30 days" / "vs same period last year" accurately. */
  comparisonMode: 'previous_period' | 'previous_year' | 'none'
}

/**
 * Deliberately NOT a discriminated union ({ok:true,range}|{ok:false,error})
 * -- this codebase runs with strict/strictNullChecks off (see
 * tsconfig.json), under which TypeScript does not reliably narrow a union
 * on a boolean-literal discriminant (`if (!parsed.ok) parsed.error` fails
 * to type-check even though it's correct at runtime). A flat shape with
 * optional fields sidesteps that entirely at the cost of `range`/`error`
 * both being optional on the type -- callers check `ok` and know which one
 * is populated, same as before.
 */
export interface DateRangeParseResult {
  ok: boolean
  range?: ResolvedDateRange
  error?: string
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

function parseDateParam(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * A bare "YYYY-MM-DD" `to`/`compareTo` value -- every admin-dashboard date
 * preset sends exactly this, including "Today" and "Yesterday" (see
 * useAnalyticsFilters.ts's `isoDate()`) -- parses via `new Date(...)` to
 * UTC MIDNIGHT, the *start* of that day. Every endpoint queries with an
 * exclusive upper bound (`created_at < to`), so used as-is that would
 * silently exclude the entire day; for "Today"/"Yesterday" specifically,
 * where `from` and `to` are the identical date-only string, `from === to`
 * exactly and the query becomes `>= X AND < X` -- always zero rows,
 * regardless of real data. Advancing a date-only `to` by one day makes it
 * mean "through the end of that UTC day," matching what a human types
 * "to: Aug 10" to mean, and fixes the single-day presets outright. A full
 * datetime string (has a time component) is trusted as an exact instant
 * and left untouched.
 */
function endOfDayIfDateOnly(raw: unknown, date: Date): Date {
  if (typeof raw === 'string' && DATE_ONLY_RE.test(raw)) {
    return new Date(date.getTime() + MS_PER_DAY)
  }
  return date
}

/**
 * Reads `from`/`to`/`comparisonMode`/`compareFrom`/`compareTo` off an
 * Express query object. Defaults to the last 30 days (matching this
 * codebase's existing analytics endpoints' `days` default) with a
 * "previous period of equal length" comparison unless told otherwise.
 * Returns a typed error (never throws) so the controller can 400 on bad
 * input instead of running a query with garbage dates.
 */
export function parseDateRangeParams(query: Record<string, unknown>): DateRangeParseResult {
  const now = new Date()
  const explicitFrom = parseDateParam(query.from)
  const explicitTo = parseDateParam(query.to)

  if (query.from && !explicitFrom) return { ok: false, error: 'Invalid "from" date' }
  if (query.to && !explicitTo) return { ok: false, error: 'Invalid "to" date' }

  const to = explicitTo ? endOfDayIfDateOnly(query.to, explicitTo) : now
  const from = explicitFrom || new Date(to.getTime() - 30 * MS_PER_DAY)

  if (from.getTime() > to.getTime()) {
    return { ok: false, error: '"from" must be before "to"' }
  }

  const comparisonModeRaw = typeof query.comparisonMode === 'string' ? query.comparisonMode : 'previous_period'
  if (!['previous_period', 'previous_year', 'none'].includes(comparisonModeRaw)) {
    return { ok: false, error: 'Invalid "comparisonMode" -- expected previous_period, previous_year, or none' }
  }
  const comparisonMode = comparisonModeRaw as ResolvedDateRange['comparisonMode']

  const explicitCompareFrom = parseDateParam(query.compareFrom)
  const explicitCompareTo = parseDateParam(query.compareTo)
  if (query.compareFrom && !explicitCompareFrom) return { ok: false, error: 'Invalid "compareFrom" date' }
  if (query.compareTo && !explicitCompareTo) return { ok: false, error: 'Invalid "compareTo" date' }

  let compare: DateRange | null = null
  if (explicitCompareFrom && explicitCompareTo) {
    compare = { from: explicitCompareFrom, to: endOfDayIfDateOnly(query.compareTo, explicitCompareTo) }
  } else if (comparisonMode === 'previous_period') {
    const durationMs = to.getTime() - from.getTime()
    compare = { from: new Date(from.getTime() - durationMs), to: new Date(from.getTime()) }
  } else if (comparisonMode === 'previous_year') {
    // UTC getters, not local (getFullYear/getMonth/...) -- from/to are
    // already UTC instants (see parseDateParam/endOfDayIfDateOnly above),
    // and this codebase's whole date-range model is documented as UTC
    // (Production Review Round 1 §6). Local getters would silently shift
    // this range by the server process's own TZ offset whenever that
    // isn't UTC, with nothing in the code to catch it.
    compare = {
      from: new Date(
        Date.UTC(from.getUTCFullYear() - 1, from.getUTCMonth(), from.getUTCDate(), from.getUTCHours(), from.getUTCMinutes(), from.getUTCSeconds()),
      ),
      to: new Date(
        Date.UTC(to.getUTCFullYear() - 1, to.getUTCMonth(), to.getUTCDate(), to.getUTCHours(), to.getUTCMinutes(), to.getUTCSeconds()),
      ),
    }
  }

  return { ok: true, range: { from, to, compare, comparisonMode } }
}

/**
 * Sends the standard 400 response for a parse failure -- shared so every
 * endpoint's error shape matches. Takes the message directly rather than
 * the narrowed `{ok:false}` branch of DateRangeParseResult -- this
 * codebase runs with strictNullChecks/strict off (see tsconfig.json),
 * under which discriminated-union narrowing on `if (!parsed.ok)` doesn't
 * reliably propagate into a separately-called function's parameter type.
 */
export function sendDateRangeError(res: Response, error: string) {
  res.status(400).json({ success: false, error })
}

// ============================================================
// Safe numeric transforms -- the "never NaN/Infinity/null.toFixed" layer
// ============================================================

/** Coerces a pg result value (often a bigint/numeric string, or null) to a finite number, never NaN. */
export function safeNumber(value: unknown): number {
  if (value === null || value === undefined) return 0
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

/** Division that can never produce NaN/Infinity -- 0 on a zero/invalid denominator, matching every "conversion rate" style metric in this codebase. */
export function safeDivide(numerator: unknown, denominator: unknown): number {
  const num = safeNumber(numerator)
  const den = safeNumber(denominator)
  if (den === 0) return 0
  return num / den
}

/** Rounds to `decimals` places, still guaranteed finite. */
export function safeRound(value: unknown, decimals = 2): number {
  const num = safeNumber(value)
  const factor = 10 ** decimals
  return Math.round(num * factor) / factor
}

export interface PeriodComparison {
  value: number
  previousValue: number | null
  absoluteChange: number | null
  percentChange: number | null
}

/**
 * Builds the {value, absoluteChange, percentChange} shape used by every
 * Overview/Sales metric. `previous` is `null` when there was no comparison
 * period at all (comparisonMode='none') -- distinct from a previous value
 * that legitimately computed to 0, which still yields a real
 * absoluteChange (just not a meaningful percentChange, since dividing by
 * zero would be Infinity -- returned as `null`, never `Infinity`).
 */
export function compareToPreviousPeriod(current: unknown, previous: unknown | null): PeriodComparison {
  const value = safeNumber(current)
  if (previous === null || previous === undefined) {
    return { value, previousValue: null, absoluteChange: null, percentChange: null }
  }
  const previousValue = safeNumber(previous)
  const absoluteChange = safeRound(value - previousValue)
  const percentChange = previousValue === 0 ? null : safeRound(((value - previousValue) / previousValue) * 100)
  return { value, previousValue, absoluteChange, percentChange }
}

// ============================================================
// Market-scope resolution (for user_sessions / events_core-derived
// queries, which have no direct row for applyMarketScope() to filter --
// that helper only covers 'orders' | 'suppliers'. Mirrors the exact
// inline logic getMarketOverview() already uses for its visitors query,
// pulled out here so every new endpoint shares it instead of
// reimplementing it seven times.)
// ============================================================

export interface StaffScope {
  /** True if the caller should see unfiltered data -- no staff context at all, or any ACTIVE membership with market_scope IS NULL. */
  isGlobal: boolean
  /** ISO alpha-2 codes (uppercased), only meaningful when isGlobal is false. An empty array means "scoped to nothing" -- fails closed, not open. */
  countries: string[]
}

export function resolveStaffScope(req: StaffAuthRequest): StaffScope {
  const staff = req.staff
  if (!staff || staff.memberships.length === 0) {
    return { isGlobal: true, countries: [] }
  }
  const hasGlobalMembership = staff.memberships.some((m) => m.marketScope === null)
  if (hasGlobalMembership) {
    return { isGlobal: true, countries: [] }
  }
  const countries = Array.from(
    new Set(staff.memberships.flatMap((m) => m.marketScope || [])),
  ).map((c) => c.toUpperCase())
  return { isGlobal: false, countries }
}

export interface ScopeSqlFilter {
  /** SQL fragment to AND onto an existing WHERE, empty string when unrestricted. */
  clause: string
  params: unknown[]
}

/**
 * Scope filter for a `user_sessions.country_code`-shaped column (CHAR(2),
 * always an ISO code -- see docs/ADMIN-2A5-STAFF-ACCESS-INTEGRATION-REPORT.md
 * §3 on why this does NOT need the ISO/full-name expansion bridge that
 * orders.shipping_address does).
 */
export function sessionCountryScopeFilter(
  scope: StaffScope,
  nextParamIndex: number,
  columnExpression = 'country_code',
): ScopeSqlFilter {
  if (scope.isGlobal) return { clause: '', params: [] }
  if (scope.countries.length === 0) return { clause: 'AND 1 = 0', params: [] }
  return {
    clause: `AND ${columnExpression} = ANY($${nextParamIndex})`,
    params: [scope.countries],
  }
}

/**
 * Scope filter for an `orders.shipping_address->>'country'`-shaped
 * expression -- customer-entered, format not confirmed, so (like
 * applyMarketScope() in middleware/staff.ts) matches against both the ISO
 * code and its known full name.
 */
export function orderCountryScopeFilter(
  scope: StaffScope,
  nextParamIndex: number,
  columnExpression: string,
): ScopeSqlFilter {
  if (scope.isGlobal) return { clause: '', params: [] }
  if (scope.countries.length === 0) return { clause: 'AND 1 = 0', params: [] }
  return {
    clause: `AND LOWER(${columnExpression}) = ANY($${nextParamIndex})`,
    params: [expandCountryScopeForMatching(scope.countries)],
  }
}
