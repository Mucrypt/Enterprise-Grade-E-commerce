import apiClient from '@/lib/api-client'

export interface BookReviewQueueItem {
  id: string
  title: string
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

export const bookService = {
  async getReviewQueue() {
    return await apiClient.get('/admin/books/review-queue')
  },

  async approveBook(bookId: string) {
    return await apiClient.post(`/admin/books/${bookId}/approve`)
  },

  async rejectBook(bookId: string, reason?: string) {
    return await apiClient.post(`/admin/books/${bookId}/reject`, {
      reason,
    })
  },
}