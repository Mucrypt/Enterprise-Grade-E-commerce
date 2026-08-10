import {
  parseDateRangeParams,
  safeNumber,
  safeDivide,
  safeRound,
  compareToPreviousPeriod,
  resolveStaffScope,
  sessionCountryScopeFilter,
  orderCountryScopeFilter,
} from './analytics-query.helpers'
import { StaffAuthRequest } from '../../../middleware/staff'

describe('parseDateRangeParams', () => {
  it('defaults to the last 30 days with a previous-period comparison when nothing is given', () => {
    const result = parseDateRangeParams({})
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const spanDays = (result.range.to.getTime() - result.range.from.getTime()) / 86_400_000
    expect(spanDays).toBeCloseTo(30, 0)
    expect(result.range.comparisonMode).toBe('previous_period')
    expect(result.range.compare).not.toBeNull()
  })

  it('accepts explicit from/to and computes a previous-period comparison of equal length', () => {
    const result = parseDateRangeParams({ from: '2026-01-01', to: '2026-01-08' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.range.compare?.to.toISOString().slice(0, 10)).toBe('2026-01-01')
    const compareSpanDays =
      (result.range.compare!.to.getTime() - result.range.compare!.from.getTime()) / 86_400_000
    const spanDays = (result.range.to.getTime() - result.range.from.getTime()) / 86_400_000
    expect(compareSpanDays).toBeCloseTo(spanDays, 5)
  })

  it('honors comparisonMode=none by returning no compare range', () => {
    const result = parseDateRangeParams({ comparisonMode: 'none' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.range.compare).toBeNull()
  })

  it('honors comparisonMode=previous_year', () => {
    const result = parseDateRangeParams({ from: '2026-03-01', to: '2026-03-31', comparisonMode: 'previous_year' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.range.compare?.from.getFullYear()).toBe(2025)
    expect(result.range.compare?.to.getFullYear()).toBe(2025)
  })

  it('honors an explicit compareFrom/compareTo override regardless of comparisonMode', () => {
    const result = parseDateRangeParams({
      from: '2026-03-01',
      to: '2026-03-31',
      compareFrom: '2020-01-01',
      compareTo: '2020-01-31',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.range.compare?.from.toISOString().slice(0, 10)).toBe('2020-01-01')
  })

  it('rejects an invalid "from" date', () => {
    const result = parseDateRangeParams({ from: 'not-a-date' })
    expect(result.ok).toBe(false)
  })

  it('rejects "from" after "to"', () => {
    const result = parseDateRangeParams({ from: '2026-06-01', to: '2026-01-01' })
    expect(result.ok).toBe(false)
  })

  it('rejects an invalid comparisonMode', () => {
    const result = parseDateRangeParams({ comparisonMode: 'yesterday' })
    expect(result.ok).toBe(false)
  })

  // Production Review Round 1 §6 -- the admin dashboard's "Today"/
  // "Yesterday" presets send identical date-only from/to strings (see
  // useAnalyticsFilters.ts's isoDate()). Every endpoint queries with an
  // exclusive upper bound (`created_at < to`), so from===to used to mean
  // "zero rows, always," regardless of real data -- a single-day preset
  // could never show anything.
  it('a single-day range ("Today", from===to as date-only strings) spans the whole day, not zero width', () => {
    const result = parseDateRangeParams({ from: '2026-08-10', to: '2026-08-10', comparisonMode: 'none' })
    expect(result.ok).toBe(true)
    if (!result.ok || !result.range) return
    expect(result.range.from.toISOString()).toBe('2026-08-10T00:00:00.000Z')
    expect(result.range.to.toISOString()).toBe('2026-08-11T00:00:00.000Z')
    expect(result.range.to.getTime()).toBeGreaterThan(result.range.from.getTime())
  })

  it('a date-only "to" in a multi-day range includes that whole day, not excludes it', () => {
    const result = parseDateRangeParams({ from: '2026-01-01', to: '2026-01-08', comparisonMode: 'none' })
    expect(result.ok).toBe(true)
    if (!result.ok || !result.range) return
    // Jan 8 00:00Z (bumped to Jan 9 00:00Z) so `created_at < to` still
    // captures every moment of Jan 8th, not just up to its first instant.
    expect(result.range.to.toISOString()).toBe('2026-01-09T00:00:00.000Z')
  })

  it('leaves a full datetime "to" (has a time component) untouched -- only bare YYYY-MM-DD gets the end-of-day bump', () => {
    const result = parseDateRangeParams({ from: '2026-01-01', to: '2026-01-08T15:30:00.000Z', comparisonMode: 'none' })
    expect(result.ok).toBe(true)
    if (!result.ok || !result.range) return
    expect(result.range.to.toISOString()).toBe('2026-01-08T15:30:00.000Z')
  })

  it('applies the same date-only end-of-day fix to an explicit compareTo', () => {
    const result = parseDateRangeParams({
      from: '2026-03-01',
      to: '2026-03-31',
      compareFrom: '2020-01-01',
      compareTo: '2020-01-01',
    })
    expect(result.ok).toBe(true)
    if (!result.ok || !result.range) return
    expect(result.range.compare!.to.toISOString()).toBe('2020-01-02T00:00:00.000Z')
    expect(result.range.compare!.to.getTime()).toBeGreaterThan(result.range.compare!.from.getTime())
  })

  it('computes previous_year using UTC calendar fields, immune to the server process\'s local TZ', () => {
    const result = parseDateRangeParams({ from: '2026-03-01', to: '2026-03-31', comparisonMode: 'previous_year' })
    expect(result.ok).toBe(true)
    if (!result.ok || !result.range) return
    expect(result.range.compare!.from.toISOString()).toBe('2025-03-01T00:00:00.000Z')
    // to was bumped to 2026-04-01T00:00Z by the date-only end-of-day fix
    // before the previous_year shift, so the previous-year range mirrors
    // the same (correct, inclusive) span, not the original unbumped date.
    expect(result.range.compare!.to.toISOString()).toBe('2025-04-01T00:00:00.000Z')
  })
})

describe('safeNumber / safeDivide / safeRound -- never NaN/Infinity', () => {
  it('safeNumber coerces null/undefined to 0, never NaN', () => {
    expect(safeNumber(null)).toBe(0)
    expect(safeNumber(undefined)).toBe(0)
    expect(safeNumber('not-a-number')).toBe(0)
    expect(safeNumber('42')).toBe(42) // pg bigint strings
    expect(Number.isNaN(safeNumber(undefined))).toBe(false)
  })

  it('safeDivide returns 0 on a zero denominator instead of Infinity/NaN', () => {
    expect(safeDivide(10, 0)).toBe(0)
    expect(safeDivide(0, 0)).toBe(0)
    expect(safeDivide(null, null)).toBe(0)
    expect(safeDivide(10, 2)).toBe(5)
  })

  it('safeRound is always finite', () => {
    expect(safeRound(null)).toBe(0)
    expect(Number.isFinite(safeRound(undefined))).toBe(true)
    expect(safeRound(3.14159, 2)).toBe(3.14)
  })
})

describe('compareToPreviousPeriod', () => {
  it('computes value/absoluteChange/percentChange for a normal comparison', () => {
    const result = compareToPreviousPeriod(18250, 16240)
    expect(result.value).toBe(18250)
    expect(result.previousValue).toBe(16240)
    expect(result.absoluteChange).toBe(2010)
    expect(result.percentChange).toBeCloseTo(12.38, 1)
  })

  it('returns null previousValue/changes when there is no comparison period at all', () => {
    const result = compareToPreviousPeriod(500, null)
    expect(result.value).toBe(500)
    expect(result.previousValue).toBeNull()
    expect(result.absoluteChange).toBeNull()
    expect(result.percentChange).toBeNull()
  })

  it('never returns Infinity when the previous value was legitimately zero', () => {
    const result = compareToPreviousPeriod(100, 0)
    expect(result.previousValue).toBe(0)
    expect(result.absoluteChange).toBe(100)
    expect(result.percentChange).toBeNull()
    expect(Number.isFinite(result.absoluteChange!)).toBe(true)
  })

  it('handles both current and previous being zero (no crash, no NaN)', () => {
    const result = compareToPreviousPeriod(0, 0)
    expect(result.value).toBe(0)
    expect(result.absoluteChange).toBe(0)
    expect(result.percentChange).toBeNull()
  })

  it('tolerates a null current value (e.g. a metric with no rows this period)', () => {
    const result = compareToPreviousPeriod(null, 50)
    expect(result.value).toBe(0)
    expect(result.absoluteChange).toBe(-50)
  })
})

describe('resolveStaffScope', () => {
  it('is global when there is no staff context at all (legacy admin path)', () => {
    const req = {} as StaffAuthRequest
    expect(resolveStaffScope(req)).toEqual({ isGlobal: true, countries: [] })
  })

  it('is global if ANY active membership has a null market_scope', () => {
    const req = {
      staff: {
        memberships: [
          { id: 'm1', role: 'MARKET_MANAGER', marketScope: ['CM'] },
          { id: 'm2', role: 'OWNER', marketScope: null },
        ],
        permissions: new Set(),
      },
    } as any as StaffAuthRequest
    expect(resolveStaffScope(req).isGlobal).toBe(true)
  })

  it('is scoped to the union of countries, uppercased, when every membership is scoped', () => {
    const req = {
      staff: {
        memberships: [
          { id: 'm1', role: 'MARKET_MANAGER', marketScope: ['cm'] },
          { id: 'm2', role: 'ORDER_MANAGER', marketScope: ['gh', 'NG'] },
        ],
        permissions: new Set(),
      },
    } as any as StaffAuthRequest
    const scope = resolveStaffScope(req)
    expect(scope.isGlobal).toBe(false)
    expect(scope.countries.sort()).toEqual(['CM', 'GH', 'NG'])
  })

  it('fails closed to an empty country list when market_scope is explicitly empty', () => {
    const req = {
      staff: {
        memberships: [{ id: 'm1', role: 'MARKET_MANAGER', marketScope: [] }],
        permissions: new Set(),
      },
    } as any as StaffAuthRequest
    expect(resolveStaffScope(req)).toEqual({ isGlobal: false, countries: [] })
  })
})

describe('sessionCountryScopeFilter', () => {
  it('returns no restriction for a global scope', () => {
    const filter = sessionCountryScopeFilter({ isGlobal: true, countries: [] }, 1)
    expect(filter.clause).toBe('')
    expect(filter.params).toEqual([])
  })

  it('filters on the raw uppercased ISO codes with no expansion (user_sessions.country_code is a trustworthy CHAR(2))', () => {
    const filter = sessionCountryScopeFilter({ isGlobal: false, countries: ['CM'] }, 2)
    expect(filter.clause).toBe('AND country_code = ANY($2)')
    expect(filter.params).toEqual([['CM']])
  })

  it('fails closed on an empty scoped country list', () => {
    const filter = sessionCountryScopeFilter({ isGlobal: false, countries: [] }, 1)
    expect(filter.clause).toBe('AND 1 = 0')
  })

  it('supports an aliased column expression', () => {
    const filter = sessionCountryScopeFilter({ isGlobal: false, countries: ['CM'] }, 3, 's.country_code')
    expect(filter.clause).toBe('AND s.country_code = ANY($3)')
  })
})

describe('orderCountryScopeFilter', () => {
  it('returns no restriction for a global scope', () => {
    const filter = orderCountryScopeFilter({ isGlobal: true, countries: [] }, 1, "o.shipping_address->>'country'")
    expect(filter.clause).toBe('')
  })

  it('wraps in LOWER() and expands ISO code + full name (format-agnostic, matches applyMarketScope)', () => {
    const filter = orderCountryScopeFilter({ isGlobal: false, countries: ['CM'] }, 1, "o.shipping_address->>'country'")
    expect(filter.clause).toBe(`AND LOWER(o.shipping_address->>'country') = ANY($1)`)
    expect(filter.params[0]).toEqual(expect.arrayContaining(['cm', 'cameroon']))
  })

  it('fails closed on an empty scoped country list', () => {
    const filter = orderCountryScopeFilter({ isGlobal: false, countries: [] }, 1, "o.shipping_address->>'country'")
    expect(filter.clause).toBe('AND 1 = 0')
  })
})
