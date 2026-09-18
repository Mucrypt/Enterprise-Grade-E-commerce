import { useEffect, useState } from 'react'
import {
  Clapperboard,
  Eye,
  Heart,
  Loader2,
  Package,
  Plus,
  Search,
  Share2,
  ShoppingCart,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import { discoverApi, productsApi, type DiscoverPost } from '../../api'
import type { Product } from '../../types'
import MessageBanner from './MessageBanner'

export default function DiscoverTab() {
  const [posts, setPosts] = useState<DiscoverPost[]>([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [mediaType, setMediaType] = useState<'video' | 'image'>('video')
  const [caption, setCaption] = useState('')
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [posterFile, setPosterFile] = useState<File | null>(null)
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [error, setError] = useState('')

  const [productPanelPostId, setProductPanelPostId] = useState<string | null>(null)
  const [productSearch, setProductSearch] = useState('')
  const [productSearchResults, setProductSearchResults] = useState<Product[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [taggingProductId, setTaggingProductId] = useState<string | null>(null)

  const loadPosts = async () => {
    setPostsLoading(true)
    try {
      setPosts(await discoverApi.getMine())
    } catch {
      // Soft failure -- the rest of the tab still works.
    } finally {
      setPostsLoading(false)
    }
  }

  useEffect(() => {
    loadPosts()
  }, [])

  const resetForm = () => {
    setMediaType('video')
    setCaption('')
    setVideoFile(null)
    setPosterFile(null)
    setImageFiles([])
    setFormError('')
  }

  const handleCreate = async () => {
    setFormError('')
    if (mediaType === 'video' && !videoFile) return setFormError('Choose a video file first.')
    if (mediaType === 'image' && imageFiles.length === 0) return setFormError('Choose at least one image.')

    setIsSaving(true)
    try {
      const formData = new FormData()
      formData.append('mediaType', mediaType)
      if (caption) formData.append('caption', caption)
      if (mediaType === 'video' && videoFile) {
        formData.append('video', videoFile)
        if (posterFile) formData.append('poster', posterFile)
      } else {
        imageFiles.forEach((file) => formData.append('images', file))
      }

      await discoverApi.createMine(formData)
      resetForm()
      await loadPosts()
    } catch (createError: any) {
      setFormError(createError?.response?.data?.message || 'Could not create the post right now.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (postId: string) => {
    try {
      await discoverApi.deleteMine(postId)
      setPosts((current) => current.filter((post) => post.id !== postId))
    } catch (deleteError: any) {
      setError(deleteError?.response?.data?.message || 'Could not delete the post right now.')
    }
  }

  const handleTogglePanel = (postId: string) => {
    setProductPanelPostId((current) => (current === postId ? null : postId))
    setProductSearch('')
    setProductSearchResults([])
  }

  const handleSearch = async (search: string) => {
    setProductSearch(search)
    if (search.trim().length < 2) return setProductSearchResults([])
    setIsSearching(true)
    try {
      const result = await productsApi.getAll({ search, limit: 8 })
      setProductSearchResults(result.products)
    } catch {
      setProductSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleTag = async (postId: string, productId: string) => {
    setTaggingProductId(productId)
    try {
      await discoverApi.addProducts(postId, [productId])
      await loadPosts()
    } catch (tagError: any) {
      setError(tagError?.response?.data?.message || 'Could not tag that product.')
    } finally {
      setTaggingProductId(null)
    }
  }

  const handleUntag = async (postId: string, productId: string) => {
    try {
      await discoverApi.removeProduct(postId, productId)
      await loadPosts()
    } catch (untagError: any) {
      setError(untagError?.response?.data?.message || 'Could not remove that product.')
    }
  }

  return (
    <div className='space-y-6'>
      <MessageBanner error={error} />

      <div className='rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5'>
        <h2 className='flex items-center gap-2 text-xl font-bold text-slate-900'>
          <Clapperboard className='h-5 w-5 text-orange-600' /> Create a Discover post
        </h2>
        <p className='mt-1 text-sm text-gray-500'>
          Your own video or images -- every post goes to Discover pending an admin&apos;s
          approval, and you can tag any real product once it&apos;s created.
        </p>

        <div className='mt-5 flex gap-2'>
          {(['video', 'image'] as const).map((type) => (
            <button
              key={type}
              type='button'
              onClick={() => setMediaType(type)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize transition ${
                mediaType === type
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-50 text-gray-600 ring-1 ring-slate-100 hover:bg-slate-100'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {mediaType === 'video' ? (
          <div className='mt-4 grid gap-3 md:grid-cols-2'>
            <label className='flex flex-col gap-1 text-xs font-medium text-gray-500'>
              Video file
              <input
                type='file'
                accept='video/mp4,video/quicktime'
                onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                className='rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white'
              />
            </label>
            <label className='flex flex-col gap-1 text-xs font-medium text-gray-500'>
              Poster image (optional)
              <input
                type='file'
                accept='image/*'
                onChange={(e) => setPosterFile(e.target.files?.[0] || null)}
                className='rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white'
              />
            </label>
          </div>
        ) : (
          <label className='mt-4 flex flex-col gap-1 text-xs font-medium text-gray-500'>
            Images (up to 10)
            <input
              type='file'
              accept='image/*'
              multiple
              onChange={(e) => setImageFiles(Array.from(e.target.files || []).slice(0, 10))}
              className='rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white'
            />
          </label>
        )}

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={2}
          placeholder='Caption (optional)'
          className='mt-4 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100'
        />

        {formError && <p className='mt-3 text-sm font-medium text-red-600'>{formError}</p>}

        <button
          type='button'
          onClick={handleCreate}
          disabled={isSaving}
          className='mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60'
        >
          {isSaving ? (
            <>
              <Loader2 className='h-4 w-4 animate-spin' /> Submitting...
            </>
          ) : (
            'Submit for review'
          )}
        </button>
      </div>

      <div className='rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5'>
        <div className='flex items-center justify-between gap-4'>
          <h2 className='flex items-center gap-2 text-xl font-bold text-slate-900'>
            <Package className='h-5 w-5 text-orange-600' /> Your posts
          </h2>
          <span className='rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 ring-1 ring-slate-100'>
            {posts.length} total
          </span>
        </div>

        <div className='mt-5 space-y-4'>
          {postsLoading ? (
            <div className='flex items-center gap-2 text-sm text-gray-500'>
              <Loader2 className='h-4 w-4 animate-spin' /> Loading your posts...
            </div>
          ) : posts.length === 0 ? (
            <div className='rounded-2xl border border-dashed border-gray-200 bg-slate-50 px-4 py-6 text-sm text-gray-500'>
              No posts yet -- create your first one above.
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.id} className='rounded-2xl border border-gray-100 bg-slate-50 p-4'>
                <div className='flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between'>
                  <div>
                    <p className='font-semibold text-slate-900'>
                      {post.caption || <span className='text-gray-400'>No caption</span>}
                    </p>
                    <p className='text-xs text-gray-500 capitalize'>{post.media_type} post</p>
                  </div>
                  <span
                    className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                      post.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {post.is_active ? 'Live' : 'Pending review'}
                  </span>
                </div>

                <div className='mt-3 flex flex-wrap items-center gap-3 text-xs font-medium text-gray-500'>
                  <span className='inline-flex items-center gap-1'>
                    <Eye className='h-3.5 w-3.5' /> {post.view_count}
                  </span>
                  <span className='inline-flex items-center gap-1'>
                    <Heart className='h-3.5 w-3.5' /> {post.like_count}
                  </span>
                  <span className='inline-flex items-center gap-1'>
                    <Share2 className='h-3.5 w-3.5' /> {post.share_count}
                  </span>
                  <span className='inline-flex items-center gap-1'>
                    <ShoppingCart className='h-3.5 w-3.5' /> {post.add_to_cart_count}
                  </span>
                  <span className='inline-flex items-center gap-1 font-semibold text-emerald-700'>
                    {post.purchase_count} purchases
                  </span>
                </div>

                <div className='mt-3 flex items-center gap-3'>
                  <button
                    type='button'
                    onClick={() => handleTogglePanel(post.id)}
                    className='inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 ring-1 ring-slate-200 transition hover:bg-slate-50'
                  >
                    <Tag className='h-3.5 w-3.5' />
                    {post.product_count ?? 0} tagged
                  </button>
                  <button
                    type='button'
                    onClick={() => handleDelete(post.id)}
                    className='inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-red-600 ring-1 ring-slate-200 transition hover:bg-red-50'
                  >
                    <Trash2 className='h-3.5 w-3.5' />
                    Delete
                  </button>
                </div>

                {productPanelPostId === post.id && (
                  <div className='mt-4 rounded-xl border border-gray-200 bg-white p-4'>
                    <div className='flex items-center gap-2'>
                      <Search className='h-4 w-4 text-gray-400' />
                      <input
                        value={productSearch}
                        onChange={(e) => handleSearch(e.target.value)}
                        placeholder='Search products to tag...'
                        className='w-full text-sm outline-none'
                      />
                    </div>

                    {isSearching && <p className='mt-2 text-xs text-gray-400'>Searching...</p>}

                    {productSearchResults.length > 0 && (
                      <div className='mt-3 space-y-2'>
                        {productSearchResults.map((product) => (
                          <div
                            key={product.id}
                            className='flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2'
                          >
                            <span className='truncate text-sm text-slate-800'>{product.name}</span>
                            <button
                              type='button'
                              onClick={() => handleTag(post.id, product.id)}
                              disabled={taggingProductId === product.id}
                              className='inline-flex shrink-0 items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60'
                            >
                              <Plus className='h-3 w-3' /> Tag
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {(post.products || []).length > 0 && (
                      <div className='mt-4 space-y-2 border-t border-gray-100 pt-3'>
                        <p className='text-xs font-semibold uppercase tracking-wide text-gray-400'>
                          Tagged products
                        </p>
                        {post.products.map((product) => (
                          <div
                            key={product.id}
                            className='flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2'
                          >
                            <span className='truncate text-sm text-slate-800'>{product.name}</span>
                            <button
                              type='button'
                              onClick={() => handleUntag(post.id, product.id)}
                              className='shrink-0 text-gray-400 hover:text-red-600'
                            >
                              <X className='h-4 w-4' />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
