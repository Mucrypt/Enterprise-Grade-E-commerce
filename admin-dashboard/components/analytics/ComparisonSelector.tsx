import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ComparisonMode } from '@/services/analytics-v2.service'

interface ComparisonSelectorProps {
  value: ComparisonMode
  onChange: (mode: ComparisonMode) => void
}

export function ComparisonSelector({ value, onChange }: ComparisonSelectorProps) {
  return (
    <Select value={value} onValueChange={(v: string) => onChange(v as ComparisonMode)}>
      <SelectTrigger className='w-48' aria-label='Compare to'>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value='previous_period'>vs. Previous period</SelectItem>
        <SelectItem value='previous_year'>vs. Same period last year</SelectItem>
        <SelectItem value='none'>No comparison</SelectItem>
      </SelectContent>
    </Select>
  )
}
