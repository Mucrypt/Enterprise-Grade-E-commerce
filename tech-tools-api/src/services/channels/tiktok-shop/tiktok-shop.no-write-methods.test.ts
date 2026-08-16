import { TikTokShopAdapter } from './tiktok-shop.adapter'

/**
 * Production Review Round 1 §29: "PRODUCT WRITE: no write method exists" /
 * "INVENTORY WRITE: schema has no write-capable sync mode" are claims made
 * in docs/TIKTOK-COMMERCE-1-IMPLEMENTATION-REPORT.md's final status block.
 * A disabled button or an env flag is not proof -- this test inspects the
 * actual adapter's method surface via reflection, so a future accidental
 * addition of a write-capable method (e.g. `updateProduct`, `pushInventory`,
 * `createListing`) fails this test immediately, rather than only being
 * caught by someone reading the diff.
 */
describe('TikTokShopAdapter -- structural proof that no write method exists', () => {
  const WRITE_METHOD_NAME_PATTERN = /^(push|write|update|create|publish|delete|remove|patch|put|set|sync)(?!AccessToken|RefreshToken)/i

  it('exposes no method whose name suggests it could mutate TikTok Shop state', () => {
    const adapter = new TikTokShopAdapter()
    const proto = Object.getPrototypeOf(adapter)
    const methodNames = Object.getOwnPropertyNames(proto).filter((name) => name !== 'constructor' && typeof (adapter as any)[name] === 'function')

    const suspiciousNames = methodNames.filter((name) => WRITE_METHOD_NAME_PATTERN.test(name))
    expect(suspiciousNames).toEqual([])
  })

  it('the public method surface is exactly the expected read/OAuth set -- any addition must be a deliberate, reviewed change', () => {
    const adapter = new TikTokShopAdapter()
    const proto = Object.getPrototypeOf(adapter)
    const publicMethodNames = Object.getOwnPropertyNames(proto)
      .filter((name) => name !== 'constructor' && !name.startsWith('#'))
      .filter((name) => {
        const descriptor = Object.getOwnPropertyDescriptor(proto, name)
        return typeof descriptor?.value === 'function'
      })
      .sort()

    // buildAuthorizeUrl/exchangeCodeForToken/refreshAccessToken are OAuth
    // plumbing, not commerce writes. fetchProducts/fetchOrders are the only
    // two read calls this phase implements. fetchPrimaryAuthorizedShop is
    // a private helper but still appears here since JS/TS has no real
    // runtime privacy for class methods -- included deliberately so this
    // list stays exhaustive rather than silently incomplete.
    expect(publicMethodNames).toEqual(
      ['buildAuthorizeUrl', 'exchangeCodeForToken', 'fetchOrders', 'fetchPrimaryAuthorizedShop', 'fetchProducts', 'refreshAccessToken'].sort(),
    )
  })

  it('getCapabilities() reports every write capability as false -- the one place this claim is surfaced to the ops UI', () => {
    const adapter = new TikTokShopAdapter()
    const capabilities = adapter.getCapabilities()
    expect(capabilities.supportsProductWrite).toBe(false)
    expect(capabilities.supportsInventoryWrite).toBe(false)
    expect(capabilities.supportsFulfillmentWrite).toBe(false)
  })
})
