// Single authoritative gate for whether carrier services are allowed to
// fall back to fabricated (mock) rates, tracking, labels, or address
// validation results.
//
// Production is a hard rail: mock shipping data is never allowed there,
// regardless of ALLOW_MOCK_SHIPPING. Outside production, mock data is still
// opt-in via an explicit env var -- a missing/misconfigured carrier
// integration in development should be visible (a thrown error), not
// silently papered over, unless a developer has deliberately turned mock
// mode on.
export function isMockShippingAllowed(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false
  }

  return process.env.ALLOW_MOCK_SHIPPING === 'true'
}

export class ShippingUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ShippingUnavailableError'
  }
}
