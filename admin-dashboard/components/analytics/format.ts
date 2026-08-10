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
