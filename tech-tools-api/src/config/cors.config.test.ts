import { Request } from 'express'
import type { corsOptionsDelegate as CorsOptionsDelegate, isExtensionOrigin as IsExtensionOrigin } from './cors.config'

const REAL_ENV = process.env

function makeReq(path: string, origin?: string): Request {
  return { path, headers: { origin } } as unknown as Request
}

/**
 * DASHBOARD_ORIGINS is computed once, from process.env.CORS_ORIGIN, at
 * module load time -- so every test that cares about a specific
 * CORS_ORIGIN value must set the env var and THEN freshly require the
 * module (jest.resetModules() clears the require cache), rather than
 * relying on a static top-level import.
 */
function loadDelegateWithEnv(corsOrigin?: string): { corsOptionsDelegate: typeof CorsOptionsDelegate; isExtensionOrigin: typeof IsExtensionOrigin } {
  jest.resetModules()
  process.env = { ...REAL_ENV }
  if (corsOrigin === undefined) {
    delete process.env.CORS_ORIGIN
  } else {
    process.env.CORS_ORIGIN = corsOrigin
  }
  return require('./cors.config')
}

afterAll(() => {
  process.env = REAL_ENV
})

describe('isExtensionOrigin', () => {
  const { isExtensionOrigin } = loadDelegateWithEnv('https://techtoolstore.com')

  it('recognizes chrome-extension:// and moz-extension:// origins', () => {
    expect(isExtensionOrigin('chrome-extension://abc123')).toBe(true)
    expect(isExtensionOrigin('moz-extension://abc123')).toBe(true)
  })

  it('rejects a normal https origin, undefined, and an empty string', () => {
    expect(isExtensionOrigin('https://techtoolstore.com')).toBe(false)
    expect(isExtensionOrigin(undefined)).toBe(false)
    expect(isExtensionOrigin('')).toBe(false)
  })
})

describe('corsOptionsDelegate', () => {
  it('allows an extension origin on /sourcing/verify, with credentials disabled (Bearer-token auth, not cookies)', () => {
    const { corsOptionsDelegate } = loadDelegateWithEnv('https://techtoolstore.com,https://admin.techtoolstore.com')
    const callback = jest.fn()
    corsOptionsDelegate(makeReq('/api/v1/sourcing/verify', 'chrome-extension://poipjobmakcelohhokephpjiefkcchbf'), callback)
    expect(callback).toHaveBeenCalledWith(null, { origin: true, credentials: false, optionsSuccessStatus: 200 })
  })

  it('allows an extension origin on /sourcing/captures', () => {
    const { corsOptionsDelegate } = loadDelegateWithEnv('https://techtoolstore.com')
    const callback = jest.fn()
    corsOptionsDelegate(makeReq('/api/v1/sourcing/captures', 'chrome-extension://poipjobmakcelohhokephpjiefkcchbf'), callback)
    expect(callback).toHaveBeenCalledWith(null, { origin: true, credentials: false, optionsSuccessStatus: 200 })
  })

  it('does NOT apply the extension allowance on any other sourcing route, even from an extension origin', () => {
    const { corsOptionsDelegate } = loadDelegateWithEnv('https://techtoolstore.com,https://admin.techtoolstore.com')
    const callback = jest.fn()
    corsOptionsDelegate(makeReq('/api/v1/sourcing/products', 'chrome-extension://poipjobmakcelohhokephpjiefkcchbf'), callback)
    const optionsUsed = callback.mock.calls[0][1]
    expect(optionsUsed.credentials).toBe(true)
    expect(optionsUsed.origin).toEqual(['https://techtoolstore.com', 'https://admin.techtoolstore.com'])
  })

  it('does NOT apply the extension allowance on /sourcing/verify itself if the request is not actually from an extension origin', () => {
    const { corsOptionsDelegate } = loadDelegateWithEnv('https://techtoolstore.com')
    const callback = jest.fn()
    corsOptionsDelegate(makeReq('/api/v1/sourcing/verify', 'https://evil.example.com'), callback)
    const optionsUsed = callback.mock.calls[0][1]
    expect(optionsUsed.credentials).toBe(true)
    expect(optionsUsed.origin).toEqual(['https://techtoolstore.com'])
  })

  it('every other route keeps the strict dashboard-origin allowlist with credentials enabled', () => {
    const { corsOptionsDelegate } = loadDelegateWithEnv('https://techtoolstore.com,https://admin.techtoolstore.com')
    const callback = jest.fn()
    corsOptionsDelegate(makeReq('/api/v1/orders', 'https://techtoolstore.com'), callback)
    expect(callback).toHaveBeenCalledWith(null, {
      origin: ['https://techtoolstore.com', 'https://admin.techtoolstore.com'],
      credentials: true,
      optionsSuccessStatus: 200,
    })
  })

  it('falls back to the localhost dev origin when CORS_ORIGIN is unset', () => {
    const { corsOptionsDelegate } = loadDelegateWithEnv(undefined)
    const callback = jest.fn()
    corsOptionsDelegate(makeReq('/api/v1/orders', 'http://localhost:5173'), callback)
    expect(callback).toHaveBeenCalledWith(null, { origin: ['http://localhost:5173'], credentials: true, optionsSuccessStatus: 200 })
  })
})
