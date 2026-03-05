// ============================================
// Single Blog Post Page - World-Class Design
// ============================================

import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Calendar,
  Clock,
  Tag,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  Heart,
  Twitter,
  Facebook,
  Linkedin,
  Copy,
  Check,
  Eye,
  ArrowRight,
  BookOpen,
} from 'lucide-react'
import type { BlogPost } from '../types'
import { blogApi } from '../api'
import { cn } from '../utils'

// Format date helper
function formatDate(dateString: string | null): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// Skeleton loader
function PostSkeleton() {
  return (
    <div className='animate-pulse'>
      <div className='h-96 bg-gray-200 rounded-3xl mb-8' />
      <div className='max-w-3xl mx-auto'>
        <div className='h-8 bg-gray-200 rounded w-1/4 mb-4' />
        <div className='h-12 bg-gray-200 rounded w-full mb-4' />
        <div className='h-12 bg-gray-200 rounded w-3/4 mb-8' />
        <div className='flex items-center gap-4 mb-8'>
          <div className='h-12 w-12 bg-gray-200 rounded-full' />
          <div>
            <div className='h-4 bg-gray-200 rounded w-32 mb-2' />
            <div className='h-3 bg-gray-200 rounded w-24' />
          </div>
        </div>
        <div className='space-y-4'>
          <div className='h-4 bg-gray-200 rounded w-full' />
          <div className='h-4 bg-gray-200 rounded w-full' />
          <div className='h-4 bg-gray-200 rounded w-5/6' />
          <div className='h-4 bg-gray-200 rounded w-full' />
          <div className='h-4 bg-gray-200 rounded w-4/5' />
        </div>
      </div>
    </div>
  )
}

// Related Post Card
function RelatedPostCard({ post }: { post: BlogPost }) {
  return (
    <Link
      to={`/blog/${post.slug}`}
      className='group block overflow-hidden rounded-2xl bg-white shadow-sm border border-gray-100 hover:shadow-lg hover:border-orange-200 transition-all duration-300'
    >
      <div className='aspect-16/10 overflow-hidden bg-gray-100'>
        {post.featured_image_url ? (
          <img
            src={post.featured_image_url}
            alt={post.featured_image_alt || post.title}
            className='h-full w-full object-cover transition-transform duration-500 group-hover:scale-105'
          />
        ) : (
          <div className='h-full w-full bg-linear-to-br from-orange-100 to-orange-200 flex items-center justify-center'>
            <BookOpen className='h-10 w-10 text-orange-400' />
          </div>
        )}
      </div>
      <div className='p-5'>
        {post.category && (
          <span className='inline-block text-xs font-medium text-orange-500 mb-2'>
            {post.category.name}
          </span>
        )}
        <h3 className='font-bold text-gray-900 line-clamp-2 group-hover:text-orange-500 transition-colors mb-2'>
          {post.title}
        </h3>
        <div className='flex items-center gap-3 text-xs text-gray-500'>
          <span className='flex items-center gap-1'>
            <Calendar className='h-3.5 w-3.5' />
            {formatDate(post.published_at)}
          </span>
          <span className='flex items-center gap-1'>
            <Clock className='h-3.5 w-3.5' />
            {post.reading_time_minutes} min
          </span>
        </div>
      </div>
    </Link>
  )
}

// Share Button Component
function ShareButton({
  platform,
  url,
  title,
}: {
  platform: 'twitter' | 'facebook' | 'linkedin' | 'copy'
  url: string
  title: string
}) {
  const [copied, setCopied] = useState(false)

  const handleShare = () => {
    const encodedUrl = encodeURIComponent(url)
    const encodedTitle = encodeURIComponent(title)

    switch (platform) {
      case 'twitter':
        window.open(
          `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
          '_blank',
        )
        break
      case 'facebook':
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
          '_blank',
        )
        break
      case 'linkedin':
        window.open(
          `https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedTitle}`,
          '_blank',
        )
        break
      case 'copy':
        navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        break
    }
  }

  const icons = {
    twitter: Twitter,
    facebook: Facebook,
    linkedin: Linkedin,
    copy: copied ? Check : Copy,
  }

  const Icon = icons[platform]

  return (
    <button
      onClick={handleShare}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-full border transition-all',
        copied
          ? 'border-green-500 bg-green-50 text-green-500'
          : 'border-gray-200 text-gray-500 hover:border-orange-500 hover:bg-orange-50 hover:text-orange-500',
      )}
      title={
        platform === 'copy'
          ? copied
            ? 'Copied!'
            : 'Copy link'
          : `Share on ${platform}`
      }
    >
      <Icon className='h-4 w-4' />
    </button>
  )
}

// Table of Contents Component
function TableOfContents({ content }: { content: string }) {
  const [headings, setHeadings] = useState<
    { id: string; text: string; level: number }[]
  >([])

  useEffect(() => {
    // Parse headings from HTML content
    const parser = new DOMParser()
    const doc = parser.parseFromString(content || '', 'text/html')
    const h2s = doc.querySelectorAll('h2, h3')
    const items: { id: string; text: string; level: number }[] = []

    h2s.forEach((heading, index) => {
      const id = `heading-${index}`
      items.push({
        id,
        text: heading.textContent || '',
        level: heading.tagName === 'H2' ? 2 : 3,
      })
    })

    setHeadings(items)
  }, [content])

  if (headings.length === 0) return null

  return (
    <div className='rounded-2xl bg-gray-50 p-6 border border-gray-100'>
      <h4 className='mb-4 font-bold text-gray-900 flex items-center gap-2'>
        <BookOpen className='h-5 w-5 text-orange-500' />
        Table of Contents
      </h4>
      <nav className='space-y-2'>
        {headings.map((heading) => (
          <a
            key={heading.id}
            href={`#${heading.id}`}
            className={cn(
              'block text-sm transition-colors hover:text-orange-500 text-gray-600',
              heading.level === 3 ? 'pl-4' : '',
            )}
          >
            {heading.text}
          </a>
        ))}
      </nav>
    </div>
  )
}

// Main Blog Post Page Component
export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>()
  const [post, setPost] = useState<BlogPost | null>(null)
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [isLiked, setIsLiked] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)

  useEffect(() => {
    if (slug) {
      loadPost()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  useEffect(() => {
    // Scroll to top when post changes
    window.scrollTo(0, 0)
  }, [slug])

  async function loadPost() {
    setLoading(true)
    try {
      const postData = await blogApi.getPostBySlug(slug!)
      setPost(postData)

      // Load related posts
      if (postData?.slug) {
        try {
          const related = await blogApi.getRelatedPosts(postData.slug, 3)
          setRelatedPosts(related)
        } catch {
          // Fallback to recent posts if related endpoint doesn't exist
          const recent = await blogApi.getPosts({ limit: 3 })
          setRelatedPosts(
            (recent?.posts || []).filter((p) => p.id !== postData.id).slice(0, 3),
          )
        }
      }
    } catch (error) {
      console.error('Failed to load post:', error)
      setPost(null)
    } finally {
      setLoading(false)
    }
  }

  const currentUrl = typeof window !== 'undefined' ? window.location.href : ''

  if (loading) {
    return (
      <div className='min-h-screen bg-white'>
        <div className='container mx-auto px-4 py-12'>
          <PostSkeleton />
        </div>
      </div>
    )
  }

  if (!post) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='text-center'>
          <BookOpen className='mx-auto h-16 w-16 text-gray-300 mb-4' />
          <h2 className='text-2xl font-bold text-gray-900 mb-2'>
            Post Not Found
          </h2>
          <p className='text-gray-500 mb-6'>
            The article you're looking for doesn't exist.
          </p>
          <Link
            to='/blog'
            className='inline-flex items-center gap-2 rounded-lg bg-orange-500 px-6 py-3 font-semibold text-white hover:bg-orange-600 transition-colors'
          >
            <ChevronLeft className='h-4 w-4' />
            Back to Blog
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-white'>
      {/* Hero Image */}
      {post.featured_image_url && (
        <section className='relative h-[50vh] md:h-[60vh] lg:h-[70vh] bg-gray-900'>
          <img
            src={post.featured_image_url}
            alt={post.featured_image_alt || post.title}
            className='h-full w-full object-cover'
          />
          <div className='absolute inset-0 bg-linear-to-t from-gray-900 via-gray-900/40 to-transparent' />

          {/* Back Button */}
          <Link
            to='/blog'
            className='absolute top-6 left-6 inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-sm px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition-colors'
          >
            <ChevronLeft className='h-4 w-4' />
            Back to Blog
          </Link>
        </section>
      )}

      {/* Article Content */}
      <article className='relative'>
        <div className='container mx-auto px-4'>
          {/* Header */}
          <header
            className={cn(
              'mx-auto max-w-3xl',
              post.featured_image_url
                ? '-mt-32 relative z-10 bg-white rounded-t-3xl p-8 md:p-12'
                : 'py-12',
            )}
          >
            {/* Breadcrumb */}
            {!post.featured_image_url && (
              <nav className='mb-6'>
                <ol className='flex items-center gap-2 text-sm text-gray-500'>
                  <li>
                    <Link to='/' className='hover:text-orange-500'>
                      Home
                    </Link>
                  </li>
                  <ChevronRight className='h-4 w-4' />
                  <li>
                    <Link to='/blog' className='hover:text-orange-500'>
                      Blog
                    </Link>
                  </li>
                  {post.category && (
                    <>
                      <ChevronRight className='h-4 w-4' />
                      <li>
                        <Link
                          to={`/blog?category=${post.category.slug}`}
                          className='hover:text-orange-500'
                        >
                          {post.category.name}
                        </Link>
                      </li>
                    </>
                  )}
                </ol>
              </nav>
            )}

            {/* Category */}
            {post.category && (
              <Link
                to={`/blog?category=${post.category.slug}`}
                className='inline-block rounded-full bg-orange-100 px-4 py-1.5 text-sm font-semibold text-orange-600 hover:bg-orange-200 transition-colors mb-4'
              >
                {post.category.name}
              </Link>
            )}

            {/* Title */}
            <h1 className='text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight mb-6'>
              {post.title}
            </h1>

            {/* Excerpt */}
            {post.excerpt && (
              <p className='text-xl text-gray-600 mb-8 leading-relaxed'>
                {post.excerpt}
              </p>
            )}

            {/* Meta Info */}
            <div className='flex flex-wrap items-center gap-6 pb-8 border-b border-gray-100'>
              {/* Author */}
              <Link
                to={`/blog?author=${post.author?.slug || ''}`}
                className='flex items-center gap-3 group'
              >
                {post.author?.avatar_url ? (
                  <img
                    src={post.author.avatar_url}
                    alt={post.author.display_name}
                    className='h-12 w-12 rounded-full object-cover ring-2 ring-white shadow-md'
                  />
                ) : (
                  <div className='h-12 w-12 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-lg ring-2 ring-white shadow-md'>
                    {post.author?.display_name?.charAt(0) || 'T'}
                  </div>
                )}
                <div>
                  <p className='font-semibold text-gray-900 group-hover:text-orange-500 transition-colors'>
                    {post.author?.display_name || 'Tech Tools Team'}
                  </p>
                  {post.author?.role && (
                    <p className='text-sm text-gray-500 capitalize'>
                      {post.author.role}
                    </p>
                  )}
                </div>
              </Link>

              <div className='h-8 w-px bg-gray-200 hidden sm:block' />

              {/* Date */}
              <div className='flex items-center gap-2 text-gray-500'>
                <Calendar className='h-5 w-5' />
                <span>{formatDate(post.published_at)}</span>
              </div>

              {/* Reading Time */}
              <div className='flex items-center gap-2 text-gray-500'>
                <Clock className='h-5 w-5' />
                <span>{post.reading_time_minutes} min read</span>
              </div>

              {/* Views */}
              <div className='flex items-center gap-2 text-gray-500'>
                <Eye className='h-5 w-5' />
                <span>{post.view_count.toLocaleString()} views</span>
              </div>
            </div>
          </header>

          {/* Content Grid */}
          <div className='mx-auto max-w-5xl flex flex-col lg:flex-row gap-12 py-8'>
            {/* Main Content */}
            <div className='flex-1 min-w-0'>
              {/* Article Body */}
              <div
                className='prose prose-lg max-w-none prose-headings:font-bold prose-headings:text-gray-900 prose-p:text-gray-600 prose-a:text-orange-500 prose-a:no-underline hover:prose-a:underline prose-img:rounded-xl prose-blockquote:border-orange-500 prose-blockquote:bg-orange-50 prose-blockquote:py-4 prose-blockquote:px-6 prose-blockquote:rounded-r-xl prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-orange-600 prose-code:before:content-none prose-code:after:content-none'
                dangerouslySetInnerHTML={{
                  __html: post.content_html || post.content,
                }}
              />

              {/* Tags */}
              {post.tags && post.tags.length > 0 && (
                <div className='mt-12 pt-8 border-t border-gray-100'>
                  <h4 className='mb-4 font-semibold text-gray-900 flex items-center gap-2'>
                    <Tag className='h-5 w-5 text-orange-500' />
                    Tags
                  </h4>
                  <div className='flex flex-wrap gap-2'>
                    {post.tags.map((tag) => (
                      <Link
                        key={tag.id}
                        to={`/blog?tag=${tag.slug}`}
                        className='rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-orange-100 hover:text-orange-600 transition-colors'
                      >
                        #{tag.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Share & Actions */}
              <div className='mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gray-50 p-6 border border-gray-100'>
                <div>
                  <p className='font-semibold text-gray-900 mb-1'>
                    Share this article
                  </p>
                  <p className='text-sm text-gray-500'>
                    Help others discover this content
                  </p>
                </div>
                <div className='flex items-center gap-2'>
                  <ShareButton
                    platform='twitter'
                    url={currentUrl}
                    title={post.title}
                  />
                  <ShareButton
                    platform='facebook'
                    url={currentUrl}
                    title={post.title}
                  />
                  <ShareButton
                    platform='linkedin'
                    url={currentUrl}
                    title={post.title}
                  />
                  <ShareButton
                    platform='copy'
                    url={currentUrl}
                    title={post.title}
                  />
                </div>
              </div>

              {/* Author Bio */}
              {post.author && (
                <div className='mt-8 rounded-2xl bg-white border border-gray-100 p-6 shadow-sm'>
                  <div className='flex flex-col sm:flex-row gap-6'>
                    {post.author.avatar_url ? (
                      <img
                        src={post.author.avatar_url}
                        alt={post.author.display_name}
                        className='h-20 w-20 rounded-2xl object-cover shrink-0'
                      />
                    ) : (
                      <div className='h-20 w-20 rounded-2xl bg-orange-500 flex items-center justify-center text-white font-bold text-2xl shrink-0'>
                        {post.author.display_name.charAt(0)}
                      </div>
                    )}
                    <div className='flex-1'>
                      <p className='text-sm font-medium text-orange-500 mb-1'>
                        Written by
                      </p>
                      <h4 className='text-xl font-bold text-gray-900 mb-2'>
                        {post.author.display_name}
                      </h4>
                      {post.author.bio && (
                        <p className='text-gray-600 mb-4'>{post.author.bio}</p>
                      )}
                      <Link
                        to={`/blog?author=${post.author.slug}`}
                        className='inline-flex items-center gap-2 text-sm font-semibold text-orange-500 hover:text-orange-600'
                      >
                        View all posts
                        <ArrowRight className='h-4 w-4' />
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <aside className='lg:w-72 shrink-0 hidden lg:block'>
              <div className='sticky top-24 space-y-6'>
                {/* Action Buttons */}
                <div className='flex gap-3'>
                  <button
                    onClick={() => setIsLiked(!isLiked)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 rounded-xl py-3 font-medium transition-all',
                      isLiked
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-500',
                    )}
                  >
                    <Heart
                      className={cn('h-5 w-5', isLiked && 'fill-current')}
                    />
                    {post.like_count + (isLiked ? 1 : 0)}
                  </button>
                  <button
                    onClick={() => setIsBookmarked(!isBookmarked)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 rounded-xl py-3 font-medium transition-all',
                      isBookmarked
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-orange-50 hover:text-orange-500',
                    )}
                  >
                    <Bookmark
                      className={cn('h-5 w-5', isBookmarked && 'fill-current')}
                    />
                    Save
                  </button>
                </div>

                {/* Table of Contents */}
                <TableOfContents content={post.content_html || post.content} />

                {/* Newsletter CTA */}
                <div className='rounded-2xl bg-linear-to-br from-orange-500 to-red-600 p-6 text-white'>
                  <h4 className='mb-2 font-bold'>Enjoy this article?</h4>
                  <p className='mb-4 text-sm text-orange-100'>
                    Subscribe to get more tips and guides delivered to your
                    inbox.
                  </p>
                  <Link
                    to='/#newsletter'
                    className='inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-orange-600 hover:bg-orange-50 transition-colors'
                  >
                    Subscribe Now
                    <ChevronRight className='h-4 w-4' />
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </article>

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <section className='bg-gray-50 py-16'>
          <div className='container mx-auto px-4'>
            <div className='mb-8 flex items-center justify-between'>
              <h2 className='text-2xl font-bold text-gray-900'>
                Related Articles
              </h2>
              <Link
                to='/blog'
                className='inline-flex items-center gap-2 text-sm font-semibold text-orange-500 hover:text-orange-600'
              >
                View all articles
                <ArrowRight className='h-4 w-4' />
              </Link>
            </div>
            <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
              {relatedPosts.map((relatedPost) => (
                <RelatedPostCard key={relatedPost.id} post={relatedPost} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Back to Blog CTA */}
      <section className='py-12'>
        <div className='container mx-auto px-4 text-center'>
          <Link
            to='/blog'
            className='inline-flex items-center gap-2 rounded-xl bg-gray-900 px-8 py-4 font-semibold text-white hover:bg-gray-800 transition-colors'
          >
            <ChevronLeft className='h-5 w-5' />
            Back to Blog
          </Link>
        </div>
      </section>
    </div>
  )
}
