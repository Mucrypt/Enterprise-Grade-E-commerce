'use client'

import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { blogService, CreatePostDTO } from '@/services/blog.service'
import { BlogPostForm } from '@/components/blog/BlogPostForm'
import { Button } from '@/components/ui/button'
import { ArrowLeft, FileText } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function NewBlogPostPage() {
  const router = useRouter()

  const createMutation = useMutation({
    mutationFn: (data: CreatePostDTO) => blogService.createPost(data),
    onSuccess: (response) => {
      toast.success('Post created successfully')
      if (response.data?.id) {
        router.push(`/blog/${response.data.id}`)
      } else {
        router.push('/blog')
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create post')
    },
  })

  const handleSubmit = async (data: CreatePostDTO) => {
    await createMutation.mutateAsync(data)
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/blog">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-8 w-8" />
            New Blog Post
          </h1>
          <p className="text-muted-foreground">
            Create a new article for your blog
          </p>
        </div>
      </div>

      {/* Form */}
      <BlogPostForm onSubmit={handleSubmit} isSubmitting={createMutation.isPending} />
    </div>
  )
}
