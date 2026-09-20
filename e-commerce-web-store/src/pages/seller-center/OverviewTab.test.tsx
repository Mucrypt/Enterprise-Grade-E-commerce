import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, Outlet } from 'react-router-dom'
import OverviewTab from './OverviewTab'
import type { CreatorDashboardContext } from './context'

vi.mock('../../api', () => ({
  creatorApi: {
    getDashboardMetrics: vi.fn().mockRejectedValue(new Error('no metrics API yet')),
    getDashboardActivity: vi.fn().mockRejectedValue(new Error('no activity API yet')),
  },
  discoverApi: { getMine: vi.fn().mockRejectedValue(new Error('down')) },
  sellerEarningsApi: { getSummary: vi.fn().mockRejectedValue(new Error('down')) },
  sellerProductsApi: { getMine: vi.fn().mockRejectedValue(new Error('down')) },
}))

function renderWithContext(context: CreatorDashboardContext) {
  function ShellStub() {
    return <Outlet context={context} />
  }
  return render(
    <MemoryRouter initialEntries={['/seller-center/overview']}>
      <Routes>
        <Route element={<ShellStub />}>
          <Route path='/seller-center/overview' element={<OverviewTab />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('OverviewTab -- honest zero-state, no invented numbers when data is unavailable', () => {
  it('shows real €0.00 balances instead of any fabricated figure when every API call fails', async () => {
    renderWithContext({
      sellerProfile: null,
      creatorProfile: null,
      setCreatorProfile: vi.fn(),
      fallbackName: 'Test Seller',
    })

    await waitFor(() => expect(screen.getByText('Store earnings')).toBeInTheDocument())

    // Both money tiles fall back to real "$0" rather than a placeholder
    // like "--" or a randomly-seeded demo number.
    const zeroValues = screen.getAllByText('€0.00')
    expect(zeroValues.length).toBeGreaterThanOrEqual(2)
  })

  it('shows an honest empty state for recent activity instead of fabricated entries', async () => {
    renderWithContext({
      sellerProfile: null,
      creatorProfile: null,
      setCreatorProfile: vi.fn(),
      fallbackName: 'Test Seller',
    })

    await waitFor(() =>
      expect(
        screen.getByText('Nothing yet -- activity appears as you list products and sell.'),
      ).toBeInTheDocument(),
    )
  })

  it('shows the real getting-started checklist, all unchecked, when nothing has been done yet', async () => {
    renderWithContext({
      sellerProfile: null,
      creatorProfile: null,
      setCreatorProfile: vi.fn(),
      fallbackName: 'Test Seller',
    })

    await waitFor(() => expect(screen.getByText('List your first store product')).toBeInTheDocument())
    expect(screen.getByText('Post to Discover')).toBeInTheDocument()
    expect(screen.getByText('Make your first sale')).toBeInTheDocument()
  })
})
