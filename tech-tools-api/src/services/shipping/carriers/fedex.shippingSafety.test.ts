import { FedExService } from './fedex'
import { ShippingUnavailableError } from '../../../config/shipping.config'

jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

const address = {
  name: 'Test',
  street1: '1 Main St',
  city: 'Testville',
  state: 'CA',
  postalCode: '90001',
  country: 'US',
}

const packages = [
  {
    weight: 1,
    weightUnit: 'lb' as const,
    length: 10,
    width: 10,
    height: 10,
    dimensionUnit: 'in' as const,
  },
]

describe('FedExService mock-shipping gating (no credentials configured)', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('throws instead of returning fabricated rates in production', async () => {
    process.env.NODE_ENV = 'production'
    process.env.ALLOW_MOCK_SHIPPING = 'true' // must be ignored in production

    const fedex = new FedExService()

    await expect(fedex.getRates(address, address, packages)).rejects.toThrow(
      ShippingUnavailableError,
    )
  })

  it('throws instead of returning a fabricated label in production', async () => {
    process.env.NODE_ENV = 'production'

    const fedex = new FedExService()

    await expect(
      fedex.createShipment({
        from: address,
        to: address,
        packages,
        serviceCode: 'FEDEX_GROUND',
      }),
    ).rejects.toThrow(ShippingUnavailableError)
  })

  it('throws outside production when mock shipping is not explicitly enabled', async () => {
    process.env.NODE_ENV = 'development'
    delete process.env.ALLOW_MOCK_SHIPPING

    const fedex = new FedExService()

    await expect(fedex.getRates(address, address, packages)).rejects.toThrow(
      ShippingUnavailableError,
    )
  })

  it('returns mock rates outside production when explicitly enabled', async () => {
    process.env.NODE_ENV = 'development'
    process.env.ALLOW_MOCK_SHIPPING = 'true'

    const fedex = new FedExService()
    const rates = await fedex.getRates(address, address, packages)

    expect(rates.length).toBeGreaterThan(0)
    expect(rates[0].carrier).toBe('fedex')
  })

  it('never returns the literal MOCK_LABEL_DATA_BASE64 placeholder in production', async () => {
    process.env.NODE_ENV = 'production'

    const fedex = new FedExService()

    await expect(
      fedex.createShipment({
        from: address,
        to: address,
        packages,
        serviceCode: 'FEDEX_GROUND',
      }),
    ).rejects.toThrow()
  })
})
