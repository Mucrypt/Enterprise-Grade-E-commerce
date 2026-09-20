import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import SellerCommandPalette from './SellerCommandPalette'

describe('SellerCommandPalette -- real nav+action search, no simulated backend search', () => {
  it('renders nothing when closed', () => {
    render(
      <MemoryRouter>
        <SellerCommandPalette open={false} onClose={vi.fn()} />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('lists every real Seller Center destination plus "Add product" when open with no query', () => {
    render(
      <MemoryRouter>
        <SellerCommandPalette open onClose={vi.fn()} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: /add product/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Finances' })).toBeInTheDocument()
  })

  it('filters client-side as the user types, with no matches falling back to "No matches."', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <SellerCommandPalette open onClose={vi.fn()} />
      </MemoryRouter>,
    )
    await user.type(screen.getByPlaceholderText('Search Seller Center...'), 'finan')
    expect(screen.getByRole('button', { name: 'Finances' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Overview' })).not.toBeInTheDocument()

    await user.clear(screen.getByPlaceholderText('Search Seller Center...'))
    await user.type(screen.getByPlaceholderText('Search Seller Center...'), 'zzzznotarealthing')
    expect(screen.getByText('No matches.')).toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <SellerCommandPalette open onClose={onClose} />
      </MemoryRouter>,
    )
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('navigates and closes when an item is clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <SellerCommandPalette open onClose={onClose} />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: 'Finances' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
