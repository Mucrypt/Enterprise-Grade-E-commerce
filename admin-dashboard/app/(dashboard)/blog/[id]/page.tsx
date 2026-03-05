'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter, useParams } from 'next/navigation'
import { blogService } from '@/services/blog.service'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  ArrowLeft,
  FileText,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Heart,
  MessageSquare,
  Share2,
  Globe,
  Lock,
  Calendar,
  User,
  Tag,
  FolderOpen,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { format } from 'date-fns'

const STATUS_CONFIG = {
  draft: { label: 'Draft', variant: 'secondary' as const, icon: Clock },
  pending: { label: 'Pending', variant: 'outline' as const, icon: Clock },
  published: { label: 'Published', variant: 'default' as const, icon: CheckCircle },
  scheduled: { label: 'Scheduled', variant: 'outline' as const, icon: Clock },
  archived: { label: 'Archived', variant: 'secondary' as const, icon: XCircle },
}

export default function ViewBlogPostPage() {
  const router = useRouter()
  const params = useParams()
  const queryClient = useQueryClient()
  const postId = params.id as string

  // Fetch post
  const { data: postResponse, isLoading } = useQuery({
    queryKey: ['blog-post', postId],
    queryFn: () => blogService.getPost(postId),
    enabled: !!postId,
  })

  const post = postResponse?.data

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => blogService.deletePost(postId),
    onSuccess: () => {
      toast.success('Post deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['blog-posts'] })
      router.push('/blog')
    },
    onError: () => {
      toast.error('Failed to delete post')
    },
  })

  // Publish mutation
  const publishMutation = useMutation({
    mutationFn: () => blogService.publishPost(postId),
    onSuccess: () => {
      toast.success('Post published successfully')
      queryClient.invalidateQueries({ queryKey: ['blog-post', postId] })
    },
    onError: () => {
      toast.error('Failed to publish post')
    },
  })

  // Unpublish mutation
  const unpublishMutation = useMutation({
    mutationFn: () => blogService.unpublishPost(postId),
    onSuccess: () => {
      toast.success('Post unpublished successfully')
      queryClient.invalidateQueries({ queryKey: ['blog-post', postId] })
    },
    onError: () => {
      toast.error('Failed to unpublish post')
    },
  })

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-96" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Skeleton className="h-150 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Post not found</h3>
          <p className="text-muted-foreground mb-4">
            The post you're looking for doesn't exist or has been deleted.
          </p>
          <Link href="/blog">
            <Button>Back to Posts</Button>
          </Link>
        </div>
      </div>
    )
  }

  const statusConfig = STATUS_CONFIG[post.status] || STATUS_CONFIG.draft
  const StatusIcon = statusConfig.icon

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link href="/blog">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{post.title}</h1>
              {post.is_featured && (
                <Badge variant="secondary">Featured</Badge>
              )}
              {post.is_pinned && (
                <Badge variant="outline">Pinned</Badge>
              )}
            </div>
            <div className="flex items-center gap-4 mt-2 text-muted-foreground">
              <Badge variant={statusConfig.variant} className="gap-1">
                <StatusIcon className="h-3 w-3" />
                {statusConfig.label}
              </Badge>
              {post.visibility === 'public' ? (
                <span className="flex items-center gap-1 text-sm">
                  <Globe className="h-4 w-4" />
                  Public
                </span>
              ) : (
                <span className="flex items-center gap-1 text-sm">
                  <Lock className="h-4 w-4" />
                  {post.visibility === 'private' ? 'Private' : 'Password Protected'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {post.status !== 'published' ? (
            <Button
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Publish
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => unpublishMutation.mutate()}
              disabled={unpublishMutation.isPending}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Unpublish
            </Button>
          )}
          <Link href={`/blog/${postId}/edit`}>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Post</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{post.title}"? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => deleteMutation.mutate()}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Featured Image */}
          {post.featured_image_url && (
            <Card>
              <CardContent className="p-0">
                <img
                  src={post.featured_image_url}
                  alt={post.featured_image_alt || post.title}
                  className="w-full h-auto rounded-lg"
                />
              </CardContent>
            </Card>
          )}

          {/* Excerpt */}
          {post.excerpt && (
            <Card>
              <CardHeader>
                <CardTitle>Excerpt</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{post.excerpt}</p>
              </CardContent>
            </Card>
          )}

          {/* Content */}
          <Card>
            <CardHeader>
              <CardTitle>Content</CardTitle>
            </CardHeader>
            <CardContent>
              {post.content ? (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg overflow-x-auto">
                    {post.content}
                  </pre>
                </div>
              ) : (
                <p className="text-muted-foreground">No content yet.</p>
              )}
            </CardContent>
          </Card>

          {/* SEO Info */}
          <Card>
            <CardHeader>
              <CardTitle>SEO Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Meta Title</p>
                <p>{post.meta_title || post.title}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Meta Description</p>
                <p>{post.meta_description || 'Not set'}</p>
              </div>
              {post.canonical_url && (
                <div>
                  <p className="text-sm text-muted-foreground">Canonical URL</p>
                  <p className="text-sm break-all">{post.canonical_url}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Engagement Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Engagement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{post.view_count.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Views</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{post.like_count.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Likes</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{post.comment_count.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Comments</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Share2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{post.share_count.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Shares</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  {post.reading_time_minutes} min read • {post.word_count.toLocaleString()} words
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Post Details */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Author</p>
                  <p>{post.author?.display_name || 'Unknown'}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <FolderOpen className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Category</p>
                  <p>{post.category?.name || 'Uncategorized'}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p>{format(new Date(post.created_at), 'PPP')}</p>
                </div>
              </div>
              {post.published_at && (
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Published</p>
                    <p>{format(new Date(post.published_at), 'PPP')}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Last Updated</p>
                  <p>{format(new Date(post.updated_at), 'PPP')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Tags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <Badge key={tag.id} variant="secondary">
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Slug */}
          <Card>
            <CardHeader>
              <CardTitle>URL Slug</CardTitle>
            </CardHeader>
            <CardContent>
              <code className="text-sm bg-muted px-2 py-1 rounded">
                /{post.slug}
              </code>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
