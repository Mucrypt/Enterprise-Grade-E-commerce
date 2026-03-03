// ============================================
// TechTools Mobile App - useDebounce Hook
// ============================================

import { useState, useEffect } from 'react'

/**
 * Debounces a value by the specified delay.
 * Returns the debounced value that updates only after the delay has passed.
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

export default useDebounce
