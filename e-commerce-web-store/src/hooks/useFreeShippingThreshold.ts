import { useEffect } from 'react'
import { useShippingSettingsStore } from '../stores/shippingSettingsStore'

/** Real, admin-configured free-shipping threshold, or null until loaded/unconfigured. */
export function useFreeShippingThreshold(): number | null {
  const { freeShippingThreshold, fetchOnce } = useShippingSettingsStore()
  useEffect(() => {
    fetchOnce()
  }, [fetchOnce])
  return freeShippingThreshold
}
