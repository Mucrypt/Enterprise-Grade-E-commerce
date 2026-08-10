import { FacebookAdapter } from './facebook.adapter'
import { InstagramAdapter } from './instagram.adapter'
import { TikTokAdapter } from './tiktok.adapter'
import { LinkedInAdapter } from './linkedin.adapter'
import { PinterestAdapter } from './pinterest.adapter'
import { XAdapter } from './x.adapter'
import { PlatformCapabilities, SOCIAL_PLATFORMS, SocialPlatform, SocialPublisherAdapter } from './social-adapter.types'

/**
 * The one place in this codebase that knows about all 6 concrete adapter
 * classes. Every controller/queue caller goes through getAdapter()/
 * getAllCapabilities() -- never imports a platform-specific class directly.
 */
const ADAPTERS: Record<SocialPlatform, SocialPublisherAdapter> = {
  FACEBOOK: new FacebookAdapter(),
  INSTAGRAM: new InstagramAdapter(),
  TIKTOK: new TikTokAdapter(),
  LINKEDIN: new LinkedInAdapter(),
  PINTEREST: new PinterestAdapter(),
  X: new XAdapter(),
}

export function getAdapter(platform: SocialPlatform): SocialPublisherAdapter {
  return ADAPTERS[platform]
}

export function getAllCapabilities(): PlatformCapabilities[] {
  return SOCIAL_PLATFORMS.map((platform) => ADAPTERS[platform].getCapabilities())
}
