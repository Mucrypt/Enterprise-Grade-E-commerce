'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { blogService, BlogTag } from '@/services/blog.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  Tags,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  RefreshCw,
  Hash,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import Link from 'next/link'

interface TagFormData {
  name: string
  slug: string
  description: string
}

const initialFormData: TagFormData = {
  name: '',
  slug: '',
  description: '',
}

export default function BlogTagsPage() {
  const queryClient = useQueryClient()

  // State
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<BlogTag | null>(null)
  const [formData, setFormData] = useState<TagFormData>(initialFormData)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [tagToDelete, setTagToDelete] = useState<BlogTag | null>(null)

  // Fetch tags
  const {
    data: tagsData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['blog-tags'],
    queryFn: blogService.getTags,
  })

  const tags = tagsData?.data || []

  // Filter tags by search
  const filteredTags = tags.filter(
    (tag: BlogTag) =>
      tag.name.toLowerCase().includes(search.toLowerCase()) ||
      tag.slug.toLowerCase().includes(search.toLowerCase()),
  )

  // Create tag mutation
  const createMutation = useMutation({
    mutationFn: blogService.createTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-tags'] })
      toast.success('Tag created successfully')
      handleCloseDialog()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create tag')
    },
  })

  // Update tag mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TagFormData> }) =>
      blogService.updateTag(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-tags'] })
      toast.success('Tag updated successfully')
      handleCloseDialog()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update tag')
    },
  })

  // Delete tag mutation
  const deleteMutation = useMutation({
    mutationFn: blogService.deleteTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-tags'] })
      toast.success('Tag deleted successfully')
      setDeleteDialogOpen(false)
      setTagToDelete(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete tag')
    },
  })

  const handleOpenCreate = () => {
    setEditingTag(null)
    setFormData(initialFormData)
    setDialogOpen(true)
  }

  const handleOpenEdit = (tag: BlogTag) => {
    setEditingTag(tag)
    setFormData({
      name: tag.name,
      slug: tag.slug,
      description: tag.description || '',
    })
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingTag(null)
    setFormData(initialFormData)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.error('Tag name is required')
      return
    }

    if (editingTag) {
      updateMutation.mutate({ id: editingTag.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleDelete = (tag: BlogTag) => {
    setTagToDelete(tag)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (tagToDelete) {
      deleteMutation.mutate(tagToDelete.id)
    }
  }

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: prev.slug || generateSlug(name),
    }))
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Blog Tags</h1>
          <p className='text-muted-foreground'>
            Manage tags for organizing your blog posts
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <Link href='/blog'>
            <Button variant='outline'>
              <FileText className='mr-2 h-4 w-4' />
              All Posts
            </Button>
          </Link>
          <Button onClick={handleOpenCreate}>
            <Plus className='mr-2 h-4 w-4' />
            Add Tag
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Tags</CardTitle>
          <CardDescription>
            {filteredTags.length} tag{filteredTags.length !== 1 ? 's' : ''}{' '}
            found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex items-center gap-4 mb-6'>
            <div className='relative flex-1 max-w-sm'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
              <Input
                placeholder='Search tags...'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className='pl-10'
              />
            </div>
            <Button variant='outline' size='icon' onClick={() => refetch()}>
              <RefreshCw className='h-4 w-4' />
            </Button>
          </div>

          {/* Tags Table */}
          {isLoading ? (
            <div className='space-y-3'>
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className='h-12 w-full' />
              ))}
            </div>
          ) : filteredTags.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-12 text-center'>
              <Tags className='h-12 w-12 text-muted-foreground/50 mb-4' />
              <h3 className='text-lg font-semibold'>No tags found</h3>
              <p className='text-muted-foreground mb-4'>
                {search
                  ? 'Try a different search term'
                  : 'Get started by creating your first tag'}
              </p>
              {!search && (
                <Button onClick={handleOpenCreate}>
                  <Plus className='mr-2 h-4 w-4' />
                  Create Tag
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead className='text-center'>Posts</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className='w-17.5'></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTags.map((tag: BlogTag) => (
                  <TableRow key={tag.id}>
                    <TableCell>
                      <div className='flex items-center gap-2'>
                        <Hash className='h-4 w-4 text-muted-foreground' />
                        <span className='font-medium'>{tag.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className='text-sm bg-muted px-2 py-1 rounded'>
                        {tag.slug}
                      </code>
                    </TableCell>
                    <TableCell className='text-center'>
                      <span className='inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-medium'>
                        {tag.post_count || 0}
                      </span>
                    </TableCell>
                    <TableCell className='text-muted-foreground'>
                      {format(new Date(tag.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant='ghost' size='icon'>
                            <MoreHorizontal className='h-4 w-4' />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end'>
                          <DropdownMenuItem onClick={() => handleOpenEdit(tag)}>
                            <Edit className='mr-2 h-4 w-4' />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(tag)}
                            className='text-destructive'
                          >
                            <Trash2 className='mr-2 h-4 w-4' />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTag ? 'Edit Tag' : 'Create Tag'}</DialogTitle>
            <DialogDescription>
              {editingTag
                ? 'Update the tag details below'
                : 'Add a new tag for organizing your blog posts'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className='space-y-4 py-4'>
              <div className='space-y-2'>
                <Label htmlFor='name'>Name *</Label>
                <Input
                  id='name'
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder='e.g., Technology'
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='slug'>Slug</Label>
                <Input
                  id='slug'
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, slug: e.target.value }))
                  }
                  placeholder='e.g., technology'
                />
                <p className='text-xs text-muted-foreground'>
                  URL-friendly version of the name. Leave blank to
                  auto-generate.
                </p>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='description'>Description</Label>
                <Textarea
                  id='description'
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder='Brief description of this tag...'
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={handleCloseDialog}
              >
                Cancel
              </Button>
              <Button
                type='submit'
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <RefreshCw className='mr-2 h-4 w-4 animate-spin' />
                )}
                {editingTag ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the tag &quot;{tagToDelete?.name}
              &quot;? This will remove the tag from all associated posts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {deleteMutation.isPending ? (
                <RefreshCw className='mr-2 h-4 w-4 animate-spin' />
              ) : (
                <Trash2 className='mr-2 h-4 w-4' />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
