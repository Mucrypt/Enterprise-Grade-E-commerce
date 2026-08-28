// ============================================
// Category attribute definitions service
// ============================================
// Structured, admin-defined attributes per category (Voltage, Material,
// Power Source...) -- deliberately separate from the free-text
// product_specifications system (see EnhancedProductForm's Attributes tab
// and this feature's own migration comments). Only 'select'-type
// attributes carry real filter value.

import apiClient from '@/lib/api-client'
import type { ApiResponse } from '@/types'

export type AttributeInputType = 'text' | 'number' | 'select'

export interface CategoryAttribute {
  id: string
  category_id: string
  name: string
  input_type: AttributeInputType
  options: string[] | null
  unit: string | null
  display_order: number
  is_filterable: boolean
}

export interface CategoryAttributePayload {
  categoryId: string
  name: string
  inputType: AttributeInputType
  options?: string[] | null
  unit?: string | null
  displayOrder?: number
  isFilterable?: boolean
}

export const categoryAttributeService = {
  async listForCategory(
    categoryId: string,
  ): Promise<ApiResponse<{ attributes: CategoryAttribute[] }>> {
    return apiClient.get<ApiResponse<{ attributes: CategoryAttribute[] }>>(
      `/categories/${categoryId}/attributes`,
    )
  },

  async create(
    payload: CategoryAttributePayload,
  ): Promise<ApiResponse<{ attribute: CategoryAttribute }>> {
    return apiClient.post<ApiResponse<{ attribute: CategoryAttribute }>>(
      '/category-attributes',
      payload,
    )
  },

  async update(
    id: string,
    payload: Partial<Omit<CategoryAttributePayload, 'categoryId'>>,
  ): Promise<ApiResponse<{ attribute: CategoryAttribute }>> {
    return apiClient.patch<ApiResponse<{ attribute: CategoryAttribute }>>(
      `/category-attributes/${id}`,
      payload,
    )
  },

  async remove(id: string): Promise<ApiResponse<{ message: string }>> {
    return apiClient.delete<ApiResponse<{ message: string }>>(
      `/category-attributes/${id}`,
    )
  },
}

export default categoryAttributeService
