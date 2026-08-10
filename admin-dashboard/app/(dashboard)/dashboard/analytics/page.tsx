'use client'

/**
 * Analytics 2.0 (ADMIN-2B) -- the world-class analytics workspace this
 * page was transformed into, per docs/ADMIN-2B-ANALYTICS-2-IMPLEMENTATION-REPORT.md.
 *
 * This REPLACES the previous single-page global-only analytics UI that
 * lived here, but does NOT replace the analytics engine underneath it:
 * every pre-existing endpoint in analytics.controller.ts (revenue-trend,
 * conversion-funnel, top-products, visitors/*, channels, market-overview)
 * is untouched and still runs -- Real Time (below) still consumes some of
 * them directly. The new tabs are powered by the additive
 * analytics-v2.controller.ts endpoints (analytics-v2.service.ts).
 *
 * Permission gate changed from the ADMIN-2A.5-era `analytics.view` only
 * to `analytics.view` OR `analytics.view_market` -- ADMIN-2A.5 kept
 * MARKET_MANAGER off this page because it had no real scoped data to show
 * them (their numbers lived only in the Command Center's Market Overview
 * panel). ADMIN-2B's endpoints now resolve scope per-request
 * (resolveStaffScope), so a MARKET_MANAGER reaching this page gets
 * genuinely scoped data throughout, not a redirect.
 */

import { useState } from 'react'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import { AnalyticsShell } from '@/components/analytics/AnalyticsShell'
import { AnalyticsTabs, AnalyticsTabDef } from '@/components/analytics/AnalyticsTabs'
import { useAnalyticsFilters } from '@/components/analytics/useAnalyticsFilters'
import { OverviewTab } from '@/components/analytics/tabs/OverviewTab'
import { RealTimeTab } from '@/components/analytics/tabs/RealTimeTab'
import { SalesTab } from '@/components/analytics/tabs/SalesTab'
import { FunnelTab } from '@/components/analytics/tabs/FunnelTab'
import { ProductsTab } from '@/components/analytics/tabs/ProductsTab'
import { AcquisitionTab } from '@/components/analytics/tabs/AcquisitionTab'
import { SearchDemandTab } from '@/components/analytics/tabs/SearchDemandTab'
import { OperationsTab } from '@/components/analytics/tabs/OperationsTab'
import { CountryPerformanceTab } from '@/components/analytics/tabs/CountryPerformanceTab'

export default function AnalyticsPage() {
  return (
    <RequirePagePermission permission={['analytics.view', 'analytics.view_market']} mode='any'>
      <AnalyticsWorkspace />
    </RequirePagePermission>
  )
}

function AnalyticsWorkspace() {
  const [activeTab, setActiveTab] = useState('overview')
  const [scope, setScope] = useState<{ scoped: boolean; markets: string[] } | null>(null)
  const filters = useAnalyticsFilters()

  const tabs: AnalyticsTabDef[] = [
    { value: 'overview', label: 'Overview', content: <OverviewTab filters={filters} onScopeResolved={setScope} /> },
    { value: 'realtime', label: 'Real Time', content: <RealTimeTab /> },
    { value: 'sales', label: 'Sales', content: <SalesTab filters={filters} onScopeResolved={setScope} /> },
    { value: 'funnel', label: 'Funnel', content: <FunnelTab filters={filters} onScopeResolved={setScope} /> },
    { value: 'products', label: 'Products', content: <ProductsTab filters={filters} onScopeResolved={setScope} /> },
    { value: 'acquisition', label: 'Acquisition', content: <AcquisitionTab filters={filters} onScopeResolved={setScope} /> },
    { value: 'search-demand', label: 'Search & Demand', content: <SearchDemandTab filters={filters} onScopeResolved={setScope} /> },
    { value: 'operations', label: 'Operations', content: <OperationsTab filters={filters} onScopeResolved={setScope} /> },
    { value: 'countries', label: 'Country Performance', content: <CountryPerformanceTab filters={filters} onScopeResolved={setScope} /> },
  ]

  return (
    <AnalyticsShell
      title='Analytics'
      description='What is happening, why, and what needs attention -- across sales, acquisition, product demand, and operations.'
      scopeBadge={activeTab === 'realtime' ? null : scope}
    >
      <AnalyticsTabs tabs={tabs} value={activeTab} onValueChange={setActiveTab} />
    </AnalyticsShell>
  )
}
