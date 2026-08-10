import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import type { DatePreset } from './useAnalyticsFilters'

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'custom', label: 'Custom' },
]

interface DateRangePickerProps {
  preset: DatePreset
  from: string
  to: string
  onPresetChange: (preset: DatePreset) => void
  onCustomRangeChange: (from: string, to: string) => void
}

export function DateRangePicker({ preset, from, to, onPresetChange, onCustomRangeChange }: DateRangePickerProps) {
  return (
    <div className='flex items-center gap-2'>
      <Select value={preset} onValueChange={(v: string) => onPresetChange(v as DatePreset)}>
        <SelectTrigger className='w-40' aria-label='Date range preset'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRESETS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {preset === 'custom' && (
        <div className='flex items-center gap-1'>
          <Input
            type='date'
            value={from}
            onChange={(e) => onCustomRangeChange(e.target.value, to)}
            className='w-36'
            aria-label='From date'
          />
          <span className='text-muted-foreground text-sm'>to</span>
          <Input
            type='date'
            value={to}
            onChange={(e) => onCustomRangeChange(from, e.target.value)}
            className='w-36'
            aria-label='To date'
          />
        </div>
      )}
    </div>
  )
}
