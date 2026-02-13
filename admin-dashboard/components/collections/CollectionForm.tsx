'use client'

import React, { useState, useEffect } from 'react'
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
import { Loader2 } from 'lucide-react'

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

export interface CollectionFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: CollectionFormData) => Promise<void>
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
  const isEditing = !!collection

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
    await onSubmit(formData)
  }

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

              {/* Image URLs */}
              <div className='grid grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='imageUrl'>Image URL</Label>
                  <Input
                    id='imageUrl'
                    value={formData.imageUrl}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        imageUrl: e.target.value,
                      }))
                    }
                    placeholder='https://...'
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='bannerUrl'>Banner URL</Label>
                  <Input
                    id='bannerUrl'
                    value={formData.bannerUrl}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        bannerUrl: e.target.value,
                      }))
                    }
                    placeholder='https://...'
                  />
                </div>
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
