import apiClient from '@/lib/api-client'
import type { ApiResponse } from '@/types'

// Thin typed wrapper around GET /staff/activity-feed
// (tech-tools-api/src/api/v1/admin/admin.controller.ts's
// getGlobalActivityFeed, mounted in staff.routes.ts). Reads the same
// admin_activity_logs table as the pre-existing, unwired
// getAdminActivityLogs -- this is a separate, Command-Center-facing
// endpoint with its own global/scoped gate.

export interface ActivityFeedEntry {
  id: string
  action: string
  resourceType: string
  resourceId: string | null
  details: Record<string, unknown> | null
  createdAt: string
  actor: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
  }
}

export interface ActivityFeedResponse {
  scoped: boolean
  entries: ActivityFeedEntry[]
  message?: string
}

export const activityFeedService = {
  async getActivityFeed(limit = 20): Promise<ApiResponse<ActivityFeedResponse>> {
    return apiClient.get<ApiResponse<ActivityFeedResponse>>('/staff/activity-feed', {
      params: { limit },
    })
  },
}

export default activityFeedService
