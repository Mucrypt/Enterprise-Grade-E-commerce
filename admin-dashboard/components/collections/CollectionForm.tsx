'use client'

import React, { useState, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { X, Image as ImageIcon, Loader2 } from 'lucide-react'

interface ImagePreview {
  file: File
  preview: string
}

export interface CollectionFormData {
  name: string
  slug: string
  description?: string
  shortDescription?: string
  visibility: 'public' | 'private' | 'hidden'
  displayOrder: string
  position: number
  isActive: boolean
  isFeatured: boolean
  metaTitle?: string
  metaDescription?: string
  metaKeywords?: string
  startsAt?: string
  endsAt?: string
  imageUrl?: string
  bannerUrl?: string
}

export interface CollectionMediaFiles {
  image?: File
  banner?: File
}

export interface CollectionFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: CollectionFormData, files: CollectionMediaFiles) => Promise<void>
  collection?: any | null
  isLoading?: boolean
  type: 'product' | 'category'
}

const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

const productDisplayOrders = [
  { value: 'manual', label: 'Manual' },
  { value: 'newest', label: 'Newest First' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
]

const categoryDisplayOrders = [
  { value: 'manual', label: 'Manual' },
  { value: 'alphabetical', label: 'Alphabetical' },
  { value: 'newest', label: 'Newest First' },
  { value: 'popular', label: 'Most Popular' },
]

export function CollectionForm({
  open,
  onClose,
  onSubmit,
  collection,
  isLoading = false,
  type,
}: CollectionFormProps) {
  const [formData, setFormData] = useState<CollectionFormData>({
    name: '',
    slug: '',
    description: '',
    shortDescription: '',
    visibility: 'public',
    displayOrder: 'manual',
    position: 0,
    isActive: true,
    isFeatured: false,
    metaTitle: '',
    metaDescription: '',
    metaKeywords: '',
    startsAt: '',
    endsAt: '',
    imageUrl: '',
    bannerUrl: '',
  })

  const [autoSlug, setAutoSlug] = useState(true)
  const [imagePreview, setImagePreview] = useState<ImagePreview | null>(null)
  const [bannerPreview, setBannerPreview] = useState<ImagePreview | null>(null)
  const isEditing = !!collection

  const imageDropzone = useDropzone({
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.gif'] },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0]
        setImagePreview({ file, preview: URL.createObjectURL(file) })
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

  useEffect(() => {
    if (collection) {
      setFormData({
        name: collection.name || '',
        slug: collection.slug || '',
        description: collection.description || '',
        shortDescription:
          collection.short_description || collection.shortDescription || '',
        visibility: collection.visibility || 'public',
        displayOrder:
          collection.display_order || collection.displayOrder || 'manual',
        position: collection.position || 0,
        isActive: collection.is_active ?? collection.isActive ?? true,
        isFeatured: collection.is_featured ?? collection.isFeatured ?? false,
        metaTitle: collection.meta_title || collection.metaTitle || '',
        metaDescription:
          collection.meta_description || collection.metaDescription || '',
        metaKeywords: collection.meta_keywords || collection.metaKeywords || '',
        startsAt: collection.starts_at || collection.startsAt || '',
        endsAt: collection.ends_at || collection.endsAt || '',
        imageUrl: collection.image_url || collection.imageUrl || '',
        bannerUrl: collection.banner_url || collection.bannerUrl || '',
      })
      setAutoSlug(false)
    } else {
      setFormData({
        name: '',
        slug: '',
        description: '',
        shortDescription: '',
        visibility: 'public',
        displayOrder: 'manual',
        position: 0,
        isActive: true,
        isFeatured: false,
        metaTitle: '',
        metaDescription: '',
        metaKeywords: '',
        startsAt: '',
        endsAt: '',
        imageUrl: '',
        bannerUrl: '',
      })
      setAutoSlug(true)
    }
    // A previous edit's dropped-but-not-yet-saved file must never leak
    // into the next collection this dialog opens for.
    setImagePreview(null)
    setBannerPreview(null)
  }, [collection, open])

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: autoSlug ? generateSlug(name) : prev.slug,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const files: CollectionMediaFiles = {}
    if (imagePreview?.file) files.image = imagePreview.file
    if (bannerPreview?.file) files.banner = bannerPreview.file
    await onSubmit(formData, files)
  }

  const getExistingImageUrl = () => formData.imageUrl || null
  const getExistingBannerUrl = () => formData.bannerUrl || null

  const displayOrders =
    type === 'product' ? productDisplayOrders : categoryDisplayOrders

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit' : 'Create'}{' '}
            {type === 'product' ? 'Product' : 'Category'} Collection
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the collection details below.'
              : `Create a new ${type} collection to organize your ${
                  type === 'product' ? 'products' : 'categories'
                }.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-6'>
          <Tabs defaultValue='basic' className='w-full'>
            <TabsList className='grid w-full grid-cols-3'>
              <TabsTrigger value='basic'>Basic Info</TabsTrigger>
              <TabsTrigger value='display'>Display</TabsTrigger>
              <TabsTrigger value='seo'>SEO</TabsTrigger>
            </TabsList>

            <TabsContent value='basic' className='space-y-4 mt-4'>
              {/* Name */}
              <div className='space-y-2'>
                <Label htmlFor='name'>Name *</Label>
                <Input
                  id='name'
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder='Collection name'
                  required
                />
              </div>

              {/* Slug */}
              <div className='space-y-2'>
                <div className='flex items-center justify-between'>
                  <Label htmlFor='slug'>Slug *</Label>
                  {!isEditing && (
                    <label className='flex items-center gap-2 text-sm'>
                      <input
                        type='checkbox'
                        checked={autoSlug}
                        onChange={(e) => setAutoSlug(e.target.checked)}
                        className='rounded'
                      />
                      Auto-generate
                    </label>
                  )}
                </div>
                <Input
                  id='slug'
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, slug: e.target.value }))
                  }
                  placeholder='collection-slug'
                  disabled={autoSlug && !isEditing}
                  required
                />
              </div>

              {/* Short Description */}
              <div className='space-y-2'>
                <Label htmlFor='shortDescription'>Short Description</Label>
                <Input
                  id='shortDescription'
                  value={formData.shortDescription}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      shortDescription: e.target.value,
                    }))
                  }
                  placeholder='Brief description (max 500 chars)'
                  maxLength={500}
                />
              </div>

              {/* Description */}
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
                  placeholder='Detailed description'
                  rows={3}
                />
              </div>

              {/* Image / Banner uploads -- real drag-and-drop, same
                  upload -> optimize -> store pipeline as Category media,
                  not a manually-pasted URL. A real URL still works too
                  (e.g. an already-hosted image) via the fields below the
                  dropzones -- a dropped file always wins over whatever's
                  typed there when both are present. */}
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <Card>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-sm'>Image</CardTitle>
                    <CardDescription className='text-xs'>
                      Card/tile image shown for this collection
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div
                      {...imageDropzone.getRootProps()}
                      className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
                        ${
                          imageDropzone.isDragActive
                            ? 'border-primary bg-primary/5'
                            : 'border-muted-foreground/25 hover:border-primary/50'
                        }`}
                    >
                      <input {...imageDropzone.getInputProps()} />
                      {imagePreview ? (
                        <div className='relative'>
                          <Image
                            src={imagePreview.preview}
                            alt='Image preview'
                            width={200}
                            height={120}
                            className='mx-auto rounded object-cover'
                          />
                          <Button
                            type='button'
                            variant='destructive'
                            size='icon'
                            className='absolute top-0 right-0 h-6 w-6'
                            onClick={(e) => {
                              e.stopPropagation()
                              setImagePreview(null)
                            }}
                          >
                            <X className='h-3 w-3' />
                          </Button>
                        </div>
                      ) : getExistingImageUrl() ? (
                        <div className='relative'>
                          <Image
                            src={getExistingImageUrl()!}
                            alt='Existing image'
                            width={200}
                            height={120}
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
                    <div className='mt-2 space-y-1'>
                      <Label htmlFor='imageUrl' className='text-xs text-muted-foreground'>
                        Or paste an existing image URL
                      </Label>
                      <Input
                        id='imageUrl'
                        value={formData.imageUrl}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, imageUrl: e.target.value }))
                        }
                        placeholder='https://...'
                        className='text-xs'
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-sm'>Banner</CardTitle>
                    <CardDescription className='text-xs'>
                      Wide hero image (e.g. 1200x400) for the collection&apos;s page
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
                            width={200}
                            height={120}
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
                      ) : getExistingBannerUrl() ? (
                        <div className='relative'>
                          <Image
                            src={getExistingBannerUrl()!}
                            alt='Existing banner'
                            width={200}
                            height={120}
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
                    <div className='mt-2 space-y-1'>
                      <Label htmlFor='bannerUrl' className='text-xs text-muted-foreground'>
                        Or paste an existing image URL
                      </Label>
                      <Input
                        id='bannerUrl'
                        value={formData.bannerUrl}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, bannerUrl: e.target.value }))
                        }
                        placeholder='https://...'
                        className='text-xs'
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value='display' className='space-y-4 mt-4'>
              {/* Visibility */}
              <div className='space-y-2'>
                <Label>Visibility</Label>
                <Select
                  value={formData.visibility}
                  onValueChange={(v: 'public' | 'private' | 'hidden') =>
                    setFormData((prev) => ({ ...prev, visibility: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='public'>Public</SelectItem>
                    <SelectItem value='private'>Private</SelectItem>
                    <SelectItem value='hidden'>Hidden</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Display Order */}
              <div className='space-y-2'>
                <Label>Display Order</Label>
                <Select
                  value={formData.displayOrder}
                  onValueChange={(v: string) =>
                    setFormData((prev) => ({ ...prev, displayOrder: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {displayOrders.map((order) => (
                      <SelectItem key={order.value} value={order.value}>
                        {order.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Position */}
              <div className='space-y-2'>
                <Label htmlFor='position'>Position</Label>
                <Input
                  id='position'
                  type='number'
                  value={formData.position}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      position: parseInt(e.target.value) || 0,
                    }))
                  }
                  min={0}
                />
              </div>

              {/* Scheduling */}
              <div className='grid grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='startsAt'>Start Date</Label>
                  <Input
                    id='startsAt'
                    type='datetime-local'
                    value={formData.startsAt?.slice(0, 16) || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        startsAt: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='endsAt'>End Date</Label>
                  <Input
                    id='endsAt'
                    type='datetime-local'
                    value={formData.endsAt?.slice(0, 16) || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        endsAt: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              {/* Switches */}
              <div className='flex items-center gap-6'>
                <div className='flex items-center gap-2'>
                  <Switch
                    id='isActive'
                    checked={formData.isActive}
                    onCheckedChange={(checked: boolean) =>
                      setFormData((prev) => ({ ...prev, isActive: checked }))
                    }
                  />
                  <Label htmlFor='isActive'>Active</Label>
                </div>
                <div className='flex items-center gap-2'>
                  <Switch
                    id='isFeatured'
                    checked={formData.isFeatured}
                    onCheckedChange={(checked: boolean) =>
                      setFormData((prev) => ({ ...prev, isFeatured: checked }))
                    }
                  />
                  <Label htmlFor='isFeatured'>Featured</Label>
                </div>
              </div>
            </TabsContent>

            <TabsContent value='seo' className='space-y-4 mt-4'>
              {/* Meta Title */}
              <div className='space-y-2'>
                <Label htmlFor='metaTitle'>Meta Title</Label>
                <Input
                  id='metaTitle'
                  value={formData.metaTitle}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      metaTitle: e.target.value,
                    }))
                  }
                  placeholder='SEO title'
                  maxLength={255}
                />
              </div>

              {/* Meta Description */}
              <div className='space-y-2'>
                <Label htmlFor='metaDescription'>Meta Description</Label>
                <Textarea
                  id='metaDescription'
                  value={formData.metaDescription}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      metaDescription: e.target.value,
                    }))
                  }
                  placeholder='SEO description'
                  rows={3}
                />
              </div>

              {/* Meta Keywords */}
              <div className='space-y-2'>
                <Label htmlFor='metaKeywords'>Meta Keywords</Label>
                <Input
                  id='metaKeywords'
                  value={formData.metaKeywords}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      metaKeywords: e.target.value,
                    }))
                  }
                  placeholder='keyword1, keyword2, keyword3'
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* Actions */}
          <div className='flex justify-end gap-3 pt-4 border-t'>
            <Button
              type='button'
              variant='outline'
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type='submit'
              disabled={isLoading || !formData.name || !formData.slug}
            >
              {isLoading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              {isEditing ? 'Update' : 'Create'} Collection
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
