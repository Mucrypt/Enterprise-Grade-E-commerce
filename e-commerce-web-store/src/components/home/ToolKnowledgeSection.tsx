// ============================================
// Tool Guides & Workshop Knowledge
//
// Uses the existing real blog API only (blogApi.getPosts).
// Books Library and Seller Hub are intentionally not
// referenced here - they remain reachable via their own
// existing routes (/books, /seller-hub) but are no longer
// part of the primary above-the-fold homepage flow.
// Renders nothing when there is no real published content,
// matching the honest-empty-state pattern used elsewhere on
// this homepage.
// ============================================

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { BlogPost } from '../../types'
import { blogApi } from '../../api'
import { formatDate } from '../../utils'
import { homepageConfig } from '../../config/homepage.config'

export default function ToolKnowledgeSection() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadPosts() {
      try {
        const data = await blogApi.getPosts({
          limit: homepageConfig.knowledge.displayLimit,
        })
        if (cancelled) return
        setPosts(
          (data.posts || []).filter(
            (post) => post.status === 'published' && post.visibility === 'public',
          ),
        )
      } catch (error) {
        console.error('Failed to load tool guides:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadPosts()
    return () => {
      cancelled = true
    }
  }, [])

  if (!loading && posts.length === 0) return null

  const { heading, description, displayLimit } = homepageConfig.knowledge

  return (
    <section aria-label='Tool guides and workshop knowledge' className='border-t border-slate-200 bg-slate-50 py-16 sm:py-20'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
          <div className='max-w-2xl'>
            <h2 className='text-3xl font-black tracking-tight text-slate-900 sm:text-4xl'>
              {heading}
            </h2>
            <p className='mt-3 text-base text-slate-600'>{description}</p>
          </div>
          <Link
            to={homepageConfig.routes.blog}
            className='hidden shrink-0 items-center gap-1 text-sm font-bold text-slate-900 hover:text-orange-600 sm:inline-flex'
          >
            View All Guides
            <ArrowRight className='h-4 w-4' aria-hidden='true' />
          </Link>
        </div>

        {loading ? (
          <div className='mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3'>
            {[...Array(displayLimit)].map((_, i) => (
              <div
                key={i}
                className='h-64 animate-pulse rounded-lg border border-slate-200 bg-white'
              />
            ))}
          </div>
        ) : (
          <div className='mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3'>
            {posts.map((post) => (
              <Link
                key={post.id}
                to={`/blog/${post.slug}`}
                className='group flex flex-col rounded-lg border border-slate-200 bg-white overflow-hidden transition-colors hover:border-slate-900 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-slate-900'
              >
                {post.featured_image_url && (
                  <div className='aspect-video w-full overflow-hidden bg-slate-100'>
                    <img
                      src={post.featured_image_url}
                      alt={post.featured_image_alt || post.title}
                      loading='lazy'
                      className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
                    />
                  </div>
                )}
                <div className='flex flex-1 flex-col p-5'>
                  <h3 className='text-base font-bold text-slate-900 line-clamp-2 group-hover:text-orange-600'>
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className='mt-2 flex-1 text-sm leading-relaxed text-slate-600 line-clamp-3'>
                      {post.excerpt}
                    </p>
                  )}
                  <div className='mt-4 flex items-center gap-2 text-xs text-slate-500'>
                    {post.author?.display_name && (
                      <span>{post.author.display_name}</span>
                    )}
                    {post.author?.display_name && post.published_at && (
                      <span aria-hidden='true'>&middot;</span>
                    )}
                    {post.published_at && (
                      <span>{formatDate(post.published_at)}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
