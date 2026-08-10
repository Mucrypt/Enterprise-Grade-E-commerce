import { ReactNode } from 'react'
import { DateRangePicker } from './DateRangePicker'
import { ComparisonSelector } from './ComparisonSelector'
import { CountryFilter, SourceFilter, CampaignFilter, DeviceFilter } from './filters'
import type { UseAnalyticsFiltersReturn } from './useAnalyticsFilters'

export type FilterKey = 'comparison' | 'source' | 'campaign' | 'device'

interface AnalyticsFilterBarProps {
  filters: UseAnalyticsFiltersReturn
  visible: FilterKey[]
  /** Slot for a tab-specific control (e.g. ExportButton, a sort dropdown) rendered at the end of the bar. */
  trailing?: ReactNode
}

/**
 * The one filter bar every tab renders, showing only the controls
 * relevant to that tab's endpoint (via `visible`) -- date range and
 * country are shared everywhere; comparison/source/campaign/device only
 * where the backing endpoint actually accepts them (see each endpoint's
 * query-param list in analytics-v2.service.ts).
 */
export function AnalyticsFilterBar({ filters, visible, trailing }: AnalyticsFilterBarProps) {
  const { state, setPreset, setCustomRange, setField } = filters

  return (
    <div className='flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3'>
      <DateRangePicker
        preset={state.preset}
        from={state.from}
        to={state.to}
        onPresetChange={setPreset}
        onCustomRangeChange={setCustomRange}
      />
      {visible.includes('comparison') && (
        <ComparisonSelector value={state.comparisonMode} onChange={(v) => setField('comparisonMode', v)} />
      )}
      <CountryFilter value={state.country} onChange={(v) => setField('country', v)} />
      {visible.includes('source') && (
        <SourceFilter value={state.source} onChange={(v) => setField('source', v)} />
      )}
      {visible.includes('campaign') && (
        <CampaignFilter value={state.campaign} onChange={(v) => setField('campaign', v)} />
      )}
      {visible.includes('device') && (
        <DeviceFilter value={state.device} onChange={(v) => setField('device', v)} />
      )}
      <div className='ml-auto flex items-center gap-2'>{trailing}</div>
    </div>
  )
}
