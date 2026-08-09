import logger from '../utils/logger'

// Single authoritative source for JWT secrets. Every place in the API that
// signs or verifies a token must import JWT_SECRET / JWT_REFRESH_SECRET from
// here instead of reading process.env directly, so there is exactly one
// resolution rule instead of several different inline fallbacks.

const isProduction = process.env.NODE_ENV === 'production'

function resolveSecret(envVarName: string, devFallback: string): string {
  const value = process.env[envVarName]

  if (value && value.trim().length > 0) {
    return value
  }

  if (isProduction) {
    // Fail closed: never let production run with a guessable/shared literal
    // secret. This throws at module-load time, which happens very early in
    // the app's import chain (before the HTTP server starts listening), so
    // a misconfigured production deploy crashes on boot with a clear error
    // instead of silently signing/verifying tokens with a hardcoded default.
    throw new Error(
      `${envVarName} is not set. Refusing to start in production without it. ` +
        'Set it in the production environment before deploying.',
    )
  }

  logger.warn(
    `${envVarName} is not set; using an insecure development-only default. ` +
      'This is not safe outside local development.',
  )
  return devFallback
}

export const JWT_SECRET = resolveSecret(
  'JWT_SECRET',
  'insecure-dev-only-jwt-secret',
)

export const JWT_REFRESH_SECRET = resolveSecret(
  'JWT_REFRESH_SECRET',
  'insecure-dev-only-jwt-refresh-secret',
)

export const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m'
export const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d'
