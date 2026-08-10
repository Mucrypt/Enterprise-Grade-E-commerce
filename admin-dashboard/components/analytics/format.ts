// Shared formatters for Analytics 2.0 -- every number rendered anywhere in
// these tabs should go through one of these, not an ad hoc toFixed() call,
// so a null/undefined value can never reach `.toFixed()` and crash the
// page the way the Command Center's conversionRate once did (see
// docs/ADMIN-2A5-STAFF-ACCESS-INTEGRATION-REPORT.md's postmortem).

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' })
const numberFormatter = new Intl.NumberFormat('en-US')

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return currencyFormatter.format(value)
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return numberFormatter.format(value)
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${value.toFixed(decimals)}%`
}

const currencyFormatterCache = new Map<string, Intl.NumberFormat>()

/**
 * Unlike formatCurrency (hardcoded EUR, correct for every single-currency
 * response), this formats a value tagged with its own currency code -- used
 * only for currencyBreakdown rows, which are exactly the case where more
 * than one currency exists in the same response and EUR would be wrong for
 * some of the rows.
 */
export function formatCurrencyWithCode(value: number | null | undefined, currency: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  let formatter = currencyFormatterCache.get(currency)
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency })
    } catch {
      formatter = new Intl.NumberFormat('en-US', { style: 'decimal' })
    }
    currencyFormatterCache.set(currency, formatter)
  }
  return formatter.format(value)
}
