import crypto from 'crypto'

jest.mock('./logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

const REAL_ENV = process.env

function freshModule() {
  jest.resetModules()
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('./secret-encryption') as typeof import('./secret-encryption')
}

describe('secret-encryption', () => {
  beforeEach(() => {
    jest.resetModules()
    process.env = { ...REAL_ENV }
    delete process.env.SOCIAL_TOKEN_ENCRYPTION_KEY
    process.env.NODE_ENV = 'test'
  })

  afterAll(() => {
    process.env = REAL_ENV
  })

  it('round-trips a plaintext secret using the dev-fallback key when no env key is set', () => {
    const { encryptSecret, decryptSecret } = freshModule()
    const original = 'EAAG-real-looking-facebook-page-access-token-value'
    const stored = encryptSecret(original)
    expect(stored).not.toContain(original)
    expect(decryptSecret(stored)).toBe(original)
  })

  it('round-trips using an explicit valid 32-byte base64 key from env', () => {
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64')
    const { encryptSecret, decryptSecret } = freshModule()
    const original = 'some-refresh-token'
    expect(decryptSecret(encryptSecret(original))).toBe(original)
  })

  it('produces a versioned, colon-delimited opaque string, never containing the plaintext', () => {
    const { encryptSecret } = freshModule()
    const stored = encryptSecret('super-secret-value')
    const parts = stored.split(':')
    expect(parts).toHaveLength(4)
    expect(parts[0]).toBe('v1')
    expect(stored).not.toContain('super-secret-value')
  })

  it('two encryptions of the same plaintext produce different ciphertext (random IV per call)', () => {
    const { encryptSecret } = freshModule()
    const a = encryptSecret('same-value')
    const b = encryptSecret('same-value')
    expect(a).not.toBe(b)
  })

  it('throws SecretDecryptionError on a tampered ciphertext (auth tag mismatch), never returns garbage', () => {
    const { encryptSecret, decryptSecret, SecretDecryptionError } = freshModule()
    const stored = encryptSecret('do-not-leak-me')
    const [version, iv, authTag, ciphertext] = stored.split(':')
    // Flip a character in the ciphertext portion.
    const tamperedCiphertext = ciphertext.slice(0, -2) + (ciphertext.slice(-2) === 'AA' ? 'BB' : 'AA')
    const tampered = [version, iv, authTag, tamperedCiphertext].join(':')
    expect(() => decryptSecret(tampered)).toThrow(SecretDecryptionError)
  })

  it('throws SecretDecryptionError on a malformed stored string', () => {
    const { decryptSecret, SecretDecryptionError } = freshModule()
    expect(() => decryptSecret('not-a-real-encrypted-value')).toThrow(SecretDecryptionError)
    expect(() => decryptSecret('v1:only:three')).toThrow(SecretDecryptionError)
    expect(() => decryptSecret('vX:aa:bb:cc')).toThrow(SecretDecryptionError)
  })

  it('throws SecretDecryptionError when decrypting under the wrong key (e.g. a rotated/different dev key)', () => {
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64')
    const moduleA = freshModule()
    const stored = moduleA.encryptSecret('cross-key-value')

    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64')
    const moduleB = freshModule()
    expect(() => moduleB.decryptSecret(stored)).toThrow(moduleB.SecretDecryptionError)
  })

  it('throws SecretEncryptionConfigError at load-time use if a present key is the wrong length', () => {
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = Buffer.from('too-short').toString('base64')
    const { encryptSecret, SecretEncryptionConfigError } = freshModule()
    expect(() => encryptSecret('x')).toThrow(SecretEncryptionConfigError)
  })

  it('throws SecretEncryptionConfigError in production when the key is entirely unset', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.SOCIAL_TOKEN_ENCRYPTION_KEY
    const { encryptSecret, SecretEncryptionConfigError } = freshModule()
    expect(() => encryptSecret('x')).toThrow(SecretEncryptionConfigError)
  })
})

/**
 * TIKTOK-COMMERCE-1 -- channelTokenCipher (commerce_channel_accounts'
 * tokens) is built from the same createSecretCipher() factory as the
 * default social-token cipher above, but reads a completely separate env
 * var (CHANNEL_TOKEN_ENCRYPTION_KEY) and must never share a key or
 * dev-mode fallback with it -- rotating or compromising one domain's key
 * must never affect the other's ciphertext.
 */
describe('secret-encryption -- channelTokenCipher / createSecretCipher independence', () => {
  beforeEach(() => {
    jest.resetModules()
    process.env = { ...REAL_ENV }
    delete process.env.SOCIAL_TOKEN_ENCRYPTION_KEY
    delete process.env.CHANNEL_TOKEN_ENCRYPTION_KEY
    process.env.NODE_ENV = 'test'
  })

  afterAll(() => {
    process.env = REAL_ENV
  })

  it('round-trips a plaintext secret via channelTokenCipher using its own dev-fallback key', () => {
    const { channelTokenCipher } = freshModule()
    const original = 'tiktok-shop-access-token-value'
    const stored = channelTokenCipher.encryptSecret(original)
    expect(stored).not.toContain(original)
    expect(channelTokenCipher.decryptSecret(stored)).toBe(original)
  })

  it('round-trips using an explicit CHANNEL_TOKEN_ENCRYPTION_KEY, independent of SOCIAL_TOKEN_ENCRYPTION_KEY', () => {
    process.env.CHANNEL_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64')
    const { channelTokenCipher } = freshModule()
    const original = 'tiktok-shop-refresh-token'
    expect(channelTokenCipher.decryptSecret(channelTokenCipher.encryptSecret(original))).toBe(original)
  })

  it('a value encrypted under the social cipher can never be decrypted by channelTokenCipher, even with both keys unset (different dev-fallback derivations)', () => {
    const { encryptSecret, channelTokenCipher, SecretDecryptionError } = freshModule()
    const stored = encryptSecret('social-connection-token')
    expect(() => channelTokenCipher.decryptSecret(stored)).toThrow(SecretDecryptionError)
  })

  it('a value encrypted under an explicit CHANNEL_TOKEN_ENCRYPTION_KEY cannot be decrypted under a differently-set SOCIAL_TOKEN_ENCRYPTION_KEY', () => {
    process.env.CHANNEL_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64')
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64')
    const { channelTokenCipher, decryptSecret, SecretDecryptionError } = freshModule()
    const stored = channelTokenCipher.encryptSecret('channel-token')
    // decrypting a channel-encrypted value with the social cipher must fail
    expect(() => decryptSecret(stored)).toThrow(SecretDecryptionError)
  })

  it('a wrong-length CHANNEL_TOKEN_ENCRYPTION_KEY throws SecretEncryptionConfigError independently of the social key being valid', () => {
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64')
    process.env.CHANNEL_TOKEN_ENCRYPTION_KEY = Buffer.from('too-short').toString('base64')
    const { channelTokenCipher, SecretEncryptionConfigError } = freshModule()
    expect(() => channelTokenCipher.encryptSecret('x')).toThrow(SecretEncryptionConfigError)
  })

  it('fails closed in production when CHANNEL_TOKEN_ENCRYPTION_KEY is unset, even if SOCIAL_TOKEN_ENCRYPTION_KEY is configured', () => {
    process.env.NODE_ENV = 'production'
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64')
    delete process.env.CHANNEL_TOKEN_ENCRYPTION_KEY
    const { channelTokenCipher, SecretEncryptionConfigError } = freshModule()
    expect(() => channelTokenCipher.encryptSecret('x')).toThrow(SecretEncryptionConfigError)
  })
})
