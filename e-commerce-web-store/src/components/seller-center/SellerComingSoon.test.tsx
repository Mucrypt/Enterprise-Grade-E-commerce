import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Boxes } from 'lucide-react'
import SellerComingSoon from './SellerComingSoon'

describe('SellerComingSoon -- honest stub, never a fabricated metric', () => {
  it('renders exactly the title/description it is given, with no invented numbers', () => {
    render(
      <MemoryRouter>
        <SellerComingSoon
          icon={Boxes}
          title='Orders is coming soon'
          description="Order management needs a seller-scoped orders API that doesn't exist yet."
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('Orders is coming soon')).toBeInTheDocument()
    expect(
      screen.getByText("Order management needs a seller-scoped orders API that doesn't exist yet."),
    ).toBeInTheDocument()
    // No stray digits anywhere in the rendered card -- a regression here
    // would mean someone slipped a fake "0 orders" / "$0.00" stat in.
    expect(screen.getByRole('heading').textContent).not.toMatch(/\d/)
  })

  it('renders real links when provided, and none when omitted', () => {
    const { rerender } = render(
      <MemoryRouter>
        <SellerComingSoon icon={Boxes} title='Messages' description='Not built yet.' />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('link')).not.toBeInTheDocument()

    rerender(
      <MemoryRouter>
        <SellerComingSoon
          icon={Boxes}
          title='Messages'
          description='Not built yet.'
          links={[{ label: 'Open Support', to: '/seller-center/support' }]}
        />
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: 'Open Support' })
    expect(link).toHaveAttribute('href', '/seller-center/support')
  })
})
