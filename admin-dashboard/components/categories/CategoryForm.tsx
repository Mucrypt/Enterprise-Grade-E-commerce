'use client'

import React, { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useDropzone } from 'react-dropzone'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { X, Image as ImageIcon, Loader2 } from 'lucide-react'
import Image from 'next/image'

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  slug: z.string().optional(),
  description: z.string().optional(),
  parentId: z.string().optional().nullable(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  displayOrder: z.coerce.number().min(0).default(0),
  isActive: z.boolean().default(true),
})

type CategoryFormData = z.infer<typeof categorySchema>

// Use any for category since API returns snake_case
interface CategoryFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: CategoryFormData, files: MediaFiles) => Promise<void>
  category?: any | null
  categories: any[]
  isLoading?: boolean
}

interface MediaFiles {
  thumbnail?: File
  banner?: File
  icon?: File
}

interface ImagePreview {
  file: File
  preview: string
}

export function CategoryForm({
  open,
  onClose,
  onSubmit,
  category,
  categories,
  isLoading = false,
}: CategoryFormProps) {
  const [thumbnailPreview, setThumbnailPreview] = useState<ImagePreview | null>(
    null,
  )
  const [bannerPreview, setBannerPreview] = useState<ImagePreview | null>(null)
  const [iconPreview, setIconPreview] = useState<ImagePreview | null>(null)

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      parentId: null,
      metaTitle: '',
      metaDescription: '',
      displayOrder: 0,
      isActive: true,
    },
  })

  const nameValue = watch('name')

  // Auto-generate slug from name
  useEffect(() => {
    if (nameValue && !category) {
      const slug = nameValue
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
      setValue('slug', slug)
    }
  }, [nameValue, category, setValue])

  // Reset form when category changes
  useEffect(() => {
    if (category) {
      reset({
        name: category.name,
        slug: category.slug,
        description: category.description || '',
        parentId: category.parent_id || category.parentId || null,
        metaTitle: category.meta_title || category.metaTitle || '',
        metaDescription:
          category.meta_description || category.metaDescription || '',
        displayOrder: category.display_order ?? category.displayOrder ?? 0,
        isActive: category.is_active ?? category.isActive ?? true,
      })
      // Clear file previews for existing images
      setThumbnailPreview(null)
      setBannerPreview(null)
      setIconPreview(null)
    } else {
      reset({
        name: '',
        slug: '',
        description: '',
        parentId: null,
        metaTitle: '',
        metaDescription: '',
        displayOrder: 0,
        isActive: true,
      })
      setThumbnailPreview(null)
      setBannerPreview(null)
      setIconPreview(null)
    }
  }, [category, reset])

  const thumbnailDropzone = useDropzone({
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.gif'] },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0]
        setThumbnailPreview({ file, preview: URL.createObjectURL(file) })
      }
    },
  })

  const bannerDropzone = useDropzone({
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.gif'] },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0]
        setBannerPreview({ file, preview: URL.createObjectURL(file) })
      }
    },
  })

  const iconDropzone = useDropzone({
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.gif'] },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0]
        setIconPreview({ file, preview: URL.createObjectURL(file) })
      }
    },
  })

  const handleFormSubmit = async (data: CategoryFormData) => {
    const files: MediaFiles = {}
    if (thumbnailPreview?.file) files.thumbnail = thumbnailPreview.file
    if (bannerPreview?.file) files.banner = bannerPreview.file
    if (iconPreview?.file) files.icon = iconPreview.file

    await onSubmit(data, files)
  }

  const getExistingMediaUrl = (purpose: string) => {
    if (!category?.media) return null
    const media = category.media.find((m: any) => m.media_purpose === purpose)
    return (
      media?.cdn_urls?.medium || media?.cdn_urls?.original || media?.file_path
    )
  }

  // Filter out current category from parent options
  const parentOptions = categories.filter((c) => c.id !== category?.id)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className='max-w-3xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>
            {category ? 'Edit Category' : 'Create Category'}
          </DialogTitle>
          <DialogDescription>
            {category
              ? 'Update category information and media'
              : 'Add a new category to organize your products'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className='space-y-6'>
          <Tabs defaultValue='basic' className='w-full'>
            <TabsList className='grid w-full grid-cols-3'>
              <TabsTrigger value='basic'>Basic Info</TabsTrigger>
              <TabsTrigger value='media'>Media</TabsTrigger>
              <TabsTrigger value='seo'>SEO</TabsTrigger>
            </TabsList>

            {/* Basic Info Tab */}
            <TabsContent value='basic' className='space-y-4 mt-4'>
              <div className='grid grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='name'>Name *</Label>
                  <Input
                    id='name'
                    {...register('name')}
                    placeholder='Category name'
                    className={errors.name ? 'border-destructive' : ''}
                  />
                  {errors.name && (
                    <p className='text-sm text-destructive'>
                      {errors.name.message}
                    </p>
                  )}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='slug'>Slug</Label>
                  <Input
                    id='slug'
                    {...register('slug')}
                    placeholder='category-slug'
                  />
                </div>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='description'>Description</Label>
                <Textarea
                  id='description'
                  {...register('description')}
                  placeholder='Category description'
                  rows={3}
                />
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <Label>Parent Category</Label>
                  <Controller
                    name='parentId'
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value || 'none'}
                        onValueChange={(val: string) =>
                          field.onChange(val === 'none' ? null : val)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder='Select parent category' />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='none'>
                            No parent (top level)
                          </SelectItem>
                          {parentOptions.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='displayOrder'>Display Order</Label>
                  <Input
                    id='displayOrder'
                    type='number'
                    {...register('displayOrder')}
                    min={0}
                  />
                </div>
              </div>

              <div className='flex items-center space-x-2'>
                <Controller
                  name='isActive'
                  control={control}
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      id='isActive'
                    />
                  )}
                />
                <Label htmlFor='isActive'>Active</Label>
              </div>
            </TabsContent>

            {/* Media Tab */}
            <TabsContent value='media' className='space-y-4 mt-4'>
              <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                {/* Thumbnail */}
                <Card>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-sm'>Thumbnail</CardTitle>
                    <CardDescription className='text-xs'>
                      Main category image (400x400)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div
                      {...thumbnailDropzone.getRootProps()}
                      className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
                        ${
                          thumbnailDropzone.isDragActive
                            ? 'border-primary bg-primary/5'
                            : 'border-muted-foreground/25 hover:border-primary/50'
                        }`}
                    >
                      <input {...thumbnailDropzone.getInputProps()} />
                      {thumbnailPreview ? (
                        <div className='relative'>
                          <Image
                            src={thumbnailPreview.preview}
                            alt='Thumbnail preview'
                            width={150}
                            height={150}
                            className='mx-auto rounded object-cover'
                          />
                          <Button
                            type='button'
                            variant='destructive'
                            size='icon'
                            className='absolute top-0 right-0 h-6 w-6'
                            onClick={(e) => {
                              e.stopPropagation()
                              setThumbnailPreview(null)
                            }}
                          >
                            <X className='h-3 w-3' />
                          </Button>
                        </div>
                      ) : getExistingMediaUrl('thumbnail') ? (
                        <div className='relative'>
                          <Image
                            src={getExistingMediaUrl('thumbnail')!}
                            alt='Existing thumbnail'
                            width={150}
                            height={150}
                            className='mx-auto rounded object-cover'
                          />
                          <p className='text-xs text-muted-foreground mt-2'>
                            Drop new image to replace
                          </p>
                        </div>
                      ) : (
                        <div className='py-4'>
                          <ImageIcon className='mx-auto h-8 w-8 text-muted-foreground mb-2' />
                          <p className='text-xs text-muted-foreground'>
                            Drop image or click to upload
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Banner */}
                <Card>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-sm'>Banner</CardTitle>
                    <CardDescription className='text-xs'>
                      Category banner (1200x400)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div
                      {...bannerDropzone.getRootProps()}
                      className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
                        ${
                          bannerDropzone.isDragActive
                            ? 'border-primary bg-primary/5'
                            : 'border-muted-foreground/25 hover:border-primary/50'
                        }`}
                    >
                      <input {...bannerDropzone.getInputProps()} />
                      {bannerPreview ? (
                        <div className='relative'>
                          <Image
                            src={bannerPreview.preview}
                            alt='Banner preview'
                            width={150}
                            height={50}
                            className='mx-auto rounded object-cover'
                          />
                          <Button
                            type='button'
                            variant='destructive'
                            size='icon'
                            className='absolute top-0 right-0 h-6 w-6'
                            onClick={(e) => {
                              e.stopPropagation()
                              setBannerPreview(null)
                            }}
                          >
                            <X className='h-3 w-3' />
                          </Button>
                        </div>
                      ) : getExistingMediaUrl('banner') ? (
                        <div className='relative'>
                          <Image
                            src={getExistingMediaUrl('banner')!}
                            alt='Existing banner'
                            width={150}
                            height={50}
                            className='mx-auto rounded object-cover'
                          />
                          <p className='text-xs text-muted-foreground mt-2'>
                            Drop new image to replace
                          </p>
                        </div>
                      ) : (
                        <div className='py-4'>
                          <ImageIcon className='mx-auto h-8 w-8 text-muted-foreground mb-2' />
                          <p className='text-xs text-muted-foreground'>
                            Drop image or click to upload
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Icon */}
                <Card>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-sm'>Icon</CardTitle>
                    <CardDescription className='text-xs'>
                      Category icon (64x64)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div
                      {...iconDropzone.getRootProps()}
                      className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
                        ${
                          iconDropzone.isDragActive
                            ? 'border-primary bg-primary/5'
                            : 'border-muted-foreground/25 hover:border-primary/50'
                        }`}
                    >
                      <input {...iconDropzone.getInputProps()} />
                      {iconPreview ? (
                        <div className='relative'>
                          <Image
                            src={iconPreview.preview}
                            alt='Icon preview'
                            width={64}
                            height={64}
                            className='mx-auto rounded object-cover'
                          />
                          <Button
                            type='button'
                            variant='destructive'
                            size='icon'
                            className='absolute top-0 right-0 h-6 w-6'
                            onClick={(e) => {
                              e.stopPropagation()
                              setIconPreview(null)
                            }}
                          >
                            <X className='h-3 w-3' />
                          </Button>
                        </div>
                      ) : getExistingMediaUrl('icon') ? (
                        <div className='relative'>
                          <Image
                            src={getExistingMediaUrl('icon')!}
                            alt='Existing icon'
                            width={64}
                            height={64}
                            className='mx-auto rounded object-cover'
                          />
                          <p className='text-xs text-muted-foreground mt-2'>
                            Drop new image to replace
                          </p>
                        </div>
                      ) : (
                        <div className='py-4'>
                          <ImageIcon className='mx-auto h-8 w-8 text-muted-foreground mb-2' />
                          <p className='text-xs text-muted-foreground'>
                            Drop image or click to upload
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* SEO Tab */}
            <TabsContent value='seo' className='space-y-4 mt-4'>
              <div className='space-y-2'>
                <Label htmlFor='metaTitle'>Meta Title</Label>
                <Input
                  id='metaTitle'
                  {...register('metaTitle')}
                  placeholder='SEO title (defaults to category name)'
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='metaDescription'>Meta Description</Label>
                <Textarea
                  id='metaDescription'
                  {...register('metaDescription')}
                  placeholder='SEO description'
                  rows={3}
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={isLoading}>
              {isLoading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              {category ? 'Update Category' : 'Create Category'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default CategoryForm
