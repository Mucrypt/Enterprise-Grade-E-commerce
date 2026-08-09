describe('jwt.config', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('uses the configured secrets when present', () => {
    process.env.NODE_ENV = 'production'
    process.env.JWT_SECRET = 'real-access-secret'
    process.env.JWT_REFRESH_SECRET = 'real-refresh-secret'

    const { JWT_SECRET, JWT_REFRESH_SECRET } = require('./jwt.config')

    expect(JWT_SECRET).toBe('real-access-secret')
    expect(JWT_REFRESH_SECRET).toBe('real-refresh-secret')
  })

  it('throws at load time when JWT_SECRET is missing in production', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.JWT_SECRET
    process.env.JWT_REFRESH_SECRET = 'real-refresh-secret'

    expect(() => require('./jwt.config')).toThrow(/JWT_SECRET/)
  })

  it('throws at load time when JWT_REFRESH_SECRET is missing in production', () => {
    process.env.NODE_ENV = 'production'
    process.env.JWT_SECRET = 'real-access-secret'
    delete process.env.JWT_REFRESH_SECRET

    expect(() => require('./jwt.config')).toThrow(/JWT_REFRESH_SECRET/)
  })

  it('throws when a secret is set to an empty/whitespace string in production', () => {
    process.env.NODE_ENV = 'production'
    process.env.JWT_SECRET = '   '
    process.env.JWT_REFRESH_SECRET = 'real-refresh-secret'

    expect(() => require('./jwt.config')).toThrow(/JWT_SECRET/)
  })

  it('falls back to a single insecure dev default outside production without throwing', () => {
    process.env.NODE_ENV = 'development'
    delete process.env.JWT_SECRET
    delete process.env.JWT_REFRESH_SECRET

    const { JWT_SECRET, JWT_REFRESH_SECRET } = require('./jwt.config')

    expect(JWT_SECRET).toBe('insecure-dev-only-jwt-secret')
    expect(JWT_REFRESH_SECRET).toBe('insecure-dev-only-jwt-refresh-secret')
  })

  it('defaults token expiry values when not configured', () => {
    process.env.NODE_ENV = 'development'
    delete process.env.JWT_ACCESS_EXPIRY
    delete process.env.JWT_REFRESH_EXPIRY

    const { JWT_ACCESS_EXPIRY, JWT_REFRESH_EXPIRY } = require('./jwt.config')

    expect(JWT_ACCESS_EXPIRY).toBe('15m')
    expect(JWT_REFRESH_EXPIRY).toBe('7d')
  })
})
