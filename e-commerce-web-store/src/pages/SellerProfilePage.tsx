// ============================================
// Public Seller Profile Page
// ============================================
// A real storefront page for an approved seller's own brand -- follower
// count and post count are both real (seller_follows count, approved
// Discover post count), never fabricated. Mirrors the brand-follow
// feature's optimistic-with-rollback pattern established this session.
// Thumbnails navigate to the general /discover feed rather than deep-
// linking to the exact post -- there's no post-specific deep-link route
// yet, and pointing there instead of inventing a fake link is the
// honest v1 behavior.

import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Loader2, Heart, Clapperboard, Video as VideoIcon, Image as ImageIcon } from 'lucide-react'
import { sellerApi, discoverApi, type PublicSellerProfile, type DiscoverPost } from '../api'
import { useAuthStore } from '../stores'
import { cn } from '../utils'

export default function SellerProfilePage() {
  const { handle } = useParams<{ handle: string }>()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const [profile, setProfile] = useState<PublicSellerProfile | null>(null)
  const [posts, setPosts] = useState<DiscoverPost[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followBusy, setFollowBusy] = useState(false)

  useEffect(() => {
    if (!handle) return
    let cancelled = false

    setLoading(true)
    setNotFound(false)

    sellerApi
      .getPublicProfile(handle)
      .then(async (data) => {
        if (cancelled) return
        setProfile(data)
        setIsFollowing(data.isFollowing)
        setFollowerCount(data.followerCount)

        const feed = await discoverApi.getFeed(1, 20, data.id).catch(() => ({ posts: [] }))
        if (!cancelled) setPosts(feed.posts)
      })
      .catch(() => {
        if (!cancelled) setNotFound(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [handle])

  const handleToggleFollow = async () => {
    if (!profile) return
    if (!isAuthenticated) {
      window.location.href = `/login?from=/seller/${profile.handle}`
      return
    }

    const wasFollowing = isFollowing
    setIsFollowing(!wasFollowing)
    setFollowerCount((c) => c + (wasFollowing ? -1 : 1))
    setFollowBusy(true)
    try {
      if (wasFollowing) await sellerApi.unfollow(profile.id)
      else await sellerApi.follow(profile.id)
    } catch {
      setIsFollowing(wasFollowing)
      setFollowerCount((c) => c + (wasFollowing ? 1 : -1))
    } finally {
      setFollowBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (notFound || !profile) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 px-6 text-center">
        <Clapperboard className="h-10 w-10 text-gray-300" />
        <p className="text-lg font-semibold text-gray-900">Seller not found</p>
        <p className="text-sm text-gray-500">This seller profile doesn't exist or isn't public yet.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div
        className="h-32 w-full rounded-2xl bg-linear-to-br from-orange-100 to-orange-50 sm:h-48"
        style={
          profile.banner_url
            ? { backgroundImage: `url(${profile.banner_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : undefined
        }
      />

      <div className="-mt-12 flex flex-col items-center px-4 sm:-mt-16 sm:flex-row sm:items-end sm:gap-6">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-linear-to-br from-orange-500 to-red-600 shadow-lg sm:h-32 sm:w-32">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.display_name || profile.handle} className="h-full w-full object-cover" />
          ) : (
            <span className="text-3xl font-bold text-white">
              {(profile.display_name || profile.handle).charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div className="mt-4 flex-1 text-center sm:mt-0 sm:pb-2 sm:text-left">
          <h1 className="text-xl font-bold text-gray-900">{profile.display_name || `@${profile.handle}`}</h1>
          <p className="text-sm text-gray-500">@{profile.handle}</p>
        </div>

        <button
          type="button"
          onClick={handleToggleFollow}
          disabled={followBusy}
          className={cn(
            'mt-4 rounded-full px-6 py-2.5 text-sm font-bold transition sm:mt-0',
            isFollowing
              ? 'bg-gray-100 text-gray-900 hover:bg-gray-200'
              : 'bg-orange-500 text-white hover:bg-orange-600',
          )}
        >
          {isFollowing ? 'Following' : 'Follow'}
        </button>
      </div>

      {!!profile.bio && <p className="mt-6 text-center text-sm text-gray-700 sm:text-left">{profile.bio}</p>}

      <div className="mt-6 flex items-center justify-center gap-8 border-y border-gray-100 py-4 text-center sm:justify-start">
        <div>
          <p className="text-lg font-bold text-gray-900">{profile.postCount}</p>
          <p className="text-xs uppercase tracking-wide text-gray-500">Posts</p>
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900">{followerCount}</p>
          <p className="text-xs uppercase tracking-wide text-gray-500">Followers</p>
        </div>
      </div>

      <div className="mt-6">
        {posts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-gray-400">
            <Clapperboard className="h-8 w-8" />
            <p className="text-sm">No posts yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1 sm:gap-2">
            {posts.map((post) => (
              <Link
                key={post.id}
                to="/discover"
                className="group relative aspect-9/16 overflow-hidden rounded-lg bg-gray-100"
              >
                {post.media_type === 'video' && post.video_poster_url ? (
                  <img src={post.video_poster_url} alt={post.caption || ''} className="h-full w-full object-cover" />
                ) : post.images?.[0]?.image_url ? (
                  <img src={post.images[0].image_url} alt={post.caption || ''} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gray-200">
                    {post.media_type === 'video' ? (
                      <VideoIcon className="h-6 w-6 text-gray-400" />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-gray-400" />
                    )}
                  </div>
                )}
                <div className="absolute inset-0 flex items-end bg-linear-to-t from-black/50 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="flex items-center gap-1 text-xs font-semibold text-white">
                    <Heart className="h-3.5 w-3.5" /> {post.like_count}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
