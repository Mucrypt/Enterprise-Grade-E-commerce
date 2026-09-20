import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import SellerSidebarNav from './SellerSidebarNav'

describe('SellerSidebarNav -- active-route highlighting and expand/collapse', () => {
  it('marks the current route as active', () => {
    render(
      <MemoryRouter initialEntries={['/seller-center/overview']}>
        <SellerSidebarNav />
      </MemoryRouter>,
    )
    const overviewLink = screen.getByRole('link', { name: 'Overview' })
    expect(overviewLink).toHaveClass('bg-orange-500/15')
  })

  it('does not mark an inactive route as active', () => {
    render(
      <MemoryRouter initialEntries={['/seller-center/overview']}>
        <SellerSidebarNav />
      </MemoryRouter>,
    )
    const ordersLink = screen.getByRole('link', { name: 'Orders' })
    expect(ordersLink).not.toHaveClass('bg-orange-500/15')
  })

  it('auto-expands the parent item whose child route is currently active', () => {
    render(
      <MemoryRouter initialEntries={['/seller-center/products/books']}>
        <SellerSidebarNav />
      </MemoryRouter>,
    )
    // Books is a child of Products -- it should already be visible
    // without the user having to click anything.
    expect(screen.getByRole('link', { name: 'Books' })).toBeInTheDocument()
  })

  it('lets the user manually expand a collapsed parent to reveal its children', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/seller-center/overview']}>
        <SellerSidebarNav />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('link', { name: 'Books' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /expand products/i }))
    expect(screen.getByRole('link', { name: 'Books' })).toBeInTheDocument()
  })

  it('calls onNavigate when a leaf item is clicked (drawer-close behavior)', async () => {
    const user = userEvent.setup()
    let navigated = false
    render(
      <MemoryRouter initialEntries={['/seller-center/overview']}>
        <SellerSidebarNav onNavigate={() => (navigated = true)} />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('link', { name: 'Orders' }))
    expect(navigated).toBe(true)
  })

  it('hides section labels and visible text when collapsed, keeping only an icon + title tooltip', () => {
    render(
      <MemoryRouter initialEntries={['/seller-center/overview']}>
        <SellerSidebarNav collapsed />
      </MemoryRouter>,
    )
    expect(screen.queryByText('Main')).not.toBeInTheDocument()
    // The visible <span> label is gone, but the link survives with a
    // `title` tooltip so a collapsed sidebar is still identifiable.
    const overviewLink = screen.getByRole('link', { name: 'Overview' })
    expect(overviewLink).toHaveAttribute('title', 'Overview')
    expect(overviewLink.querySelector('span')).not.toBeInTheDocument()
  })
})
