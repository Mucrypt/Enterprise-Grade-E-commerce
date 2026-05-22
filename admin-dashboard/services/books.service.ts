import apiClient from '@/lib/api-client'

export interface BookReviewQueueItem {
  id: string
  name?: string
  title?: string
  creator_name?: string
  creatorName?: string
  publication_status?: string
  publicationStatus?: string
  moderation_status?: string
  moderationStatus?: string
  submitted_at?: string
  submittedAt?: string
  updated_at?: string
  updatedAt?: string
  available_formats?: string[]
  availableFormats?: string[]
}

export interface AdminCreateBookPayload {
  name: string
  slug?: string
  description?: string
  shortDescription?: string
  basePrice: number
  salePrice?: number
  format?: 'pdf' | 'epub' | 'mobi' | 'azw3' | 'html' | 'audio'
  languageCode?: string
  publicationAction?: 'draft' | 'submit' | 'publish'
  moderationNotes?: string
  idempotencyKey?: string
}

export const bookService = {
  async getReviewQueue() {
    return await apiClient.get('/admin/books/review-queue')
  },

  async approveBook(bookId: string) {
    return await apiClient.post(`/admin/books/${bookId}/approve`)
  },

  async rejectBook(bookId: string, reason?: string) {
    return await apiClient.post(`/admin/books/${bookId}/reject`, {
      moderationNotes: reason,
    })
  },

  async createBook(payload: AdminCreateBookPayload) {
    return await apiClient.post('/admin/books', payload)
  },

  async uploadBookAssets(bookId: string, files: File[], payload?: {
    assetType?: 'full' | 'sample' | 'cover' | 'audio'
    formatKey?: string
    label?: string
    idempotencyKey?: string
  }) {
    const formData = new FormData()
    for (const file of files) {
      formData.append('files', file)
    }

    if (payload?.assetType) formData.append('assetType', payload.assetType)
    if (payload?.formatKey) formData.append('formatKey', payload.formatKey)
    if (payload?.label) formData.append('label', payload.label)
    if (payload?.idempotencyKey) {
      formData.append('idempotencyKey', payload.idempotencyKey)
    }

    return await apiClient.postFormData(`/admin/books/${bookId}/assets`, formData)
  },

  async submitBook(bookId: string, notes?: string) {
    return await apiClient.post(`/admin/books/${bookId}/submit`, { notes })
  },

  async publishBook(bookId: string, moderationNotes?: string) {
    return await apiClient.post(`/admin/books/${bookId}/publish`, {
      moderationNotes,
    })
  },
}