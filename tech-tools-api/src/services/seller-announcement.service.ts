// Broadcast announcements to sellers -- see 073_seller_announcements.sql
// for the schema and the in-app-only-for-now rationale. A genuinely
// different shape than support_tickets (one-to-many, no thread, no
// assignment), so it gets its own small service rather than being bolted
// onto seller-support.service.ts.

import { query } from '../database/connection'

export interface SellerAnnouncement {
  id: string
  subject: string
  body: string
  target_tier: string | null
  created_by_admin_id: string
  created_at: string
}

const VALID_TIERS = ['unverified', 'basic', 'trusted', 'pro']

export async function createAnnouncement(params: {
  subject: string
  body: string
  targetTier?: string | null
  createdByAdminId: string
}): Promise<SellerAnnouncement> {
  const targetTier = params.targetTier && VALID_TIERS.includes(params.targetTier) ? params.targetTier : null

  const result = await query(
    `INSERT INTO seller_announcements (subject, body, target_tier, created_by_admin_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [params.subject.trim(), params.body.trim(), targetTier, params.createdByAdminId],
  )
  return result.rows[0]
}

export async function listForAdmin(
  { page = 1, limit = 20 }: { page?: number; limit?: number } = {},
): Promise<{
  items: (SellerAnnouncement & { readCount: number; totalRecipients: number })[]
  page: number
  total: number
}> {
  const offset = (page - 1) * limit

  const [itemsResult, totalResult] = await Promise.all([
    query(
      `SELECT
         sa.*,
         (SELECT COUNT(*)::int FROM seller_announcement_reads sar WHERE sar.announcement_id = sa.id) AS "readCount",
         (SELECT COUNT(*)::int FROM seller_profiles sp
            WHERE sa.target_tier IS NULL OR sp.tier = sa.target_tier) AS "totalRecipients"
       FROM seller_announcements sa
       ORDER BY sa.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    ),
    query(`SELECT COUNT(*)::int AS total FROM seller_announcements`),
  ])

  return { items: itemsResult.rows, page, total: totalResult.rows[0]?.total || 0 }
}

export async function listForSeller(
  sellerProfileId: string,
  tier: string,
): Promise<(SellerAnnouncement & { isRead: boolean })[]> {
  const result = await query(
    `SELECT sa.*, (sar.id IS NOT NULL) AS "isRead"
     FROM seller_announcements sa
     LEFT JOIN seller_announcement_reads sar
       ON sar.announcement_id = sa.id AND sar.seller_profile_id = $1
     WHERE sa.target_tier IS NULL OR sa.target_tier = $2
     ORDER BY sa.created_at DESC
     LIMIT 50`,
    [sellerProfileId, tier],
  )
  return result.rows
}

export async function markRead(announcementId: string, sellerProfileId: string): Promise<void> {
  await query(
    `INSERT INTO seller_announcement_reads (announcement_id, seller_profile_id)
     VALUES ($1, $2)
     ON CONFLICT (announcement_id, seller_profile_id) DO NOTHING`,
    [announcementId, sellerProfileId],
  )
}
