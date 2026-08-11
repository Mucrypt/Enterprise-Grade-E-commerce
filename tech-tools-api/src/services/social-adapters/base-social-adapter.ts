/**
 * Shared readiness/capability-reporting logic every platform adapter
 * builds on -- keeps the "is this connector actually usable in THIS
 * environment" check identical across all 6, rather than each adapter
 * reimplementing its own env-var reading.
 */
import { PlatformCapabilities, PlatformNotConfiguredError, PlatformReadiness, PublishError, SocialPlatform } from './social-adapter.types'

export interface StaticCapabilities extends Omit<PlatformCapabilities, 'platform' | 'readiness'> {}

export abstract class BaseSocialAdapter {
  abstract platform: SocialPlatform
  /** e.g. 'FACEBOOK' -- used to read SOCIAL_FACEBOOK_ENABLED / _CLIENT_ID / _CLIENT_SECRET. */
  protected abstract envPrefix: string
  protected abstract staticCapabilities: StaticCapabilities

  protected isEnabled(): boolean {
    return process.env[`SOCIAL_${this.envPrefix}_ENABLED`] === 'true'
  }

  protected clientId(): string | undefined {
    return process.env[`SOCIAL_${this.envPrefix}_CLIENT_ID`]
  }

  protected clientSecret(): string | undefined {
    return process.env[`SOCIAL_${this.envPrefix}_CLIENT_SECRET`]
  }

  getReadiness(): PlatformReadiness {
    if (!this.isEnabled()) return 'NOT_CONFIGURED'
    if (!this.clientId() || !this.clientSecret()) return 'NEEDS_CREDENTIALS'
    return 'AVAILABLE'
  }

  getCapabilities(): PlatformCapabilities {
    return {
      platform: this.platform,
      readiness: this.getReadiness(),
      ...this.staticCapabilities,
    }
  }

  /** Every buildAuthorizeUrl() implementation must call this first -- throws if the connector isn't actually usable here, so no adapter can ever hand back a URL for an OAuth exchange this deployment cannot complete. */
  protected assertAvailable(): void {
    const readiness = this.getReadiness()
    if (readiness !== 'AVAILABLE') {
      throw new PlatformNotConfiguredError(this.platform, readiness)
    }
  }

  protected requireClientId(): string {
    const id = this.clientId()
    if (!id) throw new PlatformNotConfiguredError(this.platform, this.getReadiness())
    return id
  }

  protected requireClientSecret(): string {
    const secret = this.clientSecret()
    if (!secret) throw new PlatformNotConfiguredError(this.platform, this.getReadiness())
    return secret
  }

  /**
   * Every adapter's publish() (and other real network calls whose failure
   * the queue must classify) should call fetch through this, not the raw
   * global `fetch`. A network-level exception (timeout, reset, DNS
   * failure -- fetch() itself throwing) means no definitive response was
   * ever received: whether the provider processed the request before the
   * connection failed cannot be known, so this is classified
   * REMOTE_STATE_UNKNOWN, never auto-retried. A non-2xx HTTP response IS
   * a definitive answer from the provider (even though it's an error),
   * classified by classifyHttpFailure() below.
   */
  protected async fetchOrThrow(url: string, init: RequestInit | undefined, describe: string): Promise<Response> {
    let res: Response
    try {
      res = await fetch(url, init)
    } catch (networkError) {
      const detail = networkError instanceof Error ? networkError.message : String(networkError)
      throw new PublishError(
        `${describe}: no response was received from ${this.platform} (${detail}) -- whether the request was processed cannot be determined.`,
        'REMOTE_STATE_UNKNOWN',
        'TRANSPORT_ERROR',
      )
    }
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw this.classifyHttpFailure(res.status, body, describe)
    }
    return res
  }

  /**
   * Best-effort, generic HTTP-status-based classification -- real
   * provider error-body shapes vary and cannot be verified without live
   * credentials (see the phase report's known-gaps section). Refine per
   * platform once real-world error responses are observed in production.
   */
  protected classifyHttpFailure(status: number, body: unknown, describe: string): PublishError {
    const message = `${describe}: ${this.extractErrorMessage(body) || `HTTP ${status}`}`
    if (status === 401) return new PublishError(message, 'DO_NOT_RETRY', 'AUTH_EXPIRED')
    if (status === 403) return new PublishError(message, 'DO_NOT_RETRY', 'MISSING_SCOPE')
    if (status === 429) return new PublishError(message, 'SAFE_TO_RETRY', 'RATE_LIMITED')
    if (status === 400 || status === 422) return new PublishError(message, 'DO_NOT_RETRY', 'INVALID_MEDIA_OR_CAPTION')
    if (status >= 500) return new PublishError(message, 'SAFE_TO_RETRY', 'TEMPORARY_PROVIDER_ERROR')
    return new PublishError(message, 'REMOTE_STATE_UNKNOWN', 'UNKNOWN_PROVIDER_ERROR')
  }

  private extractErrorMessage(body: unknown): string | null {
    if (body && typeof body === 'object') {
      const anyBody = body as Record<string, any>
      return (
        anyBody?.error?.message ||
        (typeof anyBody?.error === 'string' ? anyBody.error : null) ||
        anyBody?.message ||
        anyBody?.error_description ||
        anyBody?.detail ||
        null
      )
    }
    return null
  }
}
