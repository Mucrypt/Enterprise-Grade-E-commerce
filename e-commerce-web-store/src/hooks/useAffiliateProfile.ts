// Page-scoped fetch hook for the Refer & Earn page -- this data is
// per-logged-in-user and needed on exactly one page, unlike e.g. the
// free-shipping threshold (needed app-wide, so that one lives in a
// dedicated hook backed by a fetch-once-on-mount pattern instead).
import { useQuery } from '@tanstack/react-query'
import { affiliatesApi } from '../api'
import { useAuthStore } from '../stores'

export function useAffiliateStats() {
  const { isAuthenticated, hasHydrated } = useAuthStore()

  return useQuery({
    queryKey: ['affiliate-stats'],
    queryFn: () => affiliatesApi.getMyStats(),
    enabled: hasHydrated && isAuthenticated,
    staleTime: 30_000,
  })
}
