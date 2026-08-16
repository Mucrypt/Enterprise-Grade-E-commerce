import { TikTokShopAdapter } from './tiktok-shop/tiktok-shop.adapter'
import { CHANNEL_TYPES, ChannelAdapter, ChannelCapabilities, ChannelType } from './channel-account.types'

/**
 * The one place in this codebase that knows about all concrete
 * channel-adapter classes. Every controller/worker caller goes through
 * getChannelAdapter()/getAllChannelCapabilities() -- never imports a
 * channel-specific class directly. Only TIKTOK_SHOP exists this phase;
 * a future Amazon/eBay adapter registers here the same way.
 */
const ADAPTERS: Record<ChannelType, ChannelAdapter> = {
  TIKTOK_SHOP: new TikTokShopAdapter(),
}

export function getChannelAdapter(channelType: ChannelType): ChannelAdapter {
  return ADAPTERS[channelType]
}

export function getAllChannelCapabilities(): ChannelCapabilities[] {
  return CHANNEL_TYPES.map((channelType) => ADAPTERS[channelType].getCapabilities())
}
