import { apiClient } from '@/lib/api-client'

export interface LiveSession {
  id: string
  sellerProfileId: string
  title: string
  status: 'scheduled' | 'live' | 'ended' | 'errored'
  ivsIngestEndpoint: string | null
  ivsPlaybackUrl: string | null
  thumbnailUrl: string | null
  scheduledStartAt: string | null
  startedAt: string | null
  endedAt: string | null
  viewerCountPeak: number
  createdAt: string
  sellerDisplayName?: string | null
  sellerHandle?: string | null
}

export const liveService = {
  // Public endpoint, same one the mobile Discover feed's "Live Now" rail
  // uses -- the admin monitor page reuses it rather than a second
  // "list all sessions" query, since "currently live" is exactly what
  // needs watching for the kill switch.
  async getLiveNow() {
    return await apiClient.get<{ success: boolean; data: { sessions: LiveSession[] } }>(
      '/live/sessions',
    )
  },

  // The real safety mechanism -- stops the AWS-side stream (not just a
  // DB status flip), gated admin-only server-side regardless of what
  // this client sends.
  async forceEnd(sessionId: string) {
    return await apiClient.post<{ success: boolean; data: LiveSession }>(
      `/admin/live/sessions/${sessionId}/force-end`,
      {},
    )
  },
}
