import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RequestVerificationModal from './RequestVerificationModal'
import { sellerDocumentsApi, type SellerDocument } from '../../api'

vi.mock('../../api', () => ({
  sellerDocumentsApi: {
    getMine: vi.fn(),
    upload: vi.fn(),
    remove: vi.fn(),
  },
}))

function makeDocument(overrides: Partial<SellerDocument>): SellerDocument {
  return {
    id: 'doc-1',
    category: 'identity_document',
    uploadStatus: 'stored',
    reviewStatus: 'pending',
    malwareScanStatus: 'not_scanned',
    byteSize: 1024,
    contentType: 'image/jpeg',
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    ...overrides,
  }
}

describe('RequestVerificationModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('disables Submit request until a document exists when none is on file yet', async () => {
    vi.mocked(sellerDocumentsApi.getMine).mockResolvedValue([])
    render(
      <RequestVerificationModal tier='trusted' busy={false} onClose={vi.fn()} onConfirm={vi.fn()} />,
    )

    const submitButton = await screen.findByRole('button', { name: /submit request/i })
    expect(submitButton).toBeDisabled()
    expect(screen.getByText(/click to upload your id or passport/i)).toBeInTheDocument()
  })

  it('enables Submit request once a document is uploaded', async () => {
    const user = userEvent.setup()
    vi.mocked(sellerDocumentsApi.getMine).mockResolvedValue([])
    vi.mocked(sellerDocumentsApi.upload).mockResolvedValue(makeDocument({}))

    render(
      <RequestVerificationModal tier='trusted' busy={false} onClose={vi.fn()} onConfirm={vi.fn()} />,
    )

    await screen.findByText(/click to upload your id or passport/i)
    const file = new File(['fake'], 'id.jpg', { type: 'image/jpeg' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, file)

    await waitFor(() => expect(sellerDocumentsApi.upload).toHaveBeenCalledWith(file, 'identity_document'))
    const submitButton = await screen.findByRole('button', { name: /submit request/i })
    expect(submitButton).toBeEnabled()
  })

  it('shows an honest pending-scan explanation for an admin-accepted but not-yet-scanned document, without claiming approval', async () => {
    vi.mocked(sellerDocumentsApi.getMine).mockResolvedValue([
      makeDocument({ reviewStatus: 'accepted', malwareScanStatus: 'not_scanned' }),
    ])

    render(
      <RequestVerificationModal tier='pro' busy={false} onClose={vi.fn()} onConfirm={vi.fn()} />,
    )

    expect(await screen.findByText(/malware scanning is not connected yet/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit request/i })).toBeEnabled()
  })

  it('shows a clean, fully-verified document as such', async () => {
    vi.mocked(sellerDocumentsApi.getMine).mockResolvedValue([
      makeDocument({ reviewStatus: 'accepted', malwareScanStatus: 'clean' }),
    ])

    render(
      <RequestVerificationModal tier='trusted' busy={false} onClose={vi.fn()} onConfirm={vi.fn()} />,
    )

    expect(await screen.findByText(/accepted and verified clean/i)).toBeInTheDocument()
  })

  it('offers a replacement upload for a rejected document instead of blocking forever', async () => {
    vi.mocked(sellerDocumentsApi.getMine).mockResolvedValue([
      makeDocument({ reviewStatus: 'rejected' }),
    ])

    render(
      <RequestVerificationModal tier='trusted' busy={false} onClose={vi.fn()} onConfirm={vi.fn()} />,
    )

    expect(await screen.findByText(/please upload a replacement/i)).toBeInTheDocument()
    expect(screen.getByText('Upload a replacement')).toBeInTheDocument()
  })

  it('rejects an unsupported file type client-side before ever calling the upload API', async () => {
    const user = userEvent.setup()
    vi.mocked(sellerDocumentsApi.getMine).mockResolvedValue([])

    render(
      <RequestVerificationModal tier='trusted' busy={false} onClose={vi.fn()} onConfirm={vi.fn()} />,
    )

    await screen.findByText(/click to upload your id or passport/i)
    const file = new File(['fake'], 'id.exe', { type: 'application/x-msdownload' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, file)

    expect(await screen.findByText(/jpeg, png, webp, or pdf/i)).toBeInTheDocument()
    expect(sellerDocumentsApi.upload).not.toHaveBeenCalled()
  })

  it('calls onConfirm (not the upload API again) when Submit request is clicked', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    vi.mocked(sellerDocumentsApi.getMine).mockResolvedValue([makeDocument({})])

    render(
      <RequestVerificationModal tier='trusted' busy={false} onClose={vi.fn()} onConfirm={onConfirm} />,
    )

    const submitButton = await screen.findByRole('button', { name: /submit request/i })
    await user.click(submitButton)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
