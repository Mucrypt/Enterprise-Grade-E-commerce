import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SellerCenterShell from './SellerCenterShell'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => navigateMock }
})

const useAuthStoreMock = vi.fn()
vi.mock('../../stores', () => ({
  useAuthStore: (...args: unknown[]) => useAuthStoreMock(...args),
}))

vi.mock('../../api', () => ({
  sellerApi: { getMyProfile: vi.fn().mockResolvedValue({ sellerProfile: null, eligible: false }) },
  creatorApi: { getMyProfile: vi.fn().mockResolvedValue(null) },
  userApi: { activateBusinessMode: vi.fn() },
}))

function renderShell() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/seller-center']}>
        <SellerCenterShell />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SellerCenterShell -- access gate', () => {
  beforeEach(() => {
    navigateMock.mockClear()
    useAuthStoreMock.mockReset()
  })

  it('redirects an unauthenticated visitor to /login instead of rendering the workspace', async () => {
    useAuthStoreMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      hasHydrated: true,
      isLoading: false,
      updateUser: vi.fn(),
    })

    renderShell()

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/login', expect.anything()))
  })

  it('does not redirect while auth state is still hydrating', () => {
    useAuthStoreMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      hasHydrated: false,
      isLoading: true,
      updateUser: vi.fn(),
    })

    renderShell()

    expect(navigateMock).not.toHaveBeenCalled()
  })
})
