import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import SellerMobileNav from './SellerMobileNav'

describe('SellerMobileNav -- accessible drawer', () => {
  it('renders nothing when closed', () => {
    render(
      <MemoryRouter>
        <SellerMobileNav open={false} onClose={vi.fn()} />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders the nav and locks body scroll when open', () => {
    render(
      <MemoryRouter>
        <SellerMobileNav open onClose={vi.fn()} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('dialog', { name: 'Seller Center navigation' })).toBeInTheDocument()
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <SellerMobileNav open onClose={onClose} />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: /close navigation/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when the overlay (outside the panel) is clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    const { container } = render(
      <MemoryRouter>
        <SellerMobileNav open onClose={onClose} />
      </MemoryRouter>,
    )
    const overlay = container.querySelector('[aria-hidden="true"]')
    expect(overlay).not.toBeNull()
    await user.click(overlay as Element)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose on Escape', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <SellerMobileNav open onClose={onClose} />
      </MemoryRouter>,
    )
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes after navigating to a destination (onNavigate wired to the nav links)', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/seller-center/overview']}>
        <SellerMobileNav open onClose={onClose} />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('link', { name: 'Orders' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
