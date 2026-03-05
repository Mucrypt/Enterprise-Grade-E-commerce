// ============================================
// Blog Admin Service - Production Ready
// ============================================

import apiClient from '@/lib/api-client'
import type { ApiResponse } from '@/types'

// ============================================
// TYPES
// ============================================

export interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt: string
  content: string
  content_html: string
  featured_image_url: string | null
  featured_image_alt: string | null
  featured_video_url: string | null
  featured_video_type: string | null
  author_id: string | null
  category_id: string | null
  status: 'draft' | 'pending' | 'published' | 'scheduled' | 'archived'
  visibility: 'public' | 'private' | 'password_protected'
  password: string | null
  scheduled_at: string | null
  published_at: string | null
  meta_title: string | null
  meta_description: string | null
  meta_keywords: string[] | null
  canonical_url: string | null
  og_title: string | null
  og_description: string | null
  og_image_url: string | null
  allow_comments: boolean
  is_featured: boolean
  is_pinned: boolean
  view_count: number
  like_count: number
  comment_count: number
  share_count: number
  reading_time_minutes: number
  word_count: number
  created_at: string
  updated_at: string
  category?: BlogCategory
  author?: BlogAuthor
  tags?: BlogTag[]
  media?: BlogPostMedia[]
}

export interface BlogCategory {
  id: string
  name: string
  slug: string
  description: string | null
  image_url: string | null
  parent_id: string | null
  meta_title: string | null
  meta_description: string | null
  is_active: boolean
  display_order: number
  post_count: number
  created_at: string
  updated_at: string
}

export interface BlogTag {
  id: string
  name: string
  slug: string
  description: string | null
  post_count: number
  created_at: string
}

export interface BlogAuthor {
  id: string
  user_id: string | null
  display_name: string
  slug: string
  bio: string | null
  avatar_url: string | null
  website_url: string | null
  twitter_handle: string | null
  linkedin_url: string | null
  role: 'admin' | 'editor' | 'author' | 'contributor'
  is_active: boolean
  post_count: number
  created_at: string
  updated_at: string
}

export interface BlogPostMedia {
  id: string
  post_id: string
  media_type: 'image' | 'video' | 'embed'
  url: string
  thumbnail_url: string | null
  title: string | null
  alt_text: string | null
  caption: string | null
  description: string | null
  video_provider: string | null
  video_id: string | null
  embed_code: string | null
  embed_provider: string | null
  file_name: string | null
  file_size: number | null
  mime_type: string | null
  width: number | null
  height: number | null
  duration_seconds: number | null
  display_order: number
  is_featured: boolean
  created_at: string
}

export interface BlogStats {
  total_posts: number
  published_posts: number
  draft_posts: number
  total_categories: number
  total_tags: number
  total_authors: number
  total_views: number
  total_likes: number
  total_comments: number
  recent_posts: BlogPost[]
  top_posts: BlogPost[]
}

// DTOs
export interface CreatePostDTO {
  title: string
  slug?: string
  excerpt?: string
  content?: string
  content_html?: string
  featured_image_url?: string
  featured_image_alt?: string
  featured_video_url?: string
  featured_video_type?: string
  author_id?: string
  category_id?: string
  status?: 'draft' | 'pending' | 'published' | 'scheduled' | 'archived'
  visibility?: 'public' | 'private' | 'password_protected'
  password?: string
  scheduled_at?: string
  meta_title?: string
  meta_description?: string
  meta_keywords?: string[]
  canonical_url?: string
  og_title?: string
  og_description?: string
  og_image_url?: string
  allow_comments?: boolean
  is_featured?: boolean
  is_pinned?: boolean
  tags?: string[]
}

export interface UpdatePostDTO extends Partial<CreatePostDTO> {}

export interface CreateCategoryDTO {
  name: string
  slug?: string
  description?: string
  image_url?: string
  parent_id?: string
  meta_title?: string
  meta_description?: string
  is_active?: boolean
  display_order?: number
}

export interface UpdateCategoryDTO extends Partial<CreateCategoryDTO> {}

export interface CreateTagDTO {
  name: string
  slug?: string
  description?: string
}

export interface UpdateTagDTO extends Partial<CreateTagDTO> {}

export interface CreateAuthorDTO {
  user_id?: string
  display_name: string
  slug?: string
  bio?: string
  avatar_url?: string
  website_url?: string
  twitter_handle?: string
  linkedin_url?: string
  role?: 'admin' | 'editor' | 'author' | 'contributor'
  is_active?: boolean
}

export interface UpdateAuthorDTO extends Partial<CreateAuthorDTO> {}

export interface CreateMediaDTO {
  media_type?: 'image' | 'video' | 'embed'
  title?: string
  alt_text?: string
  caption?: string
  description?: string
  video_provider?: string
  video_id?: string
  embed_code?: string
  embed_provider?: string
  display_order?: number
  is_featured?: boolean
}

// Params
export interface GetPostsParams {
  page?: number
  limit?: number
  status?: string
  category?: string
  author?: string
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// Responses
export interface PaginatedPostsResponse {
  posts: BlogPost[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// ============================================
// SERVICE
// ============================================

export const blogService = {
  // ========================================
  // DASHBOARD
  // ========================================

  async getStats(): Promise<ApiResponse<BlogStats>> {
    return apiClient.get<ApiResponse<BlogStats>>('/blog/admin/stats')
  },

  // ========================================
  // POSTS
  // ========================================

  async getPosts(
    params: GetPostsParams = {},
  ): Promise<ApiResponse<PaginatedPostsResponse>> {
    const queryParams = new URLSearchParams()
    if (params.page) queryParams.append('page', String(params.page))
    if (params.limit) queryParams.append('limit', String(params.limit))
    if (params.status) queryParams.append('status', params.status)
    if (params.category) queryParams.append('category', params.category)
    if (params.author) queryParams.append('author', params.author)
    if (params.search) queryParams.append('search', params.search)
    if (params.sortBy) queryParams.append('sortBy', params.sortBy)
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder)

    return apiClient.get<ApiResponse<PaginatedPostsResponse>>(
      `/blog/admin/posts?${queryParams.toString()}`,
    )
  },

  async getPost(id: string): Promise<ApiResponse<BlogPost>> {
    return apiClient.get<ApiResponse<BlogPost>>(`/blog/admin/posts/${id}`)
  },

  async createPost(data: CreatePostDTO): Promise<ApiResponse<BlogPost>> {
    return apiClient.post<ApiResponse<BlogPost>>('/blog/admin/posts', data)
  },

  async updatePost(
    id: string,
    data: UpdatePostDTO,
  ): Promise<ApiResponse<BlogPost>> {
    return apiClient.put<ApiResponse<BlogPost>>(`/blog/admin/posts/${id}`, data)
  },

  async deletePost(id: string): Promise<ApiResponse<{ message: string }>> {
    return apiClient.delete<ApiResponse<{ message: string }>>(
      `/blog/admin/posts/${id}`,
    )
  },

  async publishPost(id: string): Promise<ApiResponse<BlogPost>> {
    return apiClient.put<ApiResponse<BlogPost>>(`/blog/admin/posts/${id}`, {
      status: 'published',
    })
  },

  async unpublishPost(id: string): Promise<ApiResponse<BlogPost>> {
    return apiClient.put<ApiResponse<BlogPost>>(`/blog/admin/posts/${id}`, {
      status: 'draft',
    })
  },

  // ========================================
  // POST MEDIA
  // ========================================

  async getPostMedia(postId: string): Promise<ApiResponse<BlogPostMedia[]>> {
    return apiClient.get<ApiResponse<BlogPostMedia[]>>(
      `/blog/admin/posts/${postId}/media`,
    )
  },

  async uploadPostMedia(
    postId: string,
    file: File,
    data?: CreateMediaDTO,
  ): Promise<ApiResponse<BlogPostMedia>> {
    const formData = new FormData()
    formData.append('file', file)
    if (data) {
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          formData.append(key, String(value))
        }
      })
    }
    return apiClient.postFormData<ApiResponse<BlogPostMedia>>(
      `/blog/admin/posts/${postId}/media`,
      formData,
    )
  },

  async addExternalMedia(
    postId: string,
    data: CreateMediaDTO,
  ): Promise<ApiResponse<BlogPostMedia>> {
    return apiClient.post<ApiResponse<BlogPostMedia>>(
      `/blog/admin/posts/${postId}/media`,
      data,
    )
  },

  async deletePostMedia(
    postId: string,
    mediaId: string,
  ): Promise<ApiResponse<{ message: string }>> {
    return apiClient.delete<ApiResponse<{ message: string }>>(
      `/blog/admin/posts/${postId}/media/${mediaId}`,
    )
  },

  // ========================================
  // CATEGORIES
  // ========================================

  async getCategories(): Promise<ApiResponse<BlogCategory[]>> {
    return apiClient.get<ApiResponse<BlogCategory[]>>('/blog/admin/categories')
  },

  async createCategory(
    data: CreateCategoryDTO,
  ): Promise<ApiResponse<BlogCategory>> {
    return apiClient.post<ApiResponse<BlogCategory>>(
      '/blog/admin/categories',
      data,
    )
  },

  async updateCategory(
    id: string,
    data: UpdateCategoryDTO,
  ): Promise<ApiResponse<BlogCategory>> {
    return apiClient.put<ApiResponse<BlogCategory>>(
      `/blog/admin/categories/${id}`,
      data,
    )
  },

  async deleteCategory(id: string): Promise<ApiResponse<{ message: string }>> {
    return apiClient.delete<ApiResponse<{ message: string }>>(
      `/blog/admin/categories/${id}`,
    )
  },

  // ========================================
  // TAGS
  // ========================================

  async getTags(): Promise<ApiResponse<BlogTag[]>> {
    return apiClient.get<ApiResponse<BlogTag[]>>('/blog/admin/tags')
  },

  async createTag(data: CreateTagDTO): Promise<ApiResponse<BlogTag>> {
    return apiClient.post<ApiResponse<BlogTag>>('/blog/admin/tags', data)
  },

  async updateTag(
    id: string,
    data: UpdateTagDTO,
  ): Promise<ApiResponse<BlogTag>> {
    return apiClient.put<ApiResponse<BlogTag>>(`/blog/admin/tags/${id}`, data)
  },

  async deleteTag(id: string): Promise<ApiResponse<{ message: string }>> {
    return apiClient.delete<ApiResponse<{ message: string }>>(
      `/blog/admin/tags/${id}`,
    )
  },

  // ========================================
  // AUTHORS
  // ========================================

  async getAuthors(): Promise<ApiResponse<BlogAuthor[]>> {
    return apiClient.get<ApiResponse<BlogAuthor[]>>('/blog/admin/authors')
  },

  async createAuthor(data: CreateAuthorDTO): Promise<ApiResponse<BlogAuthor>> {
    return apiClient.post<ApiResponse<BlogAuthor>>('/blog/admin/authors', data)
  },

  async updateAuthor(
    id: string,
    data: UpdateAuthorDTO,
  ): Promise<ApiResponse<BlogAuthor>> {
    return apiClient.put<ApiResponse<BlogAuthor>>(
      `/blog/admin/authors/${id}`,
      data,
    )
  },

  async deleteAuthor(id: string): Promise<ApiResponse<{ message: string }>> {
    return apiClient.delete<ApiResponse<{ message: string }>>(
      `/blog/admin/authors/${id}`,
    )
  },
}

export default blogService
