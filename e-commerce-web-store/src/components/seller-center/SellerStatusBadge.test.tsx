import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SellerStatusBadge from './SellerStatusBadge'

describe('SellerStatusBadge -- verification_status/is_suspended -> label mapping', () => {
  it('shows "Verified seller" for an approved seller', () => {
    render(<SellerStatusBadge verificationStatus='approved' />)
    expect(screen.getByText('Verified seller')).toBeInTheDocument()
  })

  it('shows "Verification pending" for a pending seller', () => {
    render(<SellerStatusBadge verificationStatus='pending' />)
    expect(screen.getByText('Verification pending')).toBeInTheDocument()
  })

  it('shows "Suspended" when is_suspended is true, even if verification_status is approved', () => {
    render(<SellerStatusBadge verificationStatus='approved' isSuspended />)
    expect(screen.getByText('Suspended')).toBeInTheDocument()
    expect(screen.queryByText('Verified seller')).not.toBeInTheDocument()
  })

  it('falls back to "Not verified" for an unrecognized status instead of crashing', () => {
    render(<SellerStatusBadge verificationStatus='some-unknown-value' />)
    expect(screen.getByText('Not verified')).toBeInTheDocument()
  })
})
