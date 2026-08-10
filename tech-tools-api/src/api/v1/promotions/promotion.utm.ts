/**
 * Builds the consistent first-party UTM-tagged URL used on every outbound
 * campaign link, across every channel. Deliberately reuses the EXISTING
 * Analytics 2.0 Acquisition attribution model -- user_sessions.utm_source/
 * utm_medium/utm_campaign/utm_content already exist and are already
 * captured at session start (see analytics-v2.controller.ts's
 * getAcquisition()); this file only produces URLs those columns already
 * know how to read. No new analytics table or attribution engine.
 */
import { SocialPlatform } from '../../../services/social-adapters/social-adapter.types'

export interface UtmParams {
  platform: SocialPlatform
  /** promotion_campaigns.campaign_key -- the canonical, unique campaign identifier. */
  campaignKey: string
  /** promotion_channel_posts.id -- distinguishes which channel-specific post/variant drove a given visit. */
  channelPostId: string
}

/**
 * Appends utm_source/utm_medium/utm_campaign/utm_content to `baseUrl`,
 * preserving any existing query parameters on it. utm_medium is always
 * 'social' -- this builder is only ever used for the 6 social channels;
 * newsletter/WhatsApp attribution stays inside their own existing systems
 * (see docs/SOCIAL-PUBLISHING-ARCHITECTURE.md's integration notes).
 */
export function buildUtmUrl(baseUrl: string, params: UtmParams): string {
  const url = new URL(baseUrl)
  url.searchParams.set('utm_source', params.platform.toLowerCase())
  url.searchParams.set('utm_medium', 'social')
  url.searchParams.set('utm_campaign', params.campaignKey)
  url.searchParams.set('utm_content', params.channelPostId)
  return url.toString()
}
