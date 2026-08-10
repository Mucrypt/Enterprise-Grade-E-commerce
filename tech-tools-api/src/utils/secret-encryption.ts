/**
 * Real authenticated encryption (AES-256-GCM) for third-party secrets that
 * must never be stored in plaintext -- currently: social_connections'
 * access_token_encrypted / refresh_token_encrypted columns
 * (PROMOTION-OPS-1). Written from scratch: an audit of this codebase found
 * zero real encryption anywhere -- email_sender_aliases.smtp_pass_encrypted
 * is stored and read as plain text despite its name (a literal
 * `// TODO: Decrypt` sits next to every read of it), and
 * whatsapp_settings.is_encrypted is only ever used to mask a value in API
 * responses, never to actually encrypt storage. This file exists so that
 * mistake is not repeated for OAuth tokens, which are a materially higher-
 * value secret than either of those.
 *
 * Key resolution mirrors config/jwt.config.ts's resolveSecret() pattern
 * (fail closed in production if unset; warn + insecure dev fallback
 * otherwise) -- with one addition: a *present* key must decode to exactly
 * 32 bytes (AES-256's key length). A wrong-length key is a hard
 * configuration bug, not a "weak but present" secret, so it throws
 * regardless of NODE_ENV rather than silently truncating/padding.
 *
 * Key rotation (documented, not implemented this phase): the stored
 * ciphertext format is a versioned string ("v<N>:..."), and
 * social_connections.token_encryption_key_version records which version
 * encrypted a given row. To rotate: add a SOCIAL_TOKEN_ENCRYPTION_KEY_V2
 * env var, extend KEYS_BY_VERSION below with version 2, bump
 * CURRENT_KEY_VERSION, then run a one-off script that reads every
 * social_connections row, decrypts under its recorded
 * token_encryption_key_version, re-encrypts under the new current version,
 * and updates both the ciphertext and the version column. Only retire the
 * old env var once every row reports the new version.
 */
import crypto from 'crypto'
import logger from './logger'

const isProduction = process.env.NODE_ENV === 'production'

const ALGORITHM = 'aes-256-gcm'
const KEY_BYTES = 32
const IV_BYTES = 12 // 96-bit IV is the AES-GCM standard/recommended size

export const CURRENT_KEY_VERSION = 1

export class SecretEncryptionConfigError extends Error {}
export class SecretDecryptionError extends Error {}

function decodeAndValidateKey(envVarName: string, base64Value: string): Buffer {
  let key: Buffer
  try {
    key = Buffer.from(base64Value, 'base64')
  } catch {
    throw new SecretEncryptionConfigError(`${envVarName} is not valid base64.`)
  }
  if (key.length !== KEY_BYTES) {
    throw new SecretEncryptionConfigError(
      `${envVarName} must decode to exactly ${KEY_BYTES} bytes for AES-256-GCM (got ${key.length}). ` +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
    )
  }
  return key
}

function resolveKey(envVarName: string, versionLabel: string): Buffer {
  const value = process.env[envVarName]

  if (value && value.trim().length > 0) {
    return decodeAndValidateKey(envVarName, value.trim())
  }

  if (isProduction) {
    // Fail closed: never let production encrypt/decrypt OAuth tokens with a
    // guessable/shared literal key. Unlike jwt.config.ts's resolveSecret()
    // (called eagerly at import time), key resolution here is lazy --
    // deferred until the first actual encrypt/decrypt call -- so importing
    // this module never crashes an unrelated process; the very first real
    // use in a misconfigured production deploy throws immediately, before
    // any token is ever encrypted/decrypted with a hardcoded default.
    throw new SecretEncryptionConfigError(
      `${envVarName} is not set. Refusing to start in production without it. ` +
        'Set it in the production environment before deploying (see this file\'s header for how to generate one).',
    )
  }

  logger.warn(
    `${envVarName} is not set; using an insecure development-only default key (${versionLabel}). ` +
      'This is not safe outside local development.',
  )
  // Fixed, clearly-labeled 32-byte dev-only key -- never used if the env
  // var is actually set, and never reachable in production (see above).
  return crypto.createHash('sha256').update(`insecure-dev-only-social-token-key-${versionLabel}`).digest()
}

const KEYS_BY_VERSION: Record<number, () => Buffer> = {
  1: () => resolveKey('SOCIAL_TOKEN_ENCRYPTION_KEY', 'v1'),
}

function getKeyForVersion(version: number): Buffer {
  const resolver = KEYS_BY_VERSION[version]
  if (!resolver) {
    throw new SecretDecryptionError(`No encryption key configured for version ${version}.`)
  }
  return resolver()
}

/**
 * Encrypts `plaintext` under the current key version. Returns an opaque,
 * versioned string safe to store directly in a TEXT column --
 * "v<version>:<iv_b64>:<authTag_b64>:<ciphertext_b64>".
 */
export function encryptSecret(plaintext: string): string {
  const key = getKeyForVersion(CURRENT_KEY_VERSION)
  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [
    `v${CURRENT_KEY_VERSION}`,
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':')
}

/**
 * Decrypts a string produced by encryptSecret(). Throws
 * SecretDecryptionError on a malformed string, an unknown key version, or
 * (via AES-GCM's authentication tag) any tampering/corruption of the
 * ciphertext -- never returns a garbage plaintext.
 */
export function decryptSecret(stored: string): string {
  const parts = stored.split(':')
  if (parts.length !== 4) {
    throw new SecretDecryptionError('Malformed encrypted secret (expected 4 colon-separated parts).')
  }
  const [versionLabel, ivB64, authTagB64, ciphertextB64] = parts
  const versionMatch = /^v(\d+)$/.exec(versionLabel)
  if (!versionMatch) {
    throw new SecretDecryptionError(`Malformed encrypted secret (bad version label "${versionLabel}").`)
  }
  const version = Number(versionMatch[1])
  const key = getKeyForVersion(version)

  let iv: Buffer, authTag: Buffer, ciphertext: Buffer
  try {
    iv = Buffer.from(ivB64, 'base64')
    authTag = Buffer.from(authTagB64, 'base64')
    ciphertext = Buffer.from(ciphertextB64, 'base64')
  } catch {
    throw new SecretDecryptionError('Malformed encrypted secret (invalid base64).')
  }

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return plaintext.toString('utf8')
  } catch {
    // AES-GCM throws on auth-tag mismatch -- i.e. the ciphertext was
    // tampered with or decrypted under the wrong key. Never surface the
    // underlying crypto error (or a garbage plaintext) to the caller.
    throw new SecretDecryptionError('Failed to decrypt secret -- tampered ciphertext or wrong key.')
  }
}
