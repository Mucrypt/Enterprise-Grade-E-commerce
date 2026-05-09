'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { blogService, BlogPost, CreatePostDTO, UpdatePostDTO, BlogCategory, BlogTag, BlogAuthor } from '@/services/blog.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Check, ChevronsUpDown, X, Save, Eye, Loader2, Image, Video, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BlogPostFormProps {
  post?: BlogPost
  onSubmit: (data: CreatePostDTO) => Promise<void>
  isSubmitting?: boolean
}

// Generate slug from title
const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function BlogPostForm({ post, onSubmit, isSubmitting }: BlogPostFormProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>(
    post?.tags?.map((t) => t.id) || []
  )
  const [tagsOpen, setTagsOpen] = useState(false)
  const [autoSlug, setAutoSlug] = useState(!post?.slug)
  const [activeTab, setActiveTab] = useState('content')

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreatePostDTO>({
    defaultValues: {
      title: post?.title || '',
      slug: post?.slug || '',
      excerpt: post?.excerpt || '',
      content: post?.content || '',
      content_html: post?.content_html || '',
      featured_image_url: post?.featured_image_url || '',
      featured_image_alt: post?.featured_image_alt || '',
      featured_video_url: post?.featured_video_url || '',
      author_id: post?.author_id || undefined,
      category_id: post?.category_id || undefined,
      status: post?.status || 'draft',
      visibility: post?.visibility || 'public',
      meta_title: post?.meta_title || '',
      meta_description: post?.meta_description || '',
      canonical_url: post?.canonical_url || '',
      og_title: post?.og_title || '',
      og_description: post?.og_description || '',
      og_image_url: post?.og_image_url || '',
      allow_comments: post?.allow_comments ?? true,
      is_featured: post?.is_featured || false,
      is_pinned: post?.is_pinned || false,
    },
  })

  const title = watch('title')
  const status = watch('status')
  const visibility = watch('visibility')

  // Auto-generate slug from title
  useEffect(() => {
    if (autoSlug && title) {
      setValue('slug', generateSlug(title))
    }
  }, [title, autoSlug, setValue])

  // Fetch categories
  const { data: categoriesResponse } = useQuery({
    queryKey: ['blog-categories'],
    queryFn: () => blogService.getCategories(),
  })

  // Fetch tags
  const { data: tagsResponse } = useQuery({
    queryKey: ['blog-tags'],
    queryFn: () => blogService.getTags(),
  })

  // Fetch authors
  const { data: authorsResponse } = useQuery({
    queryKey: ['blog-authors'],
    queryFn: () => blogService.getAuthors(),
  })

  const categories = categoriesResponse?.data || []
  const tags = tagsResponse?.data || []
  const authors = authorsResponse?.data || []

  const handleFormSubmit = async (data: CreatePostDTO) => {
    await onSubmit({
      ...data,
      tags: selectedTags,
    })
  }

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Post Details</CardTitle>
              <CardDescription>Basic information about your post</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  {...register('title', { required: 'Title is required' })}
                  placeholder="Enter post title"
                  className={cn(errors.title && 'border-destructive')}
                />
                {errors.title && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.title.message}
                  </p>
                )}
              </div>

              {/* Slug */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="slug">Slug</Label>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="auto-slug" className="text-sm font-normal">
                      Auto-generate
                    </Label>
                    <Switch
                      id="auto-slug"
                      checked={autoSlug}
                      onCheckedChange={setAutoSlug}
                    />
                  </div>
                </div>
                <Input
                  id="slug"
                  {...register('slug')}
                  placeholder="post-url-slug"
                  disabled={autoSlug}
                />
              </div>

              {/* Excerpt */}
              <div className="space-y-2">
                <Label htmlFor="excerpt">Excerpt</Label>
                <Textarea
                  id="excerpt"
                  {...register('excerpt')}
                  placeholder="Brief summary of the post..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Content Tabs - Markdown and HTML */}
          <Card>
            <CardHeader>
              <CardTitle>Content</CardTitle>
              <CardDescription>Write your post content</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="content">Markdown</TabsTrigger>
                  <TabsTrigger value="html">HTML</TabsTrigger>
                </TabsList>
                <TabsContent value="content" className="mt-4">
                  <Textarea
                    {...register('content')}
                    placeholder="Write your post content in Markdown..."
                    rows={20}
                    className="font-mono"
                  />
                </TabsContent>
                <TabsContent value="html" className="mt-4">
                  <Textarea
                    {...register('content_html')}
                    placeholder="HTML content (optional, for rich formatting)..."
                    rows={20}
                    className="font-mono"
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Featured Media */}
          <Card>
            <CardHeader>
              <CardTitle>Featured Media</CardTitle>
              <CardDescription>Featured image or video for the post</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="featured_image_url" className="flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    Featured Image URL
                  </Label>
                  <Input
                    id="featured_image_url"
                    {...register('featured_image_url')}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="featured_image_alt">Image Alt Text</Label>
                  <Input
                    id="featured_image_alt"
                    {...register('featured_image_alt')}
                    placeholder="Describe the image..."
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="featured_video_url" className="flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Featured Video URL (YouTube/Vimeo)
                </Label>
                <Input
                  id="featured_video_url"
                  {...register('featured_video_url')}
                  placeholder="https://youtube.com/watch?v=..."
                />
              </div>
            </CardContent>
          </Card>

          {/* SEO */}
          <Card>
            <CardHeader>
              <CardTitle>SEO Settings</CardTitle>
              <CardDescription>Optimize your post for search engines</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="meta_title">Meta Title</Label>
                <Input
                  id="meta_title"
                  {...register('meta_title')}
                  placeholder="SEO title (falls back to post title)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meta_description">Meta Description</Label>
                <Textarea
                  id="meta_description"
                  {...register('meta_description')}
                  placeholder="SEO description (150-160 characters recommended)"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="canonical_url">Canonical URL</Label>
                <Input
                  id="canonical_url"
                  {...register('canonical_url')}
                  placeholder="https://... (leave empty to use default)"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="og_title">Open Graph Title</Label>
                  <Input
                    id="og_title"
                    {...register('og_title')}
                    placeholder="Social share title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="og_image_url">Open Graph Image</Label>
                  <Input
                    id="og_image_url"
                    {...register('og_image_url')}
                    placeholder="https://... (1200x630 recommended)"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="og_description">Open Graph Description</Label>
                <Textarea
                  id="og_description"
                  {...register('og_description')}
                  placeholder="Description for social shares"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Publish Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Publish</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={status}
                  onValueChange={(value: string) => setValue('status', value as 'draft' | 'pending' | 'published' | 'scheduled' | 'archived')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending">Pending Review</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Visibility</Label>
                <Select
                  value={visibility}
                  onValueChange={(value: string) => setValue('visibility', value as 'public' | 'private' | 'password_protected')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="password_protected">Password Protected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is_featured">Featured Post</Label>
                <Switch
                  id="is_featured"
                  checked={watch('is_featured')}
                  onCheckedChange={(checked: boolean) => setValue('is_featured', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is_pinned">Pin to Top</Label>
                <Switch
                  id="is_pinned"
                  checked={watch('is_pinned')}
                  onCheckedChange={(checked: boolean) => setValue('is_pinned', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="allow_comments">Allow Comments</Label>
                <Switch
                  id="allow_comments"
                  checked={watch('allow_comments')}
                  onCheckedChange={(checked: boolean) => setValue('allow_comments', checked)}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Category */}
          <Card>
            <CardHeader>
              <CardTitle>Category</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={watch('category_id') || 'uncategorized'}
                onValueChange={(value: string) => setValue('category_id', value === 'uncategorized' ? undefined : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uncategorized">Uncategorized</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader>
              <CardTitle>Tags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Popover open={tagsOpen} onOpenChange={setTagsOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    Select tags
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Search tags..." />
                    <CommandList>
                      <CommandEmpty>No tags found.</CommandEmpty>
                      <CommandGroup>
                        {tags.map((tag) => (
                          <CommandItem
                            key={tag.id}
                            value={tag.name}
                            onSelect={() => toggleTag(tag.id)}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                selectedTags.includes(tag.id) ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            {tag.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedTags.map((tagId) => {
                    const tag = tags.find((t) => t.id === tagId)
                    return tag ? (
                      <Badge key={tag.id} variant="secondary" className="gap-1">
                        {tag.name}
                        <button
                          type="button"
                          onClick={() => toggleTag(tag.id)}
                          className="hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ) : null
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Author */}
          <Card>
            <CardHeader>
              <CardTitle>Author</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={watch('author_id') || ''}
                onValueChange={(value: string) => setValue('author_id', value || undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select author" />
                </SelectTrigger>
                <SelectContent>
                  {authors.map((author) => (
                    <SelectItem key={author.id} value={author.id}>
                      {author.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  )
}
