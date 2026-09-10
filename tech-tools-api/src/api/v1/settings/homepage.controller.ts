/**
 * Homepage Settings Controller
 * Real, admin-editable copy for the homepage hero / workshop banner /
 * business banner / newsletter sections -- both storefronts (web, mobile)
 * read this instead of a hardcoded config file, with that same static
 * config kept client-side only as a fallback if this request fails.
 */

import { Request, Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import { query } from '../../../database/connection'
import logger from '../../../utils/logger'

const SECTION_COLUMNS = [
  'hero',
  'workshop_banner',
  'business_banner',
  'newsletter',
] as const
type SectionColumn = (typeof SECTION_COLUMNS)[number]

/**
 * GET /settings/homepage/public
 * Public -- both storefronts fetch this on every homepage load.
 */
export const getPublicHomepageSettings = async (
  _req: Request,
  res: Response,
) => {
  try {
    const result = await query(
      `SELECT hero, workshop_banner, business_banner, newsletter
       FROM homepage_settings WHERE id = 1`,
    )

    res.json({
      success: true,
      data: result.rows[0] || {
        hero: {},
        workshop_banner: {},
        business_banner: {},
        newsletter: {},
      },
    })
  } catch (error) {
    logger.error('Get public homepage settings error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get homepage settings',
    })
  }
}

/**
 * GET /settings/homepage/admin
 * Admin -- same data as the public endpoint today, but a separate,
 * authenticated route so the admin form has a stable place to read from
 * even if the public shape is ever trimmed down later.
 */
export const getHomepageSettings = async (
  _req: AuthRequest,
  res: Response,
) => {
  try {
    const result = await query(`SELECT * FROM homepage_settings WHERE id = 1`)

    res.json({
      success: true,
      data: result.rows[0] || null,
    })
  } catch (error) {
    logger.error('Get homepage settings error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get homepage settings',
    })
  }
}

/**
 * PUT /settings/homepage/admin
 * Body: { hero?, workshopBanner?, businessBanner?, newsletter? } -- each
 * a full section object (the admin form always submits a whole section
 * together), COALESCE'd against the existing row so omitting a section
 * entirely leaves it untouched.
 */
export const updateHomepageSettings = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const { hero, workshopBanner, businessBanner, newsletter } = req.body
    const userId = req.user?.id

    const values: Record<SectionColumn, unknown> = {
      hero: hero ?? null,
      workshop_banner: workshopBanner ?? null,
      business_banner: businessBanner ?? null,
      newsletter: newsletter ?? null,
    }

    const result = await query(
      `INSERT INTO homepage_settings (id, hero, workshop_banner, business_banner, newsletter, updated_by, updated_at)
       VALUES (1, COALESCE($1::jsonb, '{}'::jsonb), COALESCE($2::jsonb, '{}'::jsonb), COALESCE($3::jsonb, '{}'::jsonb), COALESCE($4::jsonb, '{}'::jsonb), $5, NOW())
       ON CONFLICT (id) DO UPDATE SET
         hero = COALESCE($1::jsonb, homepage_settings.hero),
         workshop_banner = COALESCE($2::jsonb, homepage_settings.workshop_banner),
         business_banner = COALESCE($3::jsonb, homepage_settings.business_banner),
         newsletter = COALESCE($4::jsonb, homepage_settings.newsletter),
         updated_by = $5,
         updated_at = NOW()
       RETURNING *`,
      [
        values.hero ? JSON.stringify(values.hero) : null,
        values.workshop_banner ? JSON.stringify(values.workshop_banner) : null,
        values.business_banner ? JSON.stringify(values.business_banner) : null,
        values.newsletter ? JSON.stringify(values.newsletter) : null,
        userId || null,
      ],
    )

    res.json({
      success: true,
      message: 'Homepage settings updated successfully',
      data: result.rows[0],
    })
  } catch (error) {
    logger.error('Update homepage settings error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update homepage settings',
    })
  }
}
