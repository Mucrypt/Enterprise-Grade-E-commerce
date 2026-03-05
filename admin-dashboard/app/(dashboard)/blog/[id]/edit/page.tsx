'use client'

import { useQuery, useMutation } from '@tanstack/react-query'
import { useRouter, useParams } from 'next/navigation'
import { blogService, UpdatePostDTO } from '@/services/blog.service'
import { BlogPostForm } from '@/components/blog/BlogPostForm'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, FileText } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function EditBlogPostPage() {
  const router = useRouter()
  const params = useParams()
  const postId = params.id as string

  // Fetch post
  const { data: postResponse, isLoading } = useQuery({
    queryKey: ['blog-post', postId],
    queryFn: () => blogService.getPost(postId),
    enabled: !!postId,
  })

  const post = postResponse?.data

  const updateMutation = useMutation({
    mutationFn: (data: UpdatePostDTO) => blogService.updatePost(postId, data),
    onSuccess: () => {
      toast.success('Post updated successfully')
      router.push(`/blog/${postId}`)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update post')
    },
  })

  const handleSubmit = async (data: UpdatePostDTO) => {
    await updateMutation.mutateAsync(data)
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-150 w-full" />
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

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/blog/${postId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-8 w-8" />
            Edit Post
          </h1>
          <p className="text-muted-foreground">{post.title}</p>
        </div>
      </div>

      {/* Form */}
      <BlogPostForm post={post} onSubmit={handleSubmit} isSubmitting={updateMutation.isPending} />
    </div>
  )
}
