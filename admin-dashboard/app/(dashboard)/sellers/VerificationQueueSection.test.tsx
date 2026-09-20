import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { VerificationQueueSection } from './page'
import { sellerService, type SellerVerificationQueueItem } from '@/services/seller.service'

vi.mock('@/services/seller.service', async () => {
  const actual = await vi.importActual<typeof import('@/services/seller.service')>(
    '@/services/seller.service',
  )
  return {
    ...actual,
    sellerService: {
      getVerificationQueue: vi.fn(),
      getVerificationQueueCounts: vi.fn(),
      approveVerificationRequest: vi.fn(),
      rejectVerificationRequest: vi.fn(),
      suspendSellerProfile: vi.fn(),
      setCreatorAccess: vi.fn(),
    },
  }
})

const toastError = vi.fn()
const toastSuccess = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}))

function makeItem(overrides: Partial<SellerVerificationQueueItem>): SellerVerificationQueueItem {
  return {
    id: 'req-1',
    user_id: 'user-1',
    seller_profile_id: 'profile-1',
    requested_tier: 'trusted',
    status: 'PENDING',
    created_at: new Date().toISOString(),
    display_name: 'Test Seller',
    handle: 'test-seller',
    tier: 'unverified',
    verification_status: 'PENDING_REVIEW',
    email: 'seller@example.com',
    ...overrides,
  }
}

function renderQueue(items: SellerVerificationQueueItem[]) {
  vi.mocked(sellerService.getVerificationQueue).mockResolvedValue({
    success: true,
    data: {
      items,
      pagination: { page: 1, limit: 100, total: items.length, totalPages: 1 },
    },
  })
  vi.mocked(sellerService.getVerificationQueueCounts).mockResolvedValue({
    pending: items.filter((i) => i.status === 'PENDING').length,
    more_information_required: items.filter((i) => i.status === 'MORE_INFORMATION_REQUIRED')
      .length,
    approved: items.filter((i) => i.status === 'APPROVED').length,
    rejected: items.filter((i) => i.status === 'REJECTED').length,
    expired: items.filter((i) => i.status === 'EXPIRED').length,
    superseded: items.filter((i) => i.status === 'SUPERSEDED').length,
  })

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <VerificationQueueSection canManage />
    </QueryClientProvider>,
  )
}

describe('VerificationQueueSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows Approve/Reject enabled for a PENDING (reviewable) case', async () => {
    renderQueue([makeItem({ status: 'PENDING' })])

    const approveButton = await screen.findByRole('button', { name: /approve/i })
    const rejectButton = screen.getByRole('button', { name: /reject/i })
    expect(approveButton).toBeEnabled()
    expect(rejectButton).toBeEnabled()
  })

  it('disables Approve/Reject for a terminal SUPERSEDED case and marks it historical', async () => {
    renderQueue([makeItem({ status: 'SUPERSEDED', id: 'req-2' })])

    const approveButton = await screen.findByRole('button', { name: /approve/i })
    const rejectButton = screen.getByRole('button', { name: /reject/i })
    expect(approveButton).toBeDisabled()
    expect(rejectButton).toBeDisabled()
    expect(screen.getByText(/historical -- not actionable/i)).toBeInTheDocument()
  })

  it('disables Approve/Reject for every other terminal status (APPROVED, REJECTED, EXPIRED)', async () => {
    for (const status of ['APPROVED', 'REJECTED', 'EXPIRED'] as const) {
      const { unmount } = renderQueue([makeItem({ status, id: `req-${status}` })])
      const approveButton = await screen.findByRole('button', { name: /approve/i })
      const rejectButton = screen.getByRole('button', { name: /reject/i })
      expect(approveButton).toBeDisabled()
      expect(rejectButton).toBeDisabled()
      unmount()
    }
  })

  it('displays MORE_INFORMATION_REQUIRED distinctly and keeps it actionable', async () => {
    renderQueue([makeItem({ status: 'MORE_INFORMATION_REQUIRED' })])

    // Both the aggregate counts badge and the row's own case-status badge
    // render this text -- assert on the row specifically, once it's
    // actually loaded (the counts query and the queue query are
    // independent, so the counts badge can resolve first).
    const approveButton = await screen.findByRole('button', { name: /approve/i })
    expect(approveButton).toBeEnabled()
    const row = approveButton.closest('tr')!
    expect(within(row).getByText(/more info requested/i)).toBeInTheDocument()
  })

  it('refreshes the queue from the server after a successful approval, without any local optimistic change', async () => {
    const user = userEvent.setup()
    const item = makeItem({ status: 'PENDING' })
    renderQueue([item])

    vi.mocked(sellerService.approveVerificationRequest).mockResolvedValue({
      success: true,
      data: {},
    })
    // Second load (post-invalidate) reflects the real server state -- the
    // case moved to APPROVED and is no longer pending.
    vi.mocked(sellerService.getVerificationQueue).mockResolvedValueOnce({
      success: true,
      data: { items: [item], pagination: { page: 1, limit: 100, total: 1, totalPages: 1 } },
    })

    const approveButton = await screen.findByRole('button', { name: /approve/i })
    await user.click(approveButton)

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled())
    // The refetch is what proves this -- invalidateQueries triggers a
    // real network call rather than the row just disappearing/flipping
    // to "Approved" from client-side state alone.
    await waitFor(() =>
      expect(sellerService.getVerificationQueue).toHaveBeenCalledTimes(2),
    )
  })

  it('leaves a failed approval unchanged and shows the real backend error, with no optimistic success', async () => {
    const user = userEvent.setup()
    renderQueue([makeItem({ status: 'PENDING' })])

    vi.mocked(sellerService.approveVerificationRequest).mockRejectedValue({
      response: { data: { error: 'Cannot transition verification request from "PENDING" to "APPROVED"' } },
    })

    const approveButton = await screen.findByRole('button', { name: /approve/i })
    await user.click(approveButton)

    await waitFor(() => expect(toastError).toHaveBeenCalled())
    expect(toastSuccess).not.toHaveBeenCalled()
    // Still pending and still actionable -- nothing was optimistically
    // marked approved or removed from the queue.
    const approveButtonAfter = await screen.findByRole('button', { name: /approve/i })
    expect(approveButtonAfter).toBeEnabled()
    const row = approveButtonAfter.closest('tr')!
    expect(within(row).getByText(/pending review/i)).toBeInTheDocument()
  })

  it('shows a clear, specific explanation when approval fails because malware scanning is not configured', async () => {
    const user = userEvent.setup()
    renderQueue([makeItem({ status: 'PENDING' })])

    vi.mocked(sellerService.approveVerificationRequest).mockRejectedValue({
      response: {
        data: {
          error:
            'Cannot transition verification request from "PENDING" to "APPROVED (missing an accepted AND malware-scanned-clean identity document for a tier that requires one)"',
        },
      },
    })

    const approveButton = await screen.findByRole('button', { name: /approve/i })
    await user.click(approveButton)

    await waitFor(() => expect(toastError).toHaveBeenCalled())
    const [message] = toastError.mock.calls[0]
    expect(message).toMatch(/malware scanning/i)
    expect(message).toMatch(/not.*retry|keep failing/i)
  })

  it('shows Grant/Revoke access based on the PROFILE verification status, not the case status', async () => {
    renderQueue([
      makeItem({ status: 'PENDING', verification_status: 'APPROVED', seller_profile_id: 'p1' }),
    ])

    const row = (await screen.findByText('Test Seller')).closest('tr')!
    const grantButton = within(row).getByRole('button', { name: /grant access/i })
    const revokeButton = within(row).getByRole('button', { name: /revoke access/i })
    // Profile is already APPROVED -- granting again is a no-op, revoke is available.
    expect(grantButton).toBeDisabled()
    expect(revokeButton).toBeEnabled()
  })
})
