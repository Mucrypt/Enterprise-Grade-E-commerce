// Shared context passed down from CreatorDashboardLayout to every routed
// tab via <Outlet context={...} />. Identity-level data (who is this
// seller/creator, are they allowed in) is fetched once by the layout;
// each tab fetches only its own tab-specific data on mount.

import { useOutletContext } from 'react-router-dom'
import type { CreatorProfile, SellerProfile } from '../../types'

export interface CreatorDashboardContext {
  sellerProfile: SellerProfile | null
  creatorProfile: CreatorProfile | null
  setCreatorProfile: (profile: CreatorProfile | null) => void
  fallbackName: string
}

export function useCreatorDashboardContext() {
  return useOutletContext<CreatorDashboardContext>()
}
