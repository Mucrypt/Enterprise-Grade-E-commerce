// ============================================
// Delivery estimate templates service
// ============================================
// Admin-editable "FREE Delivery Thursday, 3 September" date-range rules,
// resolved per (product, country) for the storefront PDP widget. Separate
// from the live-carrier-rate shipping.service.ts -- this is marketing copy,
// not real shipping cost/tracking.

import { apiClient } from '@/lib/api-client'

export type DeliveryTemplateScope = 'global' | 'location' | 'category'

export interface DeliveryTemplate {
  id: string
  name: string
  scope_type: DeliveryTemplateScope
  countries: string[]
  processing_days_min: number
  processing_days_max: number
  transit_days_min: number
  transit_days_max: number
  express_transit_days_min: number | null
  express_transit_days_max: number | null
  skip_weekends: boolean
  standard_label: string
  express_label: string
  is_active: boolean
  is_default: boolean
  category_ids: string[]
  created_at: string
  updated_at: string
}

export interface DeliveryTemplatePayload {
  name: string
  scopeType: DeliveryTemplateScope
  countries?: string[]
  categoryIds?: string[]
  processingDaysMin?: number
  processingDaysMax?: number
  transitDaysMin?: number
  transitDaysMax?: number
  expressTransitDaysMin?: number | null
  expressTransitDaysMax?: number | null
  skipWeekends?: boolean
  standardLabel?: string
  expressLabel?: string
  isActive?: boolean
  isDefault?: boolean
}

async function listTemplates() {
  return apiClient.get<{ success: true; templates: DeliveryTemplate[] }>('/shipping/delivery-templates')
}

async function createTemplate(payload: DeliveryTemplatePayload) {
  return apiClient.post<{ success: true; data: { id: string } } | { success: false; error: string }>(
    '/shipping/delivery-templates',
    payload,
  )
}

async function updateTemplate(id: string, payload: Partial<DeliveryTemplatePayload>) {
  return apiClient.patch<{ success: true } | { success: false; error: string }>(`/shipping/delivery-templates/${id}`, payload)
}

async function deleteTemplate(id: string) {
  return apiClient.delete<{ success: true } | { success: false; error: string }>(`/shipping/delivery-templates/${id}`)
}

export const deliveryTemplateService = {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
}

export default deliveryTemplateService
