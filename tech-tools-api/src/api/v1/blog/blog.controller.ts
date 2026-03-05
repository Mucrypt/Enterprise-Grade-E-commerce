// ============================================
// Blog Controller - Production Ready
// ============================================

import { Request, Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import { query } from '../../../database/connection'
import logger from '../../../utils/logger'
import {
  processBlogImage,
  processBlogVideo,
  validateImageFile,
  validateVideoFile,
} from '../../../utils/media'
import fs from 'fs/promises'
import path from 'path'

// Helper to generate slug from title
const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// Calculate reading time from content
const calculateReadingTime = (content: string): number => {
  const wordsPerMinute = 200
  const wordCount = content.replace(/<[^>]*>/g, '').split(/\s+/).length
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute))
}

// ============================================
// PUBLIC ENDPOINTS
// ============================================

// Get all published posts (public)
export const getPublishedPosts = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      tag,
      author,
      search,
      sortBy = 'published_at',
      sortOrder = 'desc',
      featured,
    } = req.query

    const offset = (Number(page) - 1) * Number(limit)
    const conditions: string[] = [
      "bp.status = 'published'",
      'bp.deleted_at IS NULL',
    ]
    const values: any[] = []
    let paramIndex = 1

    if (category) {
      conditions.push(
        `(bc.slug = $${paramIndex} OR bc.id::text = $${paramIndex})`,
      )
      values.push(category)
      paramIndex++
    }

    if (tag) {
      conditions.push(`EXISTS (
        SELECT 1 FROM blog_post_tags bpt 
        JOIN blog_tags bt ON bpt.tag_id = bt.id 
        WHERE bpt.post_id = bp.id AND (bt.slug = $${paramIndex} OR bt.id::text = $${paramIndex})
      )`)
      values.push(tag)
      paramIndex++
    }

    if (author) {
      conditions.push(
        `(ba.slug = $${paramIndex} OR ba.id::text = $${paramIndex})`,
      )
      values.push(author)
      paramIndex++
    }

    if (search) {
      conditions.push(
        `(bp.title ILIKE $${paramIndex} OR bp.excerpt ILIKE $${paramIndex})`,
      )
      values.push(`%${search}%`)
      paramIndex++
    }

    if (featured === 'true') {
      conditions.push('bp.is_featured = true')
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`

    // Validate sort column
    const validSortColumns = [
      'published_at',
      'view_count',
      'like_count',
      'title',
      'created_at',
    ]
    const sortColumn = validSortColumns.includes(sortBy as string)
      ? `bp.${sortBy}`
      : 'bp.published_at'
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC'

    // Get total count
    const countResult = await query(
      `SELECT COUNT(DISTINCT bp.id) 
       FROM blog_posts bp
       LEFT JOIN blog_categories bc ON bp.category_id = bc.id
       LEFT JOIN blog_authors ba ON bp.author_id = ba.id
       ${whereClause}`,
      values,
    )
    const total = parseInt(countResult.rows[0].count)

    // Get posts
    const result = await query(
      `SELECT 
        bp.id, bp.title, bp.slug, bp.excerpt, 
        bp.featured_image_url, bp.featured_image_alt,
        bp.reading_time_minutes, bp.view_count, bp.like_count, bp.comment_count,
        bp.is_featured, bp.is_pinned, bp.published_at,
        json_build_object(
          'id', bc.id, 'name', bc.name, 'slug', bc.slug
        ) as category,
        json_build_object(
          'id', ba.id, 'display_name', ba.display_name, 'slug', ba.slug, 'avatar_url', ba.avatar_url
        ) as author,
        (SELECT json_agg(json_build_object('id', bt.id, 'name', bt.name, 'slug', bt.slug))
         FROM blog_post_tags bpt
         JOIN blog_tags bt ON bpt.tag_id = bt.id
         WHERE bpt.post_id = bp.id) as tags
       FROM blog_posts bp
       LEFT JOIN blog_categories bc ON bp.category_id = bc.id
       LEFT JOIN blog_authors ba ON bp.author_id = ba.id
       ${whereClause}
       ORDER BY bp.is_pinned DESC, ${sortColumn} ${order}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, limit, offset],
    )

    res.json({
      success: true,
      data: {
        posts: result.rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    })
  } catch (error) {
    logger.error('Get published posts error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch posts',
    })
  }
}

// Get single post by slug (public)
export const getPostBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params

    const result = await query(
      `SELECT 
        bp.*,
        json_build_object(
          'id', bc.id, 'name', bc.name, 'slug', bc.slug, 'description', bc.description
        ) as category,
        json_build_object(
          'id', ba.id, 'display_name', ba.display_name, 'slug', ba.slug, 
          'bio', ba.bio, 'avatar_url', ba.avatar_url, 'twitter_handle', ba.twitter_handle
        ) as author,
        (SELECT json_agg(json_build_object('id', bt.id, 'name', bt.name, 'slug', bt.slug))
         FROM blog_post_tags bpt
         JOIN blog_tags bt ON bpt.tag_id = bt.id
         WHERE bpt.post_id = bp.id) as tags,
        (SELECT json_agg(
          json_build_object(
            'id', bpm.id, 'media_type', bpm.media_type, 'url', bpm.url,
            'thumbnail_url', bpm.thumbnail_url, 'title', bpm.title, 'alt_text', bpm.alt_text,
            'caption', bpm.caption, 'display_order', bpm.display_order
          ) ORDER BY bpm.display_order
        )
         FROM blog_post_media bpm
         WHERE bpm.post_id = bp.id) as media
       FROM blog_posts bp
       LEFT JOIN blog_categories bc ON bp.category_id = bc.id
       LEFT JOIN blog_authors ba ON bp.author_id = ba.id
       WHERE bp.slug = $1 AND bp.status = 'published' AND bp.deleted_at IS NULL`,
      [slug],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Post not found',
      })
    }

    res.json({
      success: true,
      data: result.rows[0],
    })
  } catch (error) {
    logger.error('Get post by slug error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch post',
    })
  }
}

// Record post view
export const recordPostView = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params
    const userId = (req as AuthRequest).user?.id
    const sessionId = req.headers['x-session-id'] as string
    const ipAddress = req.ip
    const userAgent = req.headers['user-agent']
    const referrer = req.headers['referer']

    // Get post ID
    const postResult = await query(
      'SELECT id FROM blog_posts WHERE slug = $1 AND status = $2',
      [slug, 'published'],
    )

    if (postResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Post not found',
      })
    }

    const postId = postResult.rows[0].id

    // Record view
    await query(
      `INSERT INTO blog_post_views (post_id, user_id, session_id, ip_address, user_agent, referrer)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [postId, userId, sessionId, ipAddress, userAgent, referrer],
    )

    res.json({
      success: true,
      message: 'View recorded',
    })
  } catch (error) {
    logger.error('Record post view error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to record view',
    })
  }
}

// Get related posts
export const getRelatedPosts = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params
    const limit = Number(req.query.limit) || 4

    // Get current post's category and tags
    const postResult = await query(
      `SELECT bp.id, bp.category_id, 
        (SELECT array_agg(tag_id) FROM blog_post_tags WHERE post_id = bp.id) as tag_ids
       FROM blog_posts bp
       WHERE bp.slug = $1`,
      [slug],
    )

    if (postResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Post not found',
      })
    }

    const { id: postId, category_id, tag_ids } = postResult.rows[0]

    // Get related posts by category and tags
    const result = await query(
      `SELECT DISTINCT
        bp.id, bp.title, bp.slug, bp.excerpt, 
        bp.featured_image_url, bp.featured_image_alt,
        bp.reading_time_minutes, bp.published_at,
        json_build_object('id', ba.id, 'display_name', ba.display_name, 'slug', ba.slug) as author
       FROM blog_posts bp
       LEFT JOIN blog_authors ba ON bp.author_id = ba.id
       LEFT JOIN blog_post_tags bpt ON bp.id = bpt.post_id
       WHERE bp.id != $1 
         AND bp.status = 'published' 
         AND bp.deleted_at IS NULL
         AND (
           bp.category_id = $2
           OR ($3::uuid[] IS NOT NULL AND bpt.tag_id = ANY($3::uuid[]))
         )
       ORDER BY 
         CASE WHEN bp.category_id = $2 THEN 0 ELSE 1 END,
         bp.published_at DESC
       LIMIT $4`,
      [postId, category_id, tag_ids, limit],
    )

    res.json({
      success: true,
      data: result.rows,
    })
  } catch (error) {
    logger.error('Get related posts error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch related posts',
    })
  }
}

// Get all categories (public)
export const getPublicCategories = async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT id, name, slug, description, image_url, post_count
       FROM blog_categories
       WHERE is_active = true
       ORDER BY display_order ASC, name ASC`,
      [],
    )

    res.json({
      success: true,
      data: result.rows,
    })
  } catch (error) {
    logger.error('Get public categories error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories',
    })
  }
}

// Get all tags (public)
export const getPublicTags = async (req: Request, res: Response) => {
  try {
    const { popular } = req.query

    let orderBy = 'name ASC'
    let limit = ''

    if (popular === 'true') {
      orderBy = 'post_count DESC'
      limit = 'LIMIT 20'
    }

    const result = await query(
      `SELECT id, name, slug, post_count
       FROM blog_tags
       WHERE post_count > 0
       ORDER BY ${orderBy}
       ${limit}`,
      [],
    )

    res.json({
      success: true,
      data: result.rows,
    })
  } catch (error) {
    logger.error('Get public tags error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tags',
    })
  }
}

// Get authors (public)
export const getPublicAuthors = async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT id, display_name, slug, bio, avatar_url, post_count
       FROM blog_authors
       WHERE is_active = true AND post_count > 0
       ORDER BY post_count DESC`,
      [],
    )

    res.json({
      success: true,
      data: result.rows,
    })
  } catch (error) {
    logger.error('Get public authors error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch authors',
    })
  }
}

// Get author by slug (public)
export const getAuthorBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params

    const result = await query(
      `SELECT id, display_name, slug, bio, avatar_url, website_url, 
              twitter_handle, linkedin_url, post_count
       FROM blog_authors
       WHERE slug = $1 AND is_active = true`,
      [slug],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Author not found',
      })
    }

    res.json({
      success: true,
      data: result.rows[0],
    })
  } catch (error) {
    logger.error('Get author by slug error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch author',
    })
  }
}

// ============================================
// ADMIN ENDPOINTS
// ============================================

// Get all posts (admin - includes drafts)
export const getAllPosts = async (req: AuthRequest, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      category,
      author,
      search,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = req.query

    const offset = (Number(page) - 1) * Number(limit)
    const conditions: string[] = ['bp.deleted_at IS NULL']
    const values: any[] = []
    let paramIndex = 1

    if (status) {
      conditions.push(`bp.status = $${paramIndex}`)
      values.push(status)
      paramIndex++
    }

    if (category) {
      conditions.push(`bp.category_id = $${paramIndex}`)
      values.push(category)
      paramIndex++
    }

    if (author) {
      conditions.push(`bp.author_id = $${paramIndex}`)
      values.push(author)
      paramIndex++
    }

    if (search) {
      conditions.push(
        `(bp.title ILIKE $${paramIndex} OR bp.excerpt ILIKE $${paramIndex})`,
      )
      values.push(`%${search}%`)
      paramIndex++
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Validate sort column
    const validSortColumns = [
      'created_at',
      'updated_at',
      'published_at',
      'title',
      'view_count',
      'status',
    ]
    const sortColumn = validSortColumns.includes(sortBy as string)
      ? `bp.${sortBy}`
      : 'bp.created_at'
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC'

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM blog_posts bp ${whereClause}`,
      values,
    )
    const total = parseInt(countResult.rows[0].count)

    // Get posts
    const result = await query(
      `SELECT 
        bp.id, bp.title, bp.slug, bp.excerpt, bp.status, bp.visibility,
        bp.featured_image_url, bp.is_featured, bp.is_pinned,
        bp.view_count, bp.like_count, bp.comment_count,
        bp.published_at, bp.created_at, bp.updated_at,
        json_build_object('id', bc.id, 'name', bc.name) as category,
        json_build_object('id', ba.id, 'display_name', ba.display_name) as author
       FROM blog_posts bp
       LEFT JOIN blog_categories bc ON bp.category_id = bc.id
       LEFT JOIN blog_authors ba ON bp.author_id = ba.id
       ${whereClause}
       ORDER BY ${sortColumn} ${order}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, limit, offset],
    )

    res.json({
      success: true,
      data: {
        posts: result.rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    })
  } catch (error) {
    logger.error('Get all posts error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch posts',
    })
  }
}

// Get post by ID (admin)
export const getPostById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const result = await query(
      `SELECT 
        bp.*,
        json_build_object('id', bc.id, 'name', bc.name, 'slug', bc.slug) as category,
        json_build_object('id', ba.id, 'display_name', ba.display_name, 'slug', ba.slug) as author,
        (SELECT json_agg(json_build_object('id', bt.id, 'name', bt.name, 'slug', bt.slug))
         FROM blog_post_tags bpt
         JOIN blog_tags bt ON bpt.tag_id = bt.id
         WHERE bpt.post_id = bp.id) as tags,
        (SELECT json_agg(
          json_build_object(
            'id', bpm.id, 'media_type', bpm.media_type, 'url', bpm.url,
            'thumbnail_url', bpm.thumbnail_url, 'title', bpm.title, 'alt_text', bpm.alt_text,
            'caption', bpm.caption, 'display_order', bpm.display_order
          ) ORDER BY bpm.display_order
        )
         FROM blog_post_media bpm
         WHERE bpm.post_id = bp.id) as media
       FROM blog_posts bp
       LEFT JOIN blog_categories bc ON bp.category_id = bc.id
       LEFT JOIN blog_authors ba ON bp.author_id = ba.id
       WHERE bp.id = $1 AND bp.deleted_at IS NULL`,
      [id],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Post not found',
      })
    }

    res.json({
      success: true,
      data: result.rows[0],
    })
  } catch (error) {
    logger.error('Get post by ID error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch post',
    })
  }
}

// Create post (admin)
export const createPost = async (req: AuthRequest, res: Response) => {
  try {
    const {
      title,
      slug: customSlug,
      excerpt,
      content,
      content_html,
      featured_image_url,
      featured_image_alt,
      featured_video_url,
      featured_video_type,
      author_id,
      category_id,
      status = 'draft',
      visibility = 'public',
      password,
      scheduled_at,
      meta_title,
      meta_description,
      meta_keywords,
      canonical_url,
      og_title,
      og_description,
      og_image_url,
      allow_comments = true,
      is_featured = false,
      is_pinned = false,
      tags,
    } = req.body

    const userId = req.user!.id
    const slug = customSlug || generateSlug(title)

    // Check slug uniqueness
    const slugCheck = await query('SELECT id FROM blog_posts WHERE slug = $1', [
      slug,
    ])

    if (slugCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'A post with this slug already exists',
      })
    }

    // Set published_at if publishing
    const publishedAt = status === 'published' ? new Date() : null

    const result = await query(
      `INSERT INTO blog_posts (
        title, slug, excerpt, content, content_html,
        featured_image_url, featured_image_alt, featured_video_url, featured_video_type,
        author_id, category_id, status, visibility, password, scheduled_at,
        meta_title, meta_description, meta_keywords, canonical_url,
        og_title, og_description, og_image_url,
        allow_comments, is_featured, is_pinned,
        published_at, created_by, updated_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $27
      ) RETURNING *`,
      [
        title,
        slug,
        excerpt,
        content,
        content_html,
        featured_image_url,
        featured_image_alt,
        featured_video_url,
        featured_video_type,
        author_id,
        category_id,
        status,
        visibility,
        password,
        scheduled_at,
        meta_title,
        meta_description,
        meta_keywords,
        canonical_url,
        og_title,
        og_description,
        og_image_url,
        allow_comments,
        is_featured,
        is_pinned,
        publishedAt,
        userId,
      ],
    )

    const post = result.rows[0]

    // Add tags if provided
    if (tags && Array.isArray(tags) && tags.length > 0) {
      for (const tagId of tags) {
        await query(
          'INSERT INTO blog_post_tags (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [post.id, tagId],
        )
      }
    }

    logger.info(`Blog post created: ${post.id} by user ${userId}`)

    res.status(201).json({
      success: true,
      data: post,
      message: 'Post created successfully',
    })
  } catch (error) {
    logger.error('Create post error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create post',
    })
  }
}

// Update post (admin)
export const updatePost = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const userId = req.user!.id
    const {
      title,
      slug: customSlug,
      excerpt,
      content,
      content_html,
      featured_image_url,
      featured_image_alt,
      featured_video_url,
      featured_video_type,
      author_id,
      category_id,
      status,
      visibility,
      password,
      scheduled_at,
      meta_title,
      meta_description,
      meta_keywords,
      canonical_url,
      og_title,
      og_description,
      og_image_url,
      allow_comments,
      is_featured,
      is_pinned,
      tags,
    } = req.body

    // Check if post exists
    const existingPost = await query(
      'SELECT * FROM blog_posts WHERE id = $1 AND deleted_at IS NULL',
      [id],
    )

    if (existingPost.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Post not found',
      })
    }

    const currentPost = existingPost.rows[0]

    // Check slug uniqueness if changed
    const slug = customSlug || (title ? generateSlug(title) : currentPost.slug)
    if (slug !== currentPost.slug) {
      const slugCheck = await query(
        'SELECT id FROM blog_posts WHERE slug = $1 AND id != $2',
        [slug, id],
      )
      if (slugCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'A post with this slug already exists',
        })
      }
    }

    // Set published_at if publishing for first time
    let publishedAt = currentPost.published_at
    if (status === 'published' && currentPost.status !== 'published') {
      publishedAt = new Date()
    }

    const result = await query(
      `UPDATE blog_posts SET
        title = COALESCE($1, title),
        slug = COALESCE($2, slug),
        excerpt = COALESCE($3, excerpt),
        content = COALESCE($4, content),
        content_html = COALESCE($5, content_html),
        featured_image_url = $6,
        featured_image_alt = $7,
        featured_video_url = $8,
        featured_video_type = $9,
        author_id = COALESCE($10, author_id),
        category_id = $11,
        status = COALESCE($12, status),
        visibility = COALESCE($13, visibility),
        password = $14,
        scheduled_at = $15,
        meta_title = $16,
        meta_description = $17,
        meta_keywords = $18,
        canonical_url = $19,
        og_title = $20,
        og_description = $21,
        og_image_url = $22,
        allow_comments = COALESCE($23, allow_comments),
        is_featured = COALESCE($24, is_featured),
        is_pinned = COALESCE($25, is_pinned),
        published_at = $26,
        updated_by = $27,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $28
      RETURNING *`,
      [
        title,
        slug,
        excerpt,
        content,
        content_html,
        featured_image_url,
        featured_image_alt,
        featured_video_url,
        featured_video_type,
        author_id,
        category_id,
        status,
        visibility,
        password,
        scheduled_at,
        meta_title,
        meta_description,
        meta_keywords,
        canonical_url,
        og_title,
        og_description,
        og_image_url,
        allow_comments,
        is_featured,
        is_pinned,
        publishedAt,
        userId,
        id,
      ],
    )

    const post = result.rows[0]

    // Update tags if provided
    if (tags !== undefined) {
      // Remove existing tags
      await query('DELETE FROM blog_post_tags WHERE post_id = $1', [id])

      // Add new tags
      if (Array.isArray(tags) && tags.length > 0) {
        for (const tagId of tags) {
          await query(
            'INSERT INTO blog_post_tags (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [id, tagId],
          )
        }
      }
    }

    logger.info(`Blog post updated: ${id} by user ${userId}`)

    res.json({
      success: true,
      data: post,
      message: 'Post updated successfully',
    })
  } catch (error) {
    logger.error('Update post error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update post',
    })
  }
}

// Delete post (soft delete)
export const deletePost = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const userId = req.user!.id

    const result = await query(
      `UPDATE blog_posts 
       SET deleted_at = CURRENT_TIMESTAMP, updated_by = $1 
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [userId, id],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Post not found',
      })
    }

    logger.info(`Blog post deleted: ${id} by user ${userId}`)

    res.json({
      success: true,
      message: 'Post deleted successfully',
    })
  } catch (error) {
    logger.error('Delete post error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete post',
    })
  }
}

// ============================================
// CATEGORY ADMIN ENDPOINTS
// ============================================

// Get all categories (admin)
export const getAllCategories = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM blog_categories ORDER BY display_order ASC, name ASC`,
      [],
    )

    res.json({
      success: true,
      data: result.rows,
    })
  } catch (error) {
    logger.error('Get all blog categories error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories',
    })
  }
}

// Create category (admin)
export const createCategory = async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      slug: customSlug,
      description,
      image_url,
      parent_id,
      meta_title,
      meta_description,
      is_active,
      display_order,
    } = req.body

    const slug = customSlug || generateSlug(name)

    // Check slug uniqueness
    const slugCheck = await query(
      'SELECT id FROM blog_categories WHERE slug = $1',
      [slug],
    )
    if (slugCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'A category with this slug already exists',
      })
    }

    const result = await query(
      `INSERT INTO blog_categories (name, slug, description, image_url, parent_id, meta_title, meta_description, is_active, display_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        name,
        slug,
        description,
        image_url,
        parent_id,
        meta_title,
        meta_description,
        is_active ?? true,
        display_order ?? 0,
      ],
    )

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Category created successfully',
    })
  } catch (error) {
    logger.error('Create blog category error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create category',
    })
  }
}

// Update category (admin)
export const updateCategory = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const {
      name,
      slug,
      description,
      image_url,
      parent_id,
      meta_title,
      meta_description,
      is_active,
      display_order,
    } = req.body

    const result = await query(
      `UPDATE blog_categories SET
        name = COALESCE($1, name),
        slug = COALESCE($2, slug),
        description = $3,
        image_url = $4,
        parent_id = $5,
        meta_title = $6,
        meta_description = $7,
        is_active = COALESCE($8, is_active),
        display_order = COALESCE($9, display_order),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *`,
      [
        name,
        slug,
        description,
        image_url,
        parent_id,
        meta_title,
        meta_description,
        is_active,
        display_order,
        id,
      ],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Category not found',
      })
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Category updated successfully',
    })
  } catch (error) {
    logger.error('Update blog category error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update category',
    })
  }
}

// Delete category (admin)
export const deleteCategory = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    // Check if category has posts
    const postsCheck = await query(
      'SELECT COUNT(*) FROM blog_posts WHERE category_id = $1 AND deleted_at IS NULL',
      [id],
    )

    if (parseInt(postsCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete category with posts. Move or delete posts first.',
      })
    }

    const result = await query(
      'DELETE FROM blog_categories WHERE id = $1 RETURNING id',
      [id],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Category not found',
      })
    }

    res.json({
      success: true,
      message: 'Category deleted successfully',
    })
  } catch (error) {
    logger.error('Delete blog category error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete category',
    })
  }
}

// ============================================
// TAG ADMIN ENDPOINTS
// ============================================

// Get all tags (admin)
export const getAllTags = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query('SELECT * FROM blog_tags ORDER BY name ASC', [])

    res.json({
      success: true,
      data: result.rows,
    })
  } catch (error) {
    logger.error('Get all blog tags error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tags',
    })
  }
}

// Create tag (admin)
export const createTag = async (req: AuthRequest, res: Response) => {
  try {
    const { name, slug: customSlug, description } = req.body

    const slug = customSlug || generateSlug(name)

    // Check slug uniqueness
    const slugCheck = await query('SELECT id FROM blog_tags WHERE slug = $1', [
      slug,
    ])
    if (slugCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'A tag with this slug already exists',
      })
    }

    const result = await query(
      'INSERT INTO blog_tags (name, slug, description) VALUES ($1, $2, $3) RETURNING *',
      [name, slug, description],
    )

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Tag created successfully',
    })
  } catch (error) {
    logger.error('Create blog tag error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create tag',
    })
  }
}

// Update tag (admin)
export const updateTag = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { name, slug, description } = req.body

    const result = await query(
      `UPDATE blog_tags SET
        name = COALESCE($1, name),
        slug = COALESCE($2, slug),
        description = $3
       WHERE id = $4
       RETURNING *`,
      [name, slug, description, id],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tag not found',
      })
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Tag updated successfully',
    })
  } catch (error) {
    logger.error('Update blog tag error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update tag',
    })
  }
}

// Delete tag (admin)
export const deleteTag = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const result = await query(
      'DELETE FROM blog_tags WHERE id = $1 RETURNING id',
      [id],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tag not found',
      })
    }

    res.json({
      success: true,
      message: 'Tag deleted successfully',
    })
  } catch (error) {
    logger.error('Delete blog tag error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete tag',
    })
  }
}

// ============================================
// AUTHOR ADMIN ENDPOINTS
// ============================================

// Get all authors (admin)
export const getAllAuthors = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT ba.*, u.email as user_email
       FROM blog_authors ba
       LEFT JOIN users u ON ba.user_id = u.id
       ORDER BY ba.display_name ASC`,
      [],
    )

    res.json({
      success: true,
      data: result.rows,
    })
  } catch (error) {
    logger.error('Get all blog authors error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch authors',
    })
  }
}

// Create author (admin)
export const createAuthor = async (req: AuthRequest, res: Response) => {
  try {
    const {
      user_id,
      display_name,
      slug: customSlug,
      bio,
      avatar_url,
      website_url,
      twitter_handle,
      linkedin_url,
      role,
      is_active,
    } = req.body

    const slug = customSlug || generateSlug(display_name)

    // Check slug uniqueness
    const slugCheck = await query(
      'SELECT id FROM blog_authors WHERE slug = $1',
      [slug],
    )
    if (slugCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'An author with this slug already exists',
      })
    }

    const result = await query(
      `INSERT INTO blog_authors (user_id, display_name, slug, bio, avatar_url, website_url, twitter_handle, linkedin_url, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        user_id,
        display_name,
        slug,
        bio,
        avatar_url,
        website_url,
        twitter_handle,
        linkedin_url,
        role || 'author',
        is_active ?? true,
      ],
    )

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Author created successfully',
    })
  } catch (error) {
    logger.error('Create blog author error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create author',
    })
  }
}

// Update author (admin)
export const updateAuthor = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const {
      display_name,
      slug,
      bio,
      avatar_url,
      website_url,
      twitter_handle,
      linkedin_url,
      role,
      is_active,
    } = req.body

    const result = await query(
      `UPDATE blog_authors SET
        display_name = COALESCE($1, display_name),
        slug = COALESCE($2, slug),
        bio = $3,
        avatar_url = $4,
        website_url = $5,
        twitter_handle = $6,
        linkedin_url = $7,
        role = COALESCE($8, role),
        is_active = COALESCE($9, is_active),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *`,
      [
        display_name,
        slug,
        bio,
        avatar_url,
        website_url,
        twitter_handle,
        linkedin_url,
        role,
        is_active,
        id,
      ],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Author not found',
      })
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Author updated successfully',
    })
  } catch (error) {
    logger.error('Update blog author error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update author',
    })
  }
}

// Delete author (admin)
export const deleteAuthor = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    // Check if author has posts
    const postsCheck = await query(
      'SELECT COUNT(*) FROM blog_posts WHERE author_id = $1 AND deleted_at IS NULL',
      [id],
    )

    if (parseInt(postsCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete author with posts. Reassign posts first.',
      })
    }

    const result = await query(
      'DELETE FROM blog_authors WHERE id = $1 RETURNING id',
      [id],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Author not found',
      })
    }

    res.json({
      success: true,
      message: 'Author deleted successfully',
    })
  } catch (error) {
    logger.error('Delete blog author error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete author',
    })
  }
}

// ============================================
// POST MEDIA ENDPOINTS
// ============================================

// Upload media for post
export const uploadPostMedia = async (req: AuthRequest, res: Response) => {
  try {
    const { postId } = req.params
    const {
      media_type,
      title,
      alt_text,
      caption,
      description,
      video_provider,
      video_id,
      embed_code,
      embed_provider,
      display_order,
      is_featured,
    } = req.body
    const file = req.file

    // Check if post exists
    const postCheck = await query(
      'SELECT id FROM blog_posts WHERE id = $1 AND deleted_at IS NULL',
      [postId],
    )

    if (postCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Post not found',
      })
    }

    let url = ''
    let thumbnailUrl = ''
    let fileName = ''
    let fileSize = 0
    let mimeType = ''
    let width = 0
    let height = 0

    if (file) {
      fileName = file.originalname
      fileSize = file.size
      mimeType = file.mimetype

      const uploadDir = process.env.UPLOAD_DIR || 'uploads'
      const blogDir = path.join(uploadDir, 'blog')

      // Create directories if needed
      await fs.mkdir(path.join(blogDir, 'images'), { recursive: true })
      await fs.mkdir(path.join(blogDir, 'thumbnails'), { recursive: true })
      await fs.mkdir(path.join(blogDir, 'videos'), { recursive: true })

      if (media_type === 'image' || file.mimetype.startsWith('image/')) {
        const { imagePath, thumbnailPath, dimensions } = await processBlogImage(
          file,
        )
        url = `/media/blog/images/${path.basename(imagePath)}`
        thumbnailUrl = `/media/blog/thumbnails/${path.basename(thumbnailPath)}`
        width = dimensions.width
        height = dimensions.height
      } else if (media_type === 'video' || file.mimetype.startsWith('video/')) {
        const videoResult = await processBlogVideo(file)
        url = videoResult.url
        thumbnailUrl = videoResult.thumbnailUrl
      }
    } else if (media_type === 'embed' && embed_code) {
      // For embeds, just store the embed code
      url = video_id || ''
    } else if (video_provider && video_id) {
      // For external videos
      if (video_provider === 'youtube') {
        url = `https://www.youtube.com/watch?v=${video_id}`
        thumbnailUrl = `https://img.youtube.com/vi/${video_id}/maxresdefault.jpg`
      } else if (video_provider === 'vimeo') {
        url = `https://vimeo.com/${video_id}`
      }
    }

    const result = await query(
      `INSERT INTO blog_post_media (
        post_id, media_type, url, thumbnail_url, title, alt_text, caption, description,
        video_provider, video_id, embed_code, embed_provider,
        file_name, file_size, mime_type, width, height, display_order, is_featured
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *`,
      [
        postId,
        media_type || 'image',
        url,
        thumbnailUrl,
        title,
        alt_text,
        caption,
        description,
        video_provider,
        video_id,
        embed_code,
        embed_provider,
        fileName,
        fileSize,
        mimeType,
        width,
        height,
        display_order || 0,
        is_featured || false,
      ],
    )

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Media uploaded successfully',
    })
  } catch (error) {
    logger.error('Upload post media error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to upload media',
    })
  }
}

// Get post media
export const getPostMedia = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params

    const result = await query(
      `SELECT * FROM blog_post_media WHERE post_id = $1 ORDER BY display_order ASC`,
      [postId],
    )

    res.json({
      success: true,
      data: result.rows,
    })
  } catch (error) {
    logger.error('Get post media error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch media',
    })
  }
}

// Delete post media
export const deletePostMedia = async (req: AuthRequest, res: Response) => {
  try {
    const { postId, mediaId } = req.params

    const result = await query(
      'DELETE FROM blog_post_media WHERE id = $1 AND post_id = $2 RETURNING *',
      [mediaId, postId],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Media not found',
      })
    }

    // Delete files if they exist
    const media = result.rows[0]
    if (media.url && media.url.startsWith('/media/')) {
      const uploadDir = process.env.UPLOAD_DIR || 'uploads'
      const filePath = path.join(uploadDir, media.url.replace('/media/', ''))
      try {
        await fs.unlink(filePath)
      } catch (e) {
        // File may not exist
      }
    }

    res.json({
      success: true,
      message: 'Media deleted successfully',
    })
  } catch (error) {
    logger.error('Delete post media error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete media',
    })
  }
}

// ============================================
// DASHBOARD STATS
// ============================================

export const getBlogStats = async (req: AuthRequest, res: Response) => {
  try {
    const stats = await query(`
      SELECT
        (SELECT COUNT(*) FROM blog_posts WHERE deleted_at IS NULL) as total_posts,
        (SELECT COUNT(*) FROM blog_posts WHERE status = 'published' AND deleted_at IS NULL) as published_posts,
        (SELECT COUNT(*) FROM blog_posts WHERE status = 'draft' AND deleted_at IS NULL) as draft_posts,
        (SELECT COUNT(*) FROM blog_categories WHERE is_active = true) as total_categories,
        (SELECT COUNT(*) FROM blog_tags) as total_tags,
        (SELECT COUNT(*) FROM blog_authors WHERE is_active = true) as total_authors,
        (SELECT COALESCE(SUM(view_count), 0) FROM blog_posts) as total_views,
        (SELECT COALESCE(SUM(like_count), 0) FROM blog_posts) as total_likes,
        (SELECT COALESCE(SUM(comment_count), 0) FROM blog_posts) as total_comments
    `)

    // Get recent posts
    const recentPosts = await query(`
      SELECT id, title, slug, status, view_count, created_at
      FROM blog_posts
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 5
    `)

    // Get top posts by views
    const topPosts = await query(`
      SELECT id, title, slug, view_count, like_count
      FROM blog_posts
      WHERE status = 'published' AND deleted_at IS NULL
      ORDER BY view_count DESC
      LIMIT 5
    `)

    res.json({
      success: true,
      data: {
        ...stats.rows[0],
        recent_posts: recentPosts.rows,
        top_posts: topPosts.rows,
      },
    })
  } catch (error) {
    logger.error('Get blog stats error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch blog stats',
    })
  }
}
