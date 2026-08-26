// ============================================
// Delivery Estimate widget -- Amazon-style "FREE Delivery Thursday, 3
// September" line on the product detail page, resolved from the admin's
// delivery-template configuration (see tech-tools-api's
// shipping_delivery_templates). Never blocks the rest of the page: any
// fetch failure just renders nothing.
// ============================================

import { useEffect, useState } from 'react'
import { Truck, MapPin, Zap } from 'lucide-react'
import { productsApi } from '../../api'
import { useDeliveryLocationStore } from '../../stores'
import { COUNTRIES, countryNameFor } from '../../data/countries'

interface DeliveryEstimateData {
  standardLabel: string
  standardDateFrom: string
  standardDateTo: string
  expressLabel: string | null
  expressDate: string | null
  resolvedCountry: string | null
}

function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`)
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', day: 'numeric', month: 'long' }).format(date)
}

interface DeliveryEstimateProps {
  productId: string
}

export default function DeliveryEstimate({ productId }: DeliveryEstimateProps) {
  const { countryCode, setCountry } = useDeliveryLocationStore()
  const [estimate, setEstimate] = useState<DeliveryEstimateData | null>(null)
  const [loading, setLoading] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pendingCountry, setPendingCountry] = useState(countryCode || 'US')

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    productsApi
      .getDeliveryEstimate(productId, countryCode || undefined)
      .then((data) => {
        if (cancelled) return
        setEstimate(data)
        // First visit with no saved preference -- persist the server's IP
        // guess as non-explicit, so it's still freely overridable later.
        if (!countryCode && data.resolvedCountry) {
          setCountry(data.resolvedCountry, false)
        }
      })
      .catch(() => {
        if (!cancelled) setEstimate(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, countryCode])

  const handleSaveLocation = () => {
    setCountry(pendingCountry, true)
    setPickerOpen(false)
  }

  if (loading) {
    return (
      <div className='rounded-lg border bg-gray-50 p-3'>
        <div className='h-4 w-3/4 animate-pulse rounded bg-gray-200' />
      </div>
    )
  }

  if (!estimate) return null

  const displayCountry = countryNameFor(estimate.resolvedCountry)
  const sameDay = estimate.standardDateFrom === estimate.standardDateTo

  return (
    <div className='space-y-2 rounded-lg border bg-gray-50 p-3'>
      <div className='flex items-start gap-2'>
        <Truck className='mt-0.5 h-4 w-4 shrink-0 text-green-600' />
        <p className='text-sm'>
          <span className='font-semibold text-green-700'>{estimate.standardLabel}</span>{' '}
          <span className='font-medium text-gray-900'>{formatDate(estimate.standardDateTo)}</span>
          {!sameDay && <span className='text-gray-500'> (as early as {formatDate(estimate.standardDateFrom)})</span>}
        </p>
      </div>

      {estimate.expressDate && (
        <div className='flex items-start gap-2'>
          <Zap className='mt-0.5 h-4 w-4 shrink-0 text-orange-500' />
          <p className='text-sm text-gray-700'>
            {estimate.expressLabel} <span className='font-medium text-gray-900'>{formatDate(estimate.expressDate)}</span>
          </p>
        </div>
      )}

      <div className='flex items-start gap-2'>
        <MapPin className='mt-0.5 h-4 w-4 shrink-0 text-gray-400' />
        <div className='text-sm text-gray-600'>
          {displayCountry ? <>Delivering to {displayCountry} – </> : null}
          <button
            type='button'
            onClick={() => setPickerOpen((open) => !open)}
            className='font-medium text-orange-600 underline-offset-2 hover:underline'
          >
            Update location
          </button>

          {pickerOpen && (
            <div className='mt-2 flex flex-wrap items-center gap-2'>
              <select
                value={pendingCountry}
                onChange={(e) => setPendingCountry(e.target.value)}
                className='rounded-md border border-gray-300 bg-white px-2 py-1 text-sm'
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                type='button'
                onClick={handleSaveLocation}
                className='rounded-md bg-orange-500 px-3 py-1 text-sm font-medium text-white hover:bg-orange-600'
              >
                Save
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
