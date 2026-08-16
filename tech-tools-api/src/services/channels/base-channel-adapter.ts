/**
 * Shared readiness/capability-reporting + network-failure-classification
 * logic every channel adapter builds on. Direct structural clone of
 * services/social-adapters/base-social-adapter.ts -- same
 * fetchOrThrow()/classifyHttpFailure() model, same
 * SAFE_TO_RETRY/DO_NOT_RETRY/REMOTE_STATE_UNKNOWN classification -- but a
 * separate class in a separate module tree, since this is a genuinely
 * different domain (commerce channels, not social publishing) that should
 * never import from or be confused with social-adapters/.
 */
import {
  ChannelCapabilities,
  ChannelNotConfiguredError,
  ChannelReadiness,
  ChannelSyncError,
  ChannelType,
} from './channel-account.types'

export interface StaticChannelCapabilities extends Omit<ChannelCapabilities, 'channelType' | 'readiness'> {}

/**
 * Exported standalone (not a class method) so it's directly unit-testable
 * without instantiating an adapter or mocking fetch. `retryAfterSeconds`,
 * when present, is authoritative -- TikTok told us exactly when to come
 * back. Otherwise: exponential backoff (attempt 1=1s, 2=2s, 3=4s, capped at
 * 8s) plus up to 250ms of jitter, matching the general pattern documented
 * for TikTok Shop's rate limiting (third-party-sourced -- TikTok's own
 * docs did not confirm a specific backoff algorithm; see
 * docs/TIKTOK-SHOP-INTEGRATION-ARCHITECTURE.md).
 */
export function computeBackoffDelayMs(attempt: number, retryAfterSeconds?: number): number {
  if (typeof retryAfterSeconds === 'number' && Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return retryAfterSeconds * 1000
  }
  const exponentialMs = Math.min(2 ** attempt * 500, 8000)
  const jitterMs = Math.random() * 250
  return exponentialMs + jitterMs
}

export abstract class BaseChannelAdapter {
  abstract channelType: ChannelType
  /** e.g. 'TIKTOK_SHOP' -- used to read CHANNEL_<TYPE>_ENABLED / _APP_KEY / _APP_SECRET. */
  protected abstract envPrefix: string
  protected abstract staticCapabilities: StaticChannelCapabilities

  protected isEnabled(): boolean {
    return process.env[`CHANNEL_${this.envPrefix}_ENABLED`] === 'true'
  }

  protected appKey(): string | undefined {
    return process.env[`CHANNEL_${this.envPrefix}_APP_KEY`]
  }

  protected appSecret(): string | undefined {
    return process.env[`CHANNEL_${this.envPrefix}_APP_SECRET`]
  }

  getReadiness(): ChannelReadiness {
    if (!this.isEnabled()) return 'NOT_CONFIGURED'
    if (!this.appKey() || !this.appSecret()) return 'NEEDS_CREDENTIALS'
    return 'AVAILABLE'
  }

  getCapabilities(): ChannelCapabilities {
    return {
      channelType: this.channelType,
      readiness: this.getReadiness(),
      ...this.staticCapabilities,
    }
  }

  /** Every buildAuthorizeUrl() implementation must call this first -- throws if the connector isn't actually usable here, so no adapter can ever hand back a URL for an OAuth exchange this deployment cannot complete. */
  protected assertAvailable(): void {
    const readiness = this.getReadiness()
    if (readiness !== 'AVAILABLE') {
      throw new ChannelNotConfiguredError(this.channelType, readiness)
    }
  }

  protected requireAppKey(): string {
    const key = this.appKey()
    if (!key) throw new ChannelNotConfiguredError(this.channelType, this.getReadiness())
    return key
  }

  protected requireAppSecret(): string {
    const secret = this.appSecret()
    if (!secret) throw new ChannelNotConfiguredError(this.channelType, this.getReadiness())
    return secret
  }

  /**
   * Every adapter's real network calls should go through this, not the raw
   * global `fetch`. A network-level exception (timeout, reset, DNS
   * failure) means no definitive response was ever received -- classified
   * REMOTE_STATE_UNKNOWN, never auto-retried. A non-2xx HTTP response IS a
   * definitive answer from the channel (even though it's an error),
   * classified by classifyHttpFailure() below.
   */
  protected async fetchOrThrow(url: string, init: RequestInit | undefined, describe: string): Promise<Response> {
    let res: Response
    try {
      res = await fetch(url, init)
    } catch (networkError) {
      const detail = networkError instanceof Error ? networkError.message : String(networkError)
      throw new ChannelSyncError(
        `${describe}: no response was received from ${this.channelType} (${detail}) -- whether the request was processed cannot be determined.`,
        'REMOTE_STATE_UNKNOWN',
        'TRANSPORT_ERROR',
      )
    }
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      const retryAfterSeconds = this.parseRetryAfterSeconds(res.headers.get('retry-after'))
      throw this.classifyHttpFailure(res.status, body, describe, retryAfterSeconds)
    }
    return res
  }

  /**
   * Production Review Round 1 (§26/§27): a read-only GET failure has no
   * external side effect, so a SAFE_TO_RETRY classification (429/5xx) is
   * retried a bounded number of times, in-process, before giving up --
   * rather than the caller simply failing the whole run and waiting for
   * the next scheduled poll (which could be many minutes away). Honors a
   * real `Retry-After` header when the channel supplies one (authoritative
   * over any computed delay); otherwise falls back to exponential backoff
   * with jitter. Never retries DO_NOT_RETRY/REMOTE_STATE_UNKNOWN -- those
   * classifications exist precisely because retrying them is unsafe or
   * pointless.
   */
  protected async fetchOrThrowWithRetry(
    url: string,
    init: RequestInit | undefined,
    describe: string,
    maxAttempts = 3,
  ): Promise<Response> {
    let attempt = 0
    for (;;) {
      attempt += 1
      try {
        return await this.fetchOrThrow(url, init, describe)
      } catch (error) {
        const isRetryable = error instanceof ChannelSyncError && error.classification === 'SAFE_TO_RETRY'
        if (!isRetryable || attempt >= maxAttempts) {
          throw error
        }
        const retryAfterSeconds = error instanceof ChannelSyncError ? error.retryAfterSeconds : undefined
        await this.sleepMs(computeBackoffDelayMs(attempt, retryAfterSeconds))
      }
    }
  }

  /** Overridable seam so tests never actually wait for a real backoff delay. */
  protected sleepMs(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private parseRetryAfterSeconds(headerValue: string | null): number | undefined {
    if (!headerValue) return undefined
    const seconds = Number(headerValue)
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined
  }

  /**
   * Best-effort, generic HTTP-status-based classification -- real
   * TikTok Shop error-body shapes cannot be verified without live
   * developer credentials. Refine once real-world error responses are
   * observed against Partner Center.
   */
  protected classifyHttpFailure(status: number, body: unknown, describe: string, retryAfterSeconds?: number): ChannelSyncError {
    const message = `${describe}: ${this.extractErrorMessage(body) || `HTTP ${status}`}`
    if (status === 401) return new ChannelSyncError(message, 'DO_NOT_RETRY', 'AUTH_EXPIRED')
    if (status === 403) return new ChannelSyncError(message, 'DO_NOT_RETRY', 'MISSING_SCOPE')
    if (status === 429) return new ChannelSyncError(message, 'SAFE_TO_RETRY', 'RATE_LIMITED', retryAfterSeconds)
    if (status === 400 || status === 422) return new ChannelSyncError(message, 'DO_NOT_RETRY', 'INVALID_PRODUCT')
    if (status >= 500) return new ChannelSyncError(message, 'SAFE_TO_RETRY', 'TEMPORARY_PROVIDER_ERROR')
    return new ChannelSyncError(message, 'REMOTE_STATE_UNKNOWN', 'UNKNOWN_REMOTE_STATE')
  }

  private extractErrorMessage(body: unknown): string | null {
    if (body && typeof body === 'object') {
      const anyBody = body as Record<string, any>
      return (
        anyBody?.message ||
        (typeof anyBody?.error === 'string' ? anyBody.error : anyBody?.error?.message) ||
        anyBody?.error_description ||
        anyBody?.detail ||
        null
      )
    }
    return null
  }
}
