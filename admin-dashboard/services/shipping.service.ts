/**
 * Shipping Service
 * API calls for shipping functionality in admin dashboard
 */

import { apiClient } from '@/lib/api-client'

// Types
export interface ShippingAddress {
  name: string
  company?: string
  street1: string
  street2?: string
  city: string
  state: string
  postalCode: string
  country: string
  phone?: string
  email?: string
  isResidential?: boolean
}

export interface Package {
  weight: number
  weightUnit: 'lb' | 'kg' | 'oz' | 'g'
  length: number
  width: number
  height: number
  dimensionUnit: 'in' | 'cm'
  value?: number
  description?: string
}

export interface ShippingRate {
  carrier: 'fedex' | 'ups' | 'dhl'
  serviceCode: string
  serviceName: string
  deliveryDays: number | null
  deliveryDate: string | null
  totalPrice: number
  currency: string
  guaranteed: boolean
  rateId?: string
}

export interface TrackingEvent {
  timestamp: string
  location: string
  description: string
  status: string
}

export interface TrackingInfo {
  carrier: 'fedex' | 'ups' | 'dhl'
  trackingNumber: string
  status: string
  statusDescription: string
  estimatedDelivery: string | null
  actualDelivery: string | null
  signedBy: string | null
  events: TrackingEvent[]
}

export interface ShipmentLabel {
  trackingNumber: string
  labelData: string
  labelFormat: string
  carrier: string
  serviceCode: string
  cost: number
}

export interface CarrierConfig {
  id: string
  carrier_code: string
  carrier_name: string
  is_active: boolean
  is_sandbox: boolean
  is_configured: boolean
  created_at: string
  updated_at: string
}

export interface ShippingSettings {
  id: number
  default_weight_unit: string
  default_dimension_unit: string
  default_country: string
  free_shipping_threshold: number | null
  handling_fee: number
  insurance_enabled: boolean
  signature_required: boolean
  origin_address?: ShippingAddress
  created_at: string
  updated_at: string
}

export interface CarrierCredentials {
  fedex?: {
    accountNumber: string
    apiKey: string
    secretKey: string
  }
  ups?: {
    accountNumber: string
    clientId: string
    clientSecret: string
  }
  dhl?: {
    siteId: string
    password: string
    accountNumber: string
  }
}

// API Functions

/**
 * Get shipping rates
 */
export async function getShippingRates(
  from: ShippingAddress,
  to: ShippingAddress,
  packages: Package[],
  carriers?: string[],
): Promise<{
  rates: ShippingRate[]
  fromAddress: ShippingAddress
  toAddress: ShippingAddress
}> {
  const response = await apiClient.post<{
    data: {
      rates: ShippingRate[]
      fromAddress: ShippingAddress
      toAddress: ShippingAddress
    }
  }>('/shipping/rates', {
    from,
    to,
    packages,
    carriers,
  })
  return response.data
}

/**
 * Track a shipment
 */
export async function trackShipment(
  trackingNumber: string,
  carrier: 'fedex' | 'ups' | 'dhl',
): Promise<TrackingInfo> {
  const response = await apiClient.get<{ data: TrackingInfo }>(
    `/shipping/track/${carrier}/${trackingNumber}`,
  )
  return response.data
}

/**
 * Create a shipment and get label
 */
export async function createShipment(params: {
  carrier: 'fedex' | 'ups' | 'dhl'
  from: ShippingAddress
  to: ShippingAddress
  packages: Package[]
  serviceCode: string
  labelFormat?: 'PDF' | 'PNG' | 'ZPL'
  reference?: string
  orderId?: string
}): Promise<ShipmentLabel> {
  const response = await apiClient.post<{ data: ShipmentLabel }>(
    '/shipping/admin/shipments',
    params,
  )
  return response.data
}

/**
 * Validate an address
 */
export async function validateAddress(
  address: ShippingAddress,
  carrier?: 'fedex' | 'ups' | 'dhl',
): Promise<{ valid: boolean; suggestions?: ShippingAddress[] }> {
  const response = await apiClient.post<{
    data: { valid: boolean; suggestions?: ShippingAddress[] }
  }>('/shipping/validate-address', {
    address,
    carrier,
  })
  return response.data
}

/**
 * Get carrier services
 */
export async function getCarrierServices(
  carrier?: 'fedex' | 'ups' | 'dhl',
): Promise<Record<string, { code: string; name: string }[]>> {
  const url = carrier ? `/shipping/services/${carrier}` : '/shipping/services'
  const response = await apiClient.get<{
    data: Record<string, { code: string; name: string }[]>
  }>(url)
  return response.data
}

/**
 * Get enabled carriers
 */
export async function getEnabledCarriers(): Promise<{
  enabled: string[]
  carriers: CarrierConfig[]
}> {
  const response = await apiClient.get<{
    data: { enabled: string[]; carriers: CarrierConfig[] }
  }>('/shipping/admin/carriers')
  return response.data
}

/**
 * Get carrier configurations
 */
export async function getCarrierConfigs(): Promise<CarrierConfig[]> {
  const response = await apiClient.get<{ data: CarrierConfig[] }>(
    '/shipping/admin/carriers/config',
  )
  return response.data
}

/**
 * Update carrier configuration
 */
export async function updateCarrierConfig(
  carrierCode: string,
  config: {
    isActive?: boolean
    isSandbox?: boolean
    credentials?: Record<string, string>
  },
): Promise<CarrierConfig> {
  const response = await apiClient.put<{ data: CarrierConfig }>(
    `/shipping/admin/carriers/${carrierCode}`,
    config,
  )
  return response.data
}

/**
 * Get shipping settings
 */
export async function getShippingSettings(): Promise<ShippingSettings> {
  const response = await apiClient.get<{ data: ShippingSettings }>(
    '/shipping/admin/settings',
  )
  return response.data
}

/**
 * Update shipping settings
 */
export async function updateShippingSettings(settings: {
  defaultWeightUnit?: string
  defaultDimensionUnit?: string
  defaultCountry?: string
  freeShippingThreshold?: number | null
  handlingFee?: number
  insuranceEnabled?: boolean
  signatureRequired?: boolean
  originAddress?: ShippingAddress
}): Promise<ShippingSettings> {
  const response = await apiClient.put<{ data: ShippingSettings }>(
    '/shipping/admin/settings',
    settings,
  )
  return response.data
}

/**
 * Get order shipping labels
 */
export async function getOrderLabels(orderId: string): Promise<
  {
    id: string
    carrier: string
    service_code: string
    tracking_number: string
    label_format: string
    cost: number
    status: string
    created_at: string
  }[]
> {
  const response = await apiClient.get<{
    data: {
      id: string
      carrier: string
      service_code: string
      tracking_number: string
      label_format: string
      cost: number
      status: string
      created_at: string
    }[]
  }>(`/shipping/admin/orders/${orderId}/labels`)
  return response.data
}

/**
 * Cancel a shipment
 */
export async function cancelShipment(
  trackingNumber: string,
  carrier: 'fedex' | 'ups' | 'dhl',
): Promise<boolean> {
  const response = await apiClient.delete<{ success: boolean }>(
    `/shipping/admin/shipments/${carrier}/${trackingNumber}`,
  )
  return response.success
}

/**
 * Calculate shipping for checkout
 */
export async function calculateCheckoutShipping(
  items: { productId: string; quantity: number; price: number }[],
  shippingAddress: ShippingAddress,
): Promise<{
  rates: ShippingRate[]
  qualifiesForFreeShipping: boolean
  freeShippingThreshold: number | null
  orderValue: number
  handlingFee: number
}> {
  const response = await apiClient.post<{
    data: {
      rates: ShippingRate[]
      qualifiesForFreeShipping: boolean
      freeShippingThreshold: number | null
      orderValue: number
      handlingFee: number
    }
  }>('/shipping/calculate', {
    items: items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      price: item.price,
    })),
    shippingAddress,
  })
  return response.data
}

// Helper functions

export function getCarrierLogo(carrier: string): string {
  const logos: Record<string, string> = {
    fedex: '/carriers/fedex.svg',
    ups: '/carriers/ups.svg',
    dhl: '/carriers/dhl.svg',
  }
  return logos[carrier] || '/carriers/default.svg'
}

export function getCarrierColor(carrier: string): string {
  const colors: Record<string, string> = {
    fedex: '#4D148C',
    ups: '#351C15',
    dhl: '#FFCC00',
  }
  return colors[carrier] || '#6B7280'
}

export function formatDeliveryTime(days: number | null): string {
  if (days === null) return 'Varies'
  if (days === 0) return 'Same Day'
  if (days === 1) return '1 Business Day'
  return `${days} Business Days`
}

export function getTrackingUrl(
  carrier: string,
  trackingNumber: string,
): string {
  const urls: Record<string, string> = {
    fedex: `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
    ups: `https://www.ups.com/track?tracknum=${trackingNumber}`,
    dhl: `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`,
  }
  return urls[carrier] || '#'
}
