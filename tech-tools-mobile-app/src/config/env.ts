// ============================================
// TechTools Mobile App - Environment Configuration
// ============================================
//
// Single source of truth for environment-dependent config (API base URL,
// derived image base URL, environment tier). Every other module must import
// from here instead of hardcoding a URL or reading process.env.EXPO_PUBLIC_*
// directly, so there is exactly one place that decides what happens when a
// build's environment isn't configured.
//
// EXPO_PUBLIC_* variables are inlined at bundle time by Expo/Metro. For a
// real build (development client, staging, or production via `eas build`),
// they come from the matching profile's `env` block in eas.json. For local
// `expo start`, Expo automatically loads `.env.local` / `.env` in this
// directory (see .env.example) -- neither is committed.

export type AppEnv = 'development' | 'staging' | 'production'

const RAW_APP_ENV = process.env.EXPO_PUBLIC_APP_ENV
const APP_ENV: AppEnv =
  RAW_APP_ENV === 'staging' || RAW_APP_ENV === 'production'
    ? RAW_APP_ENV
    : 'development'

const LOCAL_DEV_API_URL = 'http://localhost:9000/api/v1'

function resolveApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL

  if (configured && configured.trim().length > 0) {
    return configured.trim().replace(/\/+$/, '')
  }

  if (APP_ENV === 'development') {
    // Safe to default for local iteration only. A physical device/simulator
    // reaching an actual dev machine still needs EXPO_PUBLIC_API_URL set to
    // that machine's LAN address in .env.local -- this default only covers
    // the common "API running on the same machine" case.
    console.warn(
      `[env] EXPO_PUBLIC_API_URL is not set; defaulting to ${LOCAL_DEV_API_URL} for local development. ` +
        'Create a .env.local (see .env.example) to point at your dev API instead.',
    )
    return LOCAL_DEV_API_URL
  }

  // staging/production builds must never silently fall back to localhost or
  // to the production URL -- a missing value here is a build configuration
  // bug and must fail loudly, not route traffic to the wrong backend.
  throw new Error(
    `[env] EXPO_PUBLIC_API_URL is not configured for the "${APP_ENV}" build. ` +
      'Set it in the matching profile\'s env block in eas.json before building.',
  )
}

export const API_BASE_URL = resolveApiBaseUrl()

// The API and its media are served from the same origin; derive the image
// host from the API URL instead of requiring a second variable to keep in
// sync.
export const IMAGE_BASE_URL = API_BASE_URL.replace(/\/api\/v1\/?$/, '')

export { APP_ENV }
