/**
 * Shared readiness/capability-reporting logic every platform adapter
 * builds on -- keeps the "is this connector actually usable in THIS
 * environment" check identical across all 6, rather than each adapter
 * reimplementing its own env-var reading.
 */
import { PlatformCapabilities, PlatformNotConfiguredError, PlatformReadiness, SocialPlatform } from './social-adapter.types'

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
}
