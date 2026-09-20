import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SellerQuickActions from './SellerQuickActions'

describe('SellerQuickActions -- conditional real links only', () => {
  it('hides "View storefront" when there is no handle', () => {
    render(
      <MemoryRouter>
        <SellerQuickActions handle={null} canOpenStorefront />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('link', { name: /view storefront/i })).not.toBeInTheDocument()
  })

  it('shows "View storefront" linking to the real handle when one exists and the storefront can go live', () => {
    render(
      <MemoryRouter>
        <SellerQuickActions handle='romeo-mukulah' canOpenStorefront />
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: /view storefront/i })
    expect(link).toHaveAttribute('href', '/seller/romeo-mukulah')
  })

  it('hides "View storefront" even with a handle when the storefront cannot go live yet', () => {
    render(
      <MemoryRouter>
        <SellerQuickActions handle='romeo-mukulah' canOpenStorefront={false} />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('link', { name: /view storefront/i })).not.toBeInTheDocument()
  })

  it('hides "Go live: finish verification" once the storefront can go live', () => {
    render(
      <MemoryRouter>
        <SellerQuickActions handle={null} canOpenStorefront />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('link', { name: /go live/i })).not.toBeInTheDocument()
  })

  it('shows "Go live: finish verification" pointing at /seller-hub when the storefront is not public yet', () => {
    render(
      <MemoryRouter>
        <SellerQuickActions handle={null} canOpenStorefront={false} />
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: /go live/i })
    expect(link).toHaveAttribute('href', '/seller-hub')
  })

  it('always shows "Add product" and "Manage products" pointing at /seller-center/products', () => {
    render(
      <MemoryRouter>
        <SellerQuickActions handle={null} canOpenStorefront />
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
