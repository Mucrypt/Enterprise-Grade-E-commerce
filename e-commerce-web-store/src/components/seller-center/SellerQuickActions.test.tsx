import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SellerQuickActions from './SellerQuickActions'

describe('SellerQuickActions -- conditional real links only', () => {
  it('hides "View storefront" when there is no handle', () => {
    render(
      <MemoryRouter>
        <SellerQuickActions handle={null} dashboardReady />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('link', { name: /view storefront/i })).not.toBeInTheDocument()
  })

  it('shows "View storefront" linking to the real handle when one exists', () => {
    render(
      <MemoryRouter>
        <SellerQuickActions handle='romeo-mukulah' dashboardReady />
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: /view storefront/i })
    expect(link).toHaveAttribute('href', '/seller/romeo-mukulah')
  })

  it('hides "Complete seller setup" once the dashboard is ready', () => {
    render(
      <MemoryRouter>
        <SellerQuickActions handle={null} dashboardReady />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('link', { name: /complete seller setup/i })).not.toBeInTheDocument()
  })

  it('shows "Complete seller setup" pointing at /seller-hub when the dashboard is not ready', () => {
    render(
      <MemoryRouter>
        <SellerQuickActions handle={null} dashboardReady={false} />
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: /complete seller setup/i })
    expect(link).toHaveAttribute('href', '/seller-hub')
  })

  it('always shows "Add product" and "Manage products" pointing at /seller-center/products', () => {
    render(
      <MemoryRouter>
        <SellerQuickActions handle={null} dashboardReady />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: /add product/i })).toHaveAttribute(
      'href',
      '/seller-center/products',
    )
    expect(screen.getByRole('link', { name: /manage products/i })).toHaveAttribute(
      'href',
      '/seller-center/products',
    )
  })
})
