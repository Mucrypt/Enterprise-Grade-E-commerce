'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { blogService, BlogAuthor } from '@/services/blog.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Users,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  RefreshCw,
  FileText,
  Globe,
  Twitter,
  Linkedin,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import Link from 'next/link'

interface AuthorFormData {
  display_name: string
  slug: string
  bio: string
  avatar_url: string
  website_url: string
  twitter_handle: string
  linkedin_url: string
  role: 'admin' | 'editor' | 'author' | 'contributor'
  is_active: boolean
}

const initialFormData: AuthorFormData = {
  display_name: '',
  slug: '',
  bio: '',
  avatar_url: '',
  website_url: '',
  twitter_handle: '',
  linkedin_url: '',
  role: 'author',
  is_active: true,
}

const ROLE_BADGES = {
  admin: { label: 'Admin', variant: 'destructive' as const },
  editor: { label: 'Editor', variant: 'default' as const },
  author: { label: 'Author', variant: 'secondary' as const },
  contributor: { label: 'Contributor', variant: 'outline' as const },
}

export default function BlogAuthorsPage() {
  const queryClient = useQueryClient()

  // State
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAuthor, setEditingAuthor] = useState<BlogAuthor | null>(null)
  const [formData, setFormData] = useState<AuthorFormData>(initialFormData)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [authorToDelete, setAuthorToDelete] = useState<BlogAuthor | null>(null)

  // Fetch authors
  const {
    data: authorsData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['blog-authors'],
    queryFn: blogService.getAuthors,
  })

  const authors = authorsData?.data || []

  // Filter authors by search
  const filteredAuthors = authors.filter(
    (author: BlogAuthor) =>
      author.display_name.toLowerCase().includes(search.toLowerCase()) ||
      author.slug.toLowerCase().includes(search.toLowerCase()),
  )

  // Create author mutation
  const createMutation = useMutation({
    mutationFn: blogService.createAuthor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-authors'] })
      toast.success('Author created successfully')
      handleCloseDialog()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create author')
    },
  })

  // Update author mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AuthorFormData> }) =>
      blogService.updateAuthor(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-authors'] })
      toast.success('Author updated successfully')
      handleCloseDialog()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update author')
    },
  })

  // Delete author mutation
  const deleteMutation = useMutation({
    mutationFn: blogService.deleteAuthor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-authors'] })
      toast.success('Author deleted successfully')
      setDeleteDialogOpen(false)
      setAuthorToDelete(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete author')
    },
  })

  const handleOpenCreate = () => {
    setEditingAuthor(null)
    setFormData(initialFormData)
    setDialogOpen(true)
  }

  const handleOpenEdit = (author: BlogAuthor) => {
    setEditingAuthor(author)
    setFormData({
      display_name: author.display_name,
      slug: author.slug,
      bio: author.bio || '',
      avatar_url: author.avatar_url || '',
      website_url: author.website_url || '',
      twitter_handle: author.twitter_handle || '',
      linkedin_url: author.linkedin_url || '',
      role: author.role,
      is_active: author.is_active,
    })
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingAuthor(null)
    setFormData(initialFormData)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.display_name.trim()) {
      toast.error('Author name is required')
      return
    }

    if (editingAuthor) {
      updateMutation.mutate({ id: editingAuthor.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleDelete = (author: BlogAuthor) => {
    setAuthorToDelete(author)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (authorToDelete) {
      deleteMutation.mutate(authorToDelete.id)
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
      display_name: name,
      slug: prev.slug || generateSlug(name),
    }))
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Blog Authors</h1>
          <p className='text-muted-foreground'>
            Manage authors who can write blog posts
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
            Add Author
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Authors</CardTitle>
          <CardDescription>
            {filteredAuthors.length} author
            {filteredAuthors.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex items-center gap-4 mb-6'>
            <div className='relative flex-1 max-w-sm'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
              <Input
                placeholder='Search authors...'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className='pl-10'
              />
            </div>
            <Button variant='outline' size='icon' onClick={() => refetch()}>
              <RefreshCw className='h-4 w-4' />
            </Button>
          </div>

          {/* Authors Table */}
          {isLoading ? (
            <div className='space-y-3'>
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className='h-16 w-full' />
              ))}
            </div>
          ) : filteredAuthors.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-12 text-center'>
              <Users className='h-12 w-12 text-muted-foreground/50 mb-4' />
              <h3 className='text-lg font-semibold'>No authors found</h3>
              <p className='text-muted-foreground mb-4'>
                {search
                  ? 'Try a different search term'
                  : 'Get started by adding your first author'}
              </p>
              {!search && (
                <Button onClick={handleOpenCreate}>
                  <Plus className='mr-2 h-4 w-4' />
                  Add Author
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Author</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className='text-center'>Posts</TableHead>
                  <TableHead className='text-center'>Status</TableHead>
                  <TableHead>Links</TableHead>
                  <TableHead className='w-17.5'></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAuthors.map((author: BlogAuthor) => (
                  <TableRow key={author.id}>
                    <TableCell>
                      <div className='flex items-center gap-3'>
                        <Avatar>
                          <AvatarImage src={author.avatar_url || undefined} />
                          <AvatarFallback>
                            {getInitials(author.display_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className='font-medium'>{author.display_name}</p>
                          <p className='text-sm text-muted-foreground'>
                            @{author.slug}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={ROLE_BADGES[author.role].variant}>
                        {ROLE_BADGES[author.role].label}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-center'>
                      <span className='inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-medium'>
                        {author.post_count || 0}
                      </span>
                    </TableCell>
                    <TableCell className='text-center'>
                      {author.is_active ? (
                        <Badge variant='default' className='gap-1'>
                          <CheckCircle className='h-3 w-3' />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant='secondary' className='gap-1'>
                          <XCircle className='h-3 w-3' />
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className='flex items-center gap-2'>
                        {author.website_url && (
                          <a
                            href={author.website_url}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-muted-foreground hover:text-foreground'
                          >
                            <Globe className='h-4 w-4' />
                          </a>
                        )}
                        {author.twitter_handle && (
                          <a
                            href={`https://twitter.com/${author.twitter_handle}`}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-muted-foreground hover:text-foreground'
                          >
                            <Twitter className='h-4 w-4' />
                          </a>
                        )}
                        {author.linkedin_url && (
                          <a
                            href={author.linkedin_url}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-muted-foreground hover:text-foreground'
                          >
                            <Linkedin className='h-4 w-4' />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant='ghost' size='icon'>
                            <MoreHorizontal className='h-4 w-4' />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end'>
                          <DropdownMenuItem
                            onClick={() => handleOpenEdit(author)}
                          >
                            <Edit className='mr-2 h-4 w-4' />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(author)}
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
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>
              {editingAuthor ? 'Edit Author' : 'Add Author'}
            </DialogTitle>
            <DialogDescription>
              {editingAuthor
                ? 'Update the author details below'
                : 'Add a new author who can write blog posts'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className='grid gap-4 py-4 max-h-[60vh] overflow-y-auto'>
              <div className='grid grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='display_name'>Display Name *</Label>
                  <Input
                    id='display_name'
                    value={formData.display_name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder='e.g., John Doe'
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
                    placeholder='e.g., john-doe'
                  />
                </div>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='bio'>Bio</Label>
                <Textarea
                  id='bio'
                  value={formData.bio}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, bio: e.target.value }))
                  }
                  placeholder='A brief bio about the author...'
                  rows={3}
                />
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='avatar_url'>Avatar URL</Label>
                  <Input
                    id='avatar_url'
                    value={formData.avatar_url}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        avatar_url: e.target.value,
                      }))
                    }
                    placeholder='https://example.com/avatar.jpg'
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='role'>Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: AuthorFormData['role']) =>
                      setFormData((prev) => ({ ...prev, role: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='admin'>Admin</SelectItem>
                      <SelectItem value='editor'>Editor</SelectItem>
                      <SelectItem value='author'>Author</SelectItem>
                      <SelectItem value='contributor'>Contributor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className='grid grid-cols-3 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='website_url'>Website</Label>
                  <Input
                    id='website_url'
                    value={formData.website_url}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        website_url: e.target.value,
                      }))
                    }
                    placeholder='https://example.com'
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='twitter_handle'>Twitter</Label>
                  <Input
                    id='twitter_handle'
                    value={formData.twitter_handle}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        twitter_handle: e.target.value,
                      }))
                    }
                    placeholder='@johndoe'
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='linkedin_url'>LinkedIn</Label>
                  <Input
                    id='linkedin_url'
                    value={formData.linkedin_url}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        linkedin_url: e.target.value,
                      }))
                    }
                    placeholder='https://linkedin.com/in/johndoe'
                  />
                </div>
              </div>

              <div className='flex items-center gap-2'>
                <Switch
                  id='is_active'
                  checked={formData.is_active}
                  onCheckedChange={(checked: boolean) =>
                    setFormData((prev) => ({ ...prev, is_active: checked }))
                  }
                />
                <Label htmlFor='is_active'>Active author</Label>
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
                {editingAuthor ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Author</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;
              {authorToDelete?.display_name}&quot;? Their posts will remain but
              will need to be reassigned to another author.
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
