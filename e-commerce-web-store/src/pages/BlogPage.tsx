// ============================================
// Blog Listing Page - World-Class Design
// ============================================

import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Search,
  Calendar,
  Clock,
  User,
  Tag,
  ChevronRight,
  ArrowRight,
  BookOpen,
  TrendingUp,
  Filter,
  X,
  Eye,
} from 'lucide-react'
import type { BlogPost, BlogCategory, BlogTag } from '../types'
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

// Skeleton loader for blog cards
function BlogCardSkeleton() {
  return (
    <div className='bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 animate-pulse'>
      <div className='aspect-16/10 bg-gray-200' />
      <div className='p-6'>
        <div className='h-4 bg-gray-200 rounded w-1/4 mb-3' />
        <div className='h-6 bg-gray-200 rounded w-full mb-2' />
        <div className='h-6 bg-gray-200 rounded w-3/4 mb-4' />
        <div className='h-4 bg-gray-200 rounded w-full mb-2' />
        <div className='h-4 bg-gray-200 rounded w-2/3 mb-4' />
        <div className='flex items-center gap-4'>
          <div className='h-8 w-8 bg-gray-200 rounded-full' />
          <div className='h-4 bg-gray-200 rounded w-24' />
        </div>
      </div>
    </div>
  )
}

// Featured Post Card Component
function FeaturedPostCard({ post }: { post: BlogPost }) {
  return (
    <Link
      to={`/blog/${post.slug}`}
      className='group relative block overflow-hidden rounded-3xl bg-gray-900'
    >
      {/* Background Image */}
      <div className='aspect-21/9 md:aspect-3/1'>
        {post.featured_image_url ? (
          <img
            src={post.featured_image_url}
            alt={post.featured_image_alt || post.title}
            className='h-full w-full object-cover transition-transform duration-700 group-hover:scale-105'
          />
        ) : (
          <div className='h-full w-full bg-linear-to-br from-orange-500 to-red-600' />
        )}
        {/* Overlay */}
        <div className='absolute inset-0 bg-linear-to-t from-gray-900 via-gray-900/60 to-transparent' />
      </div>

      {/* Content */}
      <div className='absolute inset-0 flex flex-col justify-end p-6 md:p-10'>
        {/* Featured Badge */}
        <div className='mb-4 flex items-center gap-3'>
          <span className='inline-flex items-center gap-1.5 rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold text-white'>
            <TrendingUp className='h-3.5 w-3.5' />
            Featured
          </span>
          {post.category && (
            <span className='rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm'>
              {post.category.name}
            </span>
          )}
        </div>

        {/* Title */}
        <h2 className='mb-3 text-2xl font-bold text-white md:text-4xl lg:text-5xl leading-tight group-hover:text-orange-400 transition-colors'>
          {post.title}
        </h2>

        {/* Excerpt */}
        <p className='mb-6 max-w-3xl text-gray-300 text-sm md:text-base line-clamp-2'>
          {post.excerpt}
        </p>

        {/* Meta */}
        <div className='flex flex-wrap items-center gap-4 text-sm text-gray-400'>
          {post.author && (
            <div className='flex items-center gap-2'>
              {post.author.avatar_url ? (
                <img
                  src={post.author.avatar_url}
                  alt={post.author.display_name}
                  className='h-8 w-8 rounded-full object-cover'
                />
              ) : (
                <div className='h-8 w-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-semibold text-sm'>
                  {post.author.display_name.charAt(0)}
                </div>
              )}
              <span className='text-white font-medium'>
                {post.author.display_name}
              </span>
            </div>
          )}
          <span className='hidden sm:inline text-gray-500'>•</span>
          <div className='flex items-center gap-1.5'>
            <Calendar className='h-4 w-4' />
            {formatDate(post.published_at)}
          </div>
          <span className='hidden sm:inline text-gray-500'>•</span>
          <div className='flex items-center gap-1.5'>
            <Clock className='h-4 w-4' />
            {post.reading_time_minutes} min read
          </div>
        </div>
      </div>
    </Link>
  )
}

// Blog Post Card Component
function BlogPostCard({
  post,
  variant = 'default',
}: {
  post: BlogPost
  variant?: 'default' | 'horizontal'
}) {
  if (variant === 'horizontal') {
    return (
      <Link
        to={`/blog/${post.slug}`}
        className='group flex gap-4 rounded-xl bg-white p-3 hover:bg-gray-50 transition-colors'
      >
        {/* Image */}
        <div className='h-20 w-20 shrink-0 overflow-hidden rounded-lg'>
          {post.featured_image_url ? (
            <img
              src={post.featured_image_url}
              alt={post.featured_image_alt || post.title}
              className='h-full w-full object-cover'
            />
          ) : (
            <div className='h-full w-full bg-linear-to-br from-orange-100 to-orange-200 flex items-center justify-center'>
              <BookOpen className='h-6 w-6 text-orange-500' />
            </div>
          )}
        </div>

        {/* Content */}
        <div className='flex-1 min-w-0'>
          <h4 className='font-semibold text-gray-900 line-clamp-2 group-hover:text-orange-500 transition-colors text-sm'>
            {post.title}
          </h4>
          <div className='mt-1 flex items-center gap-2 text-xs text-gray-500'>
            <Calendar className='h-3 w-3' />
            {formatDate(post.published_at)}
          </div>
        </div>
      </Link>
    )
  }

  return (
    <Link
      to={`/blog/${post.slug}`}
      className='group block overflow-hidden rounded-2xl bg-white shadow-sm border border-gray-100 hover:shadow-lg hover:border-orange-200 transition-all duration-300'
    >
      {/* Image */}
      <div className='aspect-16/10 overflow-hidden bg-gray-100 relative'>
        {post.featured_image_url ? (
          <img
            src={post.featured_image_url}
            alt={post.featured_image_alt || post.title}
            className='h-full w-full object-cover transition-transform duration-500 group-hover:scale-105'
          />
        ) : (
          <div className='h-full w-full bg-linear-to-br from-orange-100 to-orange-200 flex items-center justify-center'>
            <BookOpen className='h-12 w-12 text-orange-400' />
          </div>
        )}
        {/* Category Badge */}
        {post.category && (
          <div className='absolute top-4 left-4'>
            <span className='inline-block rounded-full bg-white/90 backdrop-blur-sm px-3 py-1 text-xs font-medium text-gray-700 shadow-sm'>
              {post.category.name}
            </span>
          </div>
        )}
        {post.is_featured && (
          <div className='absolute top-4 right-4'>
            <span className='inline-flex items-center gap-1 rounded-full bg-orange-500 px-2.5 py-1 text-xs font-semibold text-white'>
              <TrendingUp className='h-3 w-3' />
              Featured
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className='p-6'>
        {/* Title */}
        <h3 className='mb-3 text-xl font-bold text-gray-900 line-clamp-2 group-hover:text-orange-500 transition-colors'>
          {post.title}
        </h3>

        {/* Excerpt */}
        <p className='mb-4 text-gray-600 text-sm line-clamp-3'>
          {post.excerpt}
        </p>

        {/* Meta Footer */}
        <div className='flex items-center justify-between pt-4 border-t border-gray-100'>
          {/* Author */}
          <div className='flex items-center gap-2'>
            {post.author?.avatar_url ? (
              <img
                src={post.author.avatar_url}
                alt={post.author.display_name}
                className='h-8 w-8 rounded-full object-cover'
              />
            ) : (
              <div className='h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center'>
                <User className='h-4 w-4 text-orange-500' />
              </div>
            )}
            <div className='text-sm'>
              <p className='font-medium text-gray-900'>
                {post.author?.display_name || 'Tech Tools Team'}
              </p>
              <p className='text-gray-500 text-xs'>
                {formatDate(post.published_at)}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className='flex items-center gap-3 text-xs text-gray-500'>
            <span className='flex items-center gap-1'>
              <Clock className='h-3.5 w-3.5' />
              {post.reading_time_minutes}m
            </span>
            <span className='flex items-center gap-1'>
              <Eye className='h-3.5 w-3.5' />
              {post.view_count}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// Sidebar Category Card
function CategoryCard({
  category,
  isActive,
}: {
  category: BlogCategory
  isActive: boolean
}) {
  return (
    <Link
      to={`/blog?category=${category.slug}`}
      className={cn(
        'flex items-center justify-between rounded-xl px-4 py-3 transition-all',
        isActive
          ? 'bg-orange-500 text-white'
          : 'bg-gray-50 text-gray-700 hover:bg-orange-50 hover:text-orange-600',
      )}
    >
      <span className='font-medium'>{category.name}</span>
      <span
        className={cn(
          'text-sm rounded-full px-2 py-0.5',
          isActive ? 'bg-white/20' : 'bg-gray-200 text-gray-600',
        )}
      >
        {category.post_count}
      </span>
    </Link>
  )
}

// Main Blog Page Component
export default function BlogPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [featuredPosts, setFeaturedPosts] = useState<BlogPost[]>([])
  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [tags, setTags] = useState<BlogTag[]>([])
  const [recentPosts, setRecentPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [totalPosts, setTotalPosts] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  // Get filters from URL
  const filters = useMemo(
    () => ({
      category: searchParams.get('category') || '',
      tag: searchParams.get('tag') || '',
      author: searchParams.get('author') || '',
      search: searchParams.get('search') || '',
    }),
    [searchParams],
  )

  const hasActiveFilters =
    filters.category || filters.tag || filters.author || filters.search

  // Load initial data
  useEffect(() => {
    loadSidebarData()
  }, [])

  // Load posts when filters change
  useEffect(() => {
    loadPosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, currentPage])

  async function loadSidebarData() {
    try {
      const [categoriesData, tagsData, featuredData, recentData] =
        await Promise.all([
          blogApi.getCategories(),
          blogApi.getTags(),
          blogApi.getFeaturedPosts(3),
          blogApi.getPosts({ limit: 5 }),
        ])
      setCategories(categoriesData)
      setTags(tagsData)
      setFeaturedPosts(featuredData)
      setRecentPosts(recentData.posts)
    } catch (error) {
      console.error('Failed to load sidebar data:', error)
    }
  }

  async function loadPosts() {
    setLoading(true)
    try {
      const result = await blogApi.getPosts({
        ...filters,
        page: currentPage,
        limit: 9,
      })
      setPosts(result.posts)
      setTotalPosts(result.pagination?.total || result.posts.length)
    } catch (error) {
      console.error('Failed to load posts:', error)
      setPosts([])
    } finally {
      setLoading(false)
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearchParams((prev) => {
      if (searchQuery) {
        prev.set('search', searchQuery)
      } else {
        prev.delete('search')
      }
      return prev
    })
    setCurrentPage(1)
  }

  function clearFilters() {
    setSearchParams({})
    setSearchQuery('')
    setCurrentPage(1)
  }

  function handleTagClick(tagSlug: string) {
    setSearchParams({ tag: tagSlug })
    setCurrentPage(1)
  }

  const totalPages = Math.ceil(totalPosts / 9)

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Hero Section */}
      <section className='relative bg-linear-to-br from-gray-900 via-gray-800 to-gray-900 py-16 md:py-24'>
        <div className='absolute inset-0 opacity-10'>
          <div
            className='absolute inset-0'
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
            }}
          />
        </div>
        <div className='container relative mx-auto px-4'>
          <div className='mx-auto max-w-3xl text-center'>
            <h1 className='mb-4 text-4xl font-bold text-white md:text-5xl lg:text-6xl'>
              Tech Tools <span className='text-orange-500'>Blog</span>
            </h1>
            <p className='mb-8 text-lg text-gray-300'>
              Expert guides, product reviews, and tips to help you get the most
              out of your automotive accessories.
            </p>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className='mx-auto max-w-xl'>
              <div className='relative'>
                <Search className='absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400' />
                <input
                  type='text'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder='Search articles...'
                  className='w-full rounded-full border-0 bg-white py-4 pl-12 pr-32 text-gray-900 shadow-lg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500'
                />
                <button
                  type='submit'
                  className='absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-orange-500 px-6 py-2 font-semibold text-white transition-colors hover:bg-orange-600'
                >
                  Search
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Featured Post */}
      {!hasActiveFilters && featuredPosts.length > 0 && (
        <section className='container mx-auto px-4 -mt-12 relative z-10 mb-12'>
          <FeaturedPostCard post={featuredPosts[0]} />
        </section>
      )}

      {/* Main Content */}
      <section className='container mx-auto px-4 py-12'>
        <div className='flex flex-col lg:flex-row gap-8'>
          {/* Posts Grid */}
          <div className='flex-1'>
            {/* Mobile Filter Button */}
            <div className='flex items-center justify-between mb-6 lg:hidden'>
              <h2 className='text-xl font-bold text-gray-900'>
                {hasActiveFilters ? 'Search Results' : 'Latest Articles'}
              </h2>
              <button
                onClick={() => setShowMobileFilters(true)}
                className='flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'
              >
                <Filter className='h-4 w-4' />
                Filters
              </button>
            </div>

            {/* Active Filters */}
            {hasActiveFilters && (
              <div className='mb-6 flex flex-wrap items-center gap-2'>
                <span className='text-sm text-gray-500'>Active filters:</span>
                {filters.category && (
                  <span className='inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700'>
                    Category: {filters.category}
                    <button
                      onClick={() =>
                        setSearchParams((prev) => {
                          prev.delete('category')
                          return prev
                        })
                      }
                    >
                      <X className='h-3.5 w-3.5' />
                    </button>
                  </span>
                )}
                {filters.tag && (
                  <span className='inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700'>
                    Tag: {filters.tag}
                    <button
                      onClick={() =>
                        setSearchParams((prev) => {
                          prev.delete('tag')
                          return prev
                        })
                      }
                    >
                      <X className='h-3.5 w-3.5' />
                    </button>
                  </span>
                )}
                {filters.search && (
                  <span className='inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700'>
                    Search: "{filters.search}"
                    <button
                      onClick={() => {
                        setSearchQuery('')
                        setSearchParams((prev) => {
                          prev.delete('search')
                          return prev
                        })
                      }}
                    >
                      <X className='h-3.5 w-3.5' />
                    </button>
                  </span>
                )}
                <button
                  onClick={clearFilters}
                  className='text-sm font-medium text-gray-500 hover:text-gray-700'
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Desktop Title */}
            <h2 className='hidden lg:block text-2xl font-bold text-gray-900 mb-6'>
              {hasActiveFilters
                ? `${totalPosts} article${totalPosts !== 1 ? 's' : ''} found`
                : 'Latest Articles'}
            </h2>

            {/* Posts Grid */}
            {loading ? (
              <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
                {[...Array(6)].map((_, i) => (
                  <BlogCardSkeleton key={i} />
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className='rounded-2xl bg-white p-12 text-center shadow-sm border border-gray-100'>
                <BookOpen className='mx-auto h-16 w-16 text-gray-300 mb-4' />
                <h3 className='text-xl font-semibold text-gray-900 mb-2'>
                  No articles found
                </h3>
                <p className='text-gray-500 mb-6'>
                  {hasActiveFilters
                    ? "We couldn't find any articles matching your criteria."
                    : 'No blog posts have been published yet. Check back soon!'}
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className='inline-flex items-center gap-2 rounded-lg bg-orange-500 px-6 py-3 font-semibold text-white hover:bg-orange-600 transition-colors'
                  >
                    Clear filters
                    <ArrowRight className='h-4 w-4' />
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
                  {posts.map((post) => (
                    <BlogPostCard key={post.id} post={post} />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className='mt-12 flex items-center justify-center gap-2'>
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className='rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      Previous
                    </button>
                    {[...Array(totalPages)].map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i + 1)}
                        className={cn(
                          'h-10 w-10 rounded-lg text-sm font-medium transition-colors',
                          currentPage === i + 1
                            ? 'bg-orange-500 text-white'
                            : 'border border-gray-300 text-gray-700 hover:bg-gray-50',
                        )}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                      className='rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sidebar - Desktop */}
          <aside className='hidden lg:block w-80 shrink-0'>
            <div className='sticky top-24 space-y-8'>
              {/* Categories */}
              <div className='rounded-2xl bg-white p-6 shadow-sm border border-gray-100'>
                <h3 className='mb-4 flex items-center gap-2 text-lg font-bold text-gray-900'>
                  <BookOpen className='h-5 w-5 text-orange-500' />
                  Categories
                </h3>
                <div className='space-y-2'>
                  {categories.map((category) => (
                    <CategoryCard
                      key={category.id}
                      category={category}
                      isActive={filters.category === category.slug}
                    />
                  ))}
                </div>
              </div>

              {/* Popular Tags */}
              <div className='rounded-2xl bg-white p-6 shadow-sm border border-gray-100'>
                <h3 className='mb-4 flex items-center gap-2 text-lg font-bold text-gray-900'>
                  <Tag className='h-5 w-5 text-orange-500' />
                  Popular Tags
                </h3>
                <div className='flex flex-wrap gap-2'>
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => handleTagClick(tag.slug)}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                        filters.tag === tag.slug
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-orange-100 hover:text-orange-600',
                      )}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recent Posts */}
              <div className='rounded-2xl bg-white p-6 shadow-sm border border-gray-100'>
                <h3 className='mb-4 flex items-center gap-2 text-lg font-bold text-gray-900'>
                  <Clock className='h-5 w-5 text-orange-500' />
                  Recent Posts
                </h3>
                <div className='space-y-1'>
                  {recentPosts.slice(0, 5).map((post) => (
                    <BlogPostCard
                      key={post.id}
                      post={post}
                      variant='horizontal'
                    />
                  ))}
                </div>
              </div>

              {/* Newsletter CTA */}
              <div className='rounded-2xl bg-linear-to-br from-orange-500 to-red-600 p-6 text-white'>
                <h3 className='mb-2 text-lg font-bold'>Stay Updated</h3>
                <p className='mb-4 text-sm text-orange-100'>
                  Get the latest articles and car tips delivered to your inbox.
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
      </section>

      {/* Mobile Filters Drawer */}
      {showMobileFilters && (
        <div className='fixed inset-0 z-50 lg:hidden'>
          <div
            className='absolute inset-0 bg-black/50'
            onClick={() => setShowMobileFilters(false)}
          />
          <div className='absolute right-0 top-0 h-full w-full max-w-sm bg-white p-6 overflow-y-auto'>
            <div className='flex items-center justify-between mb-6'>
              <h3 className='text-xl font-bold text-gray-900'>Filters</h3>
              <button
                onClick={() => setShowMobileFilters(false)}
                className='rounded-lg p-2 hover:bg-gray-100'
              >
                <X className='h-5 w-5' />
              </button>
            </div>

            {/* Categories */}
            <div className='mb-8'>
              <h4 className='mb-3 font-semibold text-gray-900'>Categories</h4>
              <div className='space-y-2'>
                {categories.map((category) => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    isActive={filters.category === category.slug}
                  />
                ))}
              </div>
            </div>

            {/* Tags */}
            <div className='mb-8'>
              <h4 className='mb-3 font-semibold text-gray-900'>Tags</h4>
              <div className='flex flex-wrap gap-2'>
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => {
                      handleTagClick(tag.slug)
                      setShowMobileFilters(false)
                    }}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                      filters.tag === tag.slug
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-700',
                    )}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={() => {
                  clearFilters()
                  setShowMobileFilters(false)
                }}
                className='w-full rounded-lg border border-gray-300 py-3 font-medium text-gray-700 hover:bg-gray-50'
              >
                Clear All Filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
