import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// Structurally identical small text-filter controls -- kept in one file
// with individually named/documented exports (CountryFilter, SourceFilter,
// CampaignFilter, ProductFilter) rather than four near-duplicate files,
// per this codebase's "three similar lines is better than a premature
// abstraction" convention -- these are genuinely the same shape, so one
// shared render path is the honest amount of abstraction, not less.

interface TextFilterProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

/**
 * ISO alpha-2 country code, free text rather than a full searchable
 * country-name dropdown -- for a MARKET_MANAGER this can only ever narrow
 * within their own already-granted market_scope (see
 * applyCountryFilterOverride in analytics-v2.controller.ts); for a global
 * viewer it's a quick drill-down, not the primary navigation method
 * (Country Performance's own table is that).
 */
export function CountryFilter({ value, onChange, placeholder = 'Country (e.g. CM)' }: TextFilterProps) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value.toUpperCase().slice(0, 2))}
      placeholder={placeholder}
      className='w-40'
      aria-label='Filter by country'
    />
  )
}

export function SourceFilter({ value, onChange, placeholder = 'Source (e.g. google)' }: TextFilterProps) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className='w-40'
      aria-label='Filter by traffic source'
    />
  )
}

export function CampaignFilter({ value, onChange, placeholder = 'Campaign' }: TextFilterProps) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className='w-40'
      aria-label='Filter by campaign'
    />
  )
}

/** Bound to a product UUID -- normally set by clicking a row in the Products tab (see ProductIntelligenceTab), not typed by hand. */
export function ProductFilter({ value, onChange, placeholder = 'Product ID' }: TextFilterProps) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className='w-44'
      aria-label='Filter by product'
    />
  )
}

interface DeviceFilterProps {
  value: string
  onChange: (value: string) => void
}

export function DeviceFilter({ value, onChange }: DeviceFilterProps) {
  return (
    <Select value={value || 'all'} onValueChange={(v: string) => onChange(v === 'all' ? '' : v)}>
      <SelectTrigger className='w-36' aria-label='Filter by device'>
        <SelectValue placeholder='All devices' />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value='all'>All devices</SelectItem>
        <SelectItem value='desktop'>Desktop</SelectItem>
        <SelectItem value='mobile'>Mobile</SelectItem>
        <SelectItem value='tablet'>Tablet</SelectItem>
      </SelectContent>
    </Select>
  )
}
