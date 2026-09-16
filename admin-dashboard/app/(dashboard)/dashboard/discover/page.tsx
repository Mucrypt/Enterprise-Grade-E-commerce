'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  ArrowUp,
  ArrowDown,
  Plus,
  Pencil,
  Trash2,
  Video,
  Image as ImageIcon,
  Loader2,
  Clapperboard,
  Tag,
  Eye,
} from 'lucide-react'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import { getAbsoluteMediaUrl } from '@/lib/utils'
import {
  discoverService,
  DiscoverPost,
  DiscoverPostFormData,
  DiscoverPostFiles,
} from '@/services/discover.service'
import { DiscoverPostForm } from '@/components/discover/DiscoverPostForm'
import { DiscoverPostProductsManager } from '@/components/discover/DiscoverPostProductsManager'

export default function DiscoverFeedPage() {
  return (
    <RequirePagePermission permission='discover.view'>
      <DiscoverFeedContent />
    </RequirePagePermission>
  )
}

function DiscoverFeedContent() {
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<DiscoverPost | null>(null)
  const [productsPost, setProductsPost] = useState<DiscoverPost | null>(null)
  const [postToDelete, setPostToDelete] = useState<DiscoverPost | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['discover-posts'],
    queryFn: () => discoverService.getAll(),
  })
  const posts: DiscoverPost[] = (data as any)?.data || []

  const createMutation = useMutation({
    mutationFn: ({ formData, files }: { formData: DiscoverPostFormData; files: DiscoverPostFiles }) => {
      const hasFiles = !!(files.video || files.poster || (files.images && files.images.length > 0))
      return hasFiles ? discoverService.createWithMedia(formData, files) : discoverService.create(formData)
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['discover-posts'] })
      toast.success('Discover post created')
      setFormOpen(false)
      // Jump straight into product tagging -- a post with nothing tagged
      // isn't useful yet, and this is the natural next step.
      if (result?.data) setProductsPost(result.data)
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to create discover post'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, formData, files }: { id: string; formData: Partial<DiscoverPostFormData>; files: DiscoverPostFiles }) => {
      const hasFiles = !!(files.video || files.poster || (files.images && files.images.length > 0))
      return hasFiles ? discoverService.updateWithMedia(id, formData, files) : discoverService.update(id, formData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discover-posts'] })
      toast.success('Discover post updated')
      setFormOpen(false)
      setEditingPost(null)
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to update discover post'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => discoverService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discover-posts'] })
      toast.success('Discover post deleted')
      setPostToDelete(null)
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to delete discover post'),
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      discoverService.update(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discover-posts'] })
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to update post'),
  })

  const reorderMutation = useMutation({
    mutationFn: (order: Array<{ id: string; position: number }>) => discoverService.reorder(order),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discover-posts'] })
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to reorder posts'),
  })

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newPosts = [...posts]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newPosts.length) return
    ;[newPosts[index], newPosts[targetIndex]] = [newPosts[targetIndex], newPosts[index]]
    // Descending position (higher pins to top, matching the public feed's
    // ORDER BY position DESC) -- so index 0 gets the highest value.
    reorderMutation.mutate(newPosts.map((p, idx) => ({ id: p.id, position: newPosts.length - idx })))
  }

  const handleSubmit = async (formData: DiscoverPostFormData, files: DiscoverPostFiles) => {
    if (editingPost) {
      await updateMutation.mutateAsync({ id: editingPost.id, formData, files })
    } else {
      await createMutation.mutateAsync({ formData, files })
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-3'>
        <div className='flex-1'>
          <h1 className='text-2xl font-bold tracking-tight flex items-center gap-2'>
            <Clapperboard className='h-6 w-6' />
            Discover Feed
          </h1>
          <p className='text-sm text-muted-foreground'>
            Manage the shoppable video/image feed on web and mobile. Every post ties to real
            products -- tap &quot;Tag products&quot; after creating one. Changes go live immediately.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingPost(null)
            setFormOpen(true)
          }}
        >
          <Plus className='mr-2 h-4 w-4' />
          Add Post
        </Button>
      </div>

      {isLoading ? (
        <div className='space-y-3'>
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className='h-16 w-full' />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className='text-center py-16 border border-dashed rounded-lg'>
          <div className='mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4'>
            <Clapperboard className='h-6 w-6 text-muted-foreground' />
          </div>
          <h3 className='text-lg font-medium'>No Discover posts yet</h3>
          <p className='text-muted-foreground text-sm mt-1'>
            Add your first video or image post to start populating the feed.
          </p>
          <Button
            className='mt-4'
            onClick={() => {
              setEditingPost(null)
              setFormOpen(true)
            }}
          >
            <Plus className='mr-2 h-4 w-4' />
            Add Post
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-16'>Media</TableHead>
              <TableHead>Caption</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Products</TableHead>
              <TableHead className='text-center'>Views</TableHead>
              <TableHead className='text-center'>Order</TableHead>
              <TableHead className='text-center'>Active</TableHead>
              <TableHead className='w-28'></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts.map((post, index) => {
              const thumbnail = getAbsoluteMediaUrl(
                post.video_poster_url || post.images?.[0]?.image_url,
              )
              return (
                <TableRow key={post.id}>
                  <TableCell>
                    {thumbnail ? (
                      <Image src={thumbnail} alt={post.caption || ''} width={40} height={40} className='rounded object-cover' />
                    ) : (
                      <div className='w-10 h-10 bg-muted rounded flex items-center justify-center'>
                        {post.media_type === 'video' ? (
                          <Video className='h-4 w-4 text-muted-foreground' />
                        ) : (
                          <ImageIcon className='h-4 w-4 text-muted-foreground' />
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className='max-w-xs'>
                    <span className='line-clamp-2'>{post.caption || <span className='text-muted-foreground'>No caption</span>}</span>
                    {post.category_name && (
                      <div className='mt-1'>
                        <Badge variant='outline' className='text-xs'>#{post.category_name}</Badge>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant='outline' className='capitalize'>{post.media_type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant='link' size='sm' className='h-auto p-0' onClick={() => setProductsPost(post)}>
                      <Tag className='h-3.5 w-3.5 mr-1' />
                      {post.product_count ?? 0} tagged
                    </Button>
                  </TableCell>
                  <TableCell className='text-center text-sm text-muted-foreground'>
                    <div className='flex items-center justify-center gap-1'>
                      <Eye className='h-3.5 w-3.5' />
                      {post.view_count}
                    </div>
                  </TableCell>
                  <TableCell className='text-center'>
                    <div className='flex items-center justify-center gap-1'>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='h-7 w-7'
                        onClick={() => handleMove(index, 'up')}
                        disabled={index === 0 || reorderMutation.isPending}
                      >
                        <ArrowUp className='h-3 w-3' />
                      </Button>
                      <span className='text-sm text-muted-foreground w-6 text-center'>{index + 1}</span>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='h-7 w-7'
                        onClick={() => handleMove(index, 'down')}
                        disabled={index === posts.length - 1 || reorderMutation.isPending}
                      >
                        <ArrowDown className='h-3 w-3' />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className='text-center'>
                    <Switch
                      checked={post.is_active}
                      onCheckedChange={(checked: boolean) =>
                        toggleActiveMutation.mutate({ id: post.id, isActive: checked })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className='flex items-center gap-1'>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='h-8 w-8'
                        onClick={() => {
                          setEditingPost(post)
                          setFormOpen(true)
                        }}
                      >
                        <Pencil className='h-4 w-4' />
                      </Button>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='h-8 w-8 text-destructive hover:text-destructive'
                        onClick={() => setPostToDelete(post)}
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      <DiscoverPostForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditingPost(null)
        }}
        onSubmit={handleSubmit}
        post={editingPost}
        isLoading={isSaving}
      />

      <DiscoverPostProductsManager
        open={!!productsPost}
        onClose={() => setProductsPost(null)}
        post={productsPost}
      />

      <AlertDialog open={!!postToDelete} onOpenChange={() => setPostToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Discover Post</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this post? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => postToDelete && deleteMutation.mutate(postToDelete.id)}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {deleteMutation.isPending && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
