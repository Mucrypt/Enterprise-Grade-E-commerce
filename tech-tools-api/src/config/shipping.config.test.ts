import { isMockShippingAllowed } from './shipping.config'

describe('isMockShippingAllowed', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('is never allowed in production, even if the flag is set', () => {
    process.env.NODE_ENV = 'production'
    process.env.ALLOW_MOCK_SHIPPING = 'true'

    expect(isMockShippingAllowed()).toBe(false)
  })

  it('is disabled by default outside production', () => {
    process.env.NODE_ENV = 'development'
    delete process.env.ALLOW_MOCK_SHIPPING

    expect(isMockShippingAllowed()).toBe(false)
  })

  it('is allowed outside production only when explicitly enabled', () => {
    process.env.NODE_ENV = 'development'
    process.env.ALLOW_MOCK_SHIPPING = 'true'

    expect(isMockShippingAllowed()).toBe(true)
  })

  it('treats any non-"true" value as disabled', () => {
    process.env.NODE_ENV = 'development'
    process.env.ALLOW_MOCK_SHIPPING = '1'

    expect(isMockShippingAllowed()).toBe(false)
  })
})
