import { useMemo, useState } from 'react'
import type { AnalyticsDateFilters, ComparisonMode } from '@/services/analytics-v2.service'

export type DatePreset = 'today' | 'yesterday' | '7d' | '30d' | '90d' | 'custom'

export interface AnalyticsFilterState {
  preset: DatePreset
  from: string
  to: string
  comparisonMode: ComparisonMode
  country: string
  source: string
  campaign: string
  device: string
  productId: string
  categoryId: string
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function rangeForPreset(preset: DatePreset): { from: string; to: string } {
  const now = new Date()
  const today = isoDate(now)
  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case 'yesterday': {
      const y = new Date(now)
      y.setDate(y.getDate() - 1)
      return { from: isoDate(y), to: isoDate(y) }
    }
    case '7d': {
      const from = new Date(now)
      from.setDate(from.getDate() - 7)
      return { from: isoDate(from), to: today }
    }
    case '90d': {
      const from = new Date(now)
      from.setDate(from.getDate() - 90)
      return { from: isoDate(from), to: today }
    }
    case '30d':
    default: {
      const from = new Date(now)
      from.setDate(from.getDate() - 30)
      return { from: isoDate(from), to: today }
    }
  }
}

/**
 * Single source of truth for every filter every Analytics 2.0 tab reads
 * from -- kept as plain component state (not URL-persisted) for this
 * phase; see docs/ADMIN-2B-ANALYTICS-2-IMPLEMENTATION-REPORT.md's
 * "remaining gaps" section for why URL persistence was deferred rather
 * than half-built.
 */
export function useAnalyticsFilters() {
  const initial = rangeForPreset('30d')
  const [state, setState] = useState<AnalyticsFilterState>({
    preset: '30d',
    from: initial.from,
    to: initial.to,
    comparisonMode: 'previous_period',
    country: '',
    source: '',
    campaign: '',
    device: '',
    productId: '',
    categoryId: '',
  })

  const setPreset = (preset: DatePreset) => {
    if (preset === 'custom') {
      setState((prev) => ({ ...prev, preset }))
      return
    }
    const { from, to } = rangeForPreset(preset)
    setState((prev) => ({ ...prev, preset, from, to }))
  }

  const setCustomRange = (from: string, to: string) => {
    setState((prev) => ({ ...prev, preset: 'custom', from, to }))
  }

  const setField = <K extends keyof AnalyticsFilterState>(key: K, value: AnalyticsFilterState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }))
  }

  /** The subset every endpoint accepts -- from/to/comparisonMode/country. */
  const dateFilters: AnalyticsDateFilters = useMemo(
    () => ({
      from: state.from,
      to: state.to,
      comparisonMode: state.comparisonMode,
      ...(state.country ? { country: state.country } : {}),
    }),
    [state.from, state.to, state.comparisonMode, state.country],
  )

  return { state, setPreset, setCustomRange, setField, dateFilters }
}

export type UseAnalyticsFiltersReturn = ReturnType<typeof useAnalyticsFilters>
