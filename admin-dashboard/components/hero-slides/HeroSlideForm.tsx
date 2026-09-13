'use client'

import React, { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { X, Image as ImageIcon, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { ProductPicker } from '@/components/promotions/ProductPicker'
import { categoryService } from '@/services/category.service'
import { collectionService } from '@/services/collection.service'
import type { HeroSlide, HeroSlideFormData, HeroSlideType } from '@/services/hero-slide.service'

interface ImagePreview {
  file: File
  preview: string
}

export interface HeroSlideFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: HeroSlideFormData, file?: File) => Promise<void>
  slide?: HeroSlide | null
  isLoading?: boolean
}

const SLIDE_TYPE_OPTIONS: { value: HeroSlideType; label: string; hint: string }[] = [
  { value: 'custom', label: 'Custom Banner', hint: 'Your own image and copy -- a plain marketing slide' },
  { value: 'product', label: 'Single Product', hint: 'Spotlight one real product' },
  { value: 'category', label: 'Single Category', hint: 'Spotlight one real category' },
  { value: 'product_collection', label: 'Product Collection', hint: 'A real, existing product collection banner' },
  { value: 'category_collection', label: 'Category Collection', hint: 'A real, existing category collection banner' },
  { value: 'product_grid', label: 'Multiple Products (Grid)', hint: 'Several real products shown together in one slide' },
]

const emptyForm: HeroSlideFormData = {
  slideType: 'custom',
  eyebrow: '',
  title: '',
  description: '',
  imageUrl: '',
  ctaLabel: '',
  ctaLink: '',
  secondaryCtaLabel: '',
  secondaryCtaLink: '',
  productId: '',
  categoryId: '',
  productCollectionId: '',
  categoryCollectionId: '',
  isActive: true,
  position: 0,
  platform: 'both',
  startsAt: '',
  endsAt: '',
}

export function HeroSlideForm({ open, onClose, onSubmit, slide, isLoading = false }: HeroSlideFormProps) {
  const [formData, setFormData] = useState<HeroSlideFormData>(emptyForm)
  const [imagePreview, setImagePreview] = useState<ImagePreview | null>(null)
  const isEditing = !!slide

  const { data: categoriesData } = useQuery({
    queryKey: ['hero-slides', 'categories'],
    queryFn: () => categoryService.getCategories(),
    enabled: open && formData.slideType === 'category',
  })
  const categories = categoriesData?.data?.categories || []

  const { data: productCollectionsData } = useQuery({
    queryKey: ['hero-slides', 'product-collections'],
    queryFn: () => collectionService.getProductCollections({ limit: 100 }),
    enabled: open && formData.slideType === 'product_collection',
  })
  const productCollections = (productCollectionsData as any)?.data || []

  const { data: categoryCollectionsData } = useQuery({
    queryKey: ['hero-slides', 'category-collections'],
    queryFn: () => collectionService.getCategoryCollections({ limit: 100 }),
    enabled: open && formData.slideType === 'category_collection',
  })
  const categoryCollections = (categoryCollectionsData as any)?.data || []

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

  useEffect(() => {
    if (slide) {
      setFormData({
        slideType: slide.slide_type,
        eyebrow: slide.eyebrow || '',
        title: slide.title || '',
        description: slide.description || '',
        imageUrl: slide.image_url || '',
        ctaLabel: slide.cta_label || '',
        ctaLink: slide.cta_link || '',
        secondaryCtaLabel: slide.secondary_cta_label || '',
        secondaryCtaLink: slide.secondary_cta_link || '',
        productId: slide.product_id || '',
        categoryId: slide.category_id || '',
        productCollectionId: slide.product_collection_id || '',
        categoryCollectionId: slide.category_collection_id || '',
        isActive: slide.is_active,
        position: slide.position,
        platform: slide.platform,
        startsAt: slide.starts_at || '',
        endsAt: slide.ends_at || '',
      })
    } else {
      setFormData(emptyForm)
    }
    setImagePreview(null)
  }, [slide, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(formData, imagePreview?.file)
  }

  const needsCustomCopy = formData.slideType === 'custom' || formData.slideType === 'product_grid'
  const showImageUpload = formData.slideType === 'custom'
  const showCta = formData.slideType === 'custom'

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit' : 'Create'} Hero Slide</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update this hero slide.'
              : 'Add a new slide to the homepage hero carousel.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-5'>
          <div className='space-y-2'>
            <Label>Slide Type</Label>
            <Select
              value={formData.slideType}
              onValueChange={(v: HeroSlideType) => setFormData((prev) => ({ ...prev, slideType: v }))}
              disabled={isEditing}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SLIDE_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className='text-xs text-muted-foreground'>
              {SLIDE_TYPE_OPTIONS.find((o) => o.value === formData.slideType)?.hint}
            </p>
          </div>

          {formData.slideType === 'product' && (
            <div className='space-y-2'>
              <Label>Product</Label>
              <ProductPicker
                selectedProductIds={formData.productId ? [formData.productId] : []}
                onChange={(ids) => setFormData((prev) => ({ ...prev, productId: ids[0] || '' }))}
                multiple={false}
              />
            </div>
          )}

          {formData.slideType === 'category' && (
            <div className='space-y-2'>
              <Label>Category</Label>
              <Select
                value={formData.categoryId || undefined}
                onValueChange={(v: string) => setFormData((prev) => ({ ...prev, categoryId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder='Select a category' />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat: any) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {formData.slideType === 'product_collection' && (
            <div className='space-y-2'>
              <Label>Product Collection</Label>
              <Select
                value={formData.productCollectionId || undefined}
                onValueChange={(v: string) => setFormData((prev) => ({ ...prev, productCollectionId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder='Select a collection' />
                </SelectTrigger>
                <SelectContent>
                  {productCollections.map((col: any) => (
                    <SelectItem key={col.id} value={col.id}>
                      {col.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className='text-xs text-muted-foreground'>
                Don&apos;t see the collection you want?{' '}
                <Link href='/collections' className='underline'>
                  Create one in Collections management
                </Link>{' '}
                first.
              </p>
            </div>
          )}

          {formData.slideType === 'category_collection' && (
            <div className='space-y-2'>
              <Label>Category Collection</Label>
              <Select
                value={formData.categoryCollectionId || undefined}
                onValueChange={(v: string) => setFormData((prev) => ({ ...prev, categoryCollectionId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder='Select a collection' />
                </SelectTrigger>
                <SelectContent>
                  {categoryCollections.map((col: any) => (
                    <SelectItem key={col.id} value={col.id}>
                      {col.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className='text-xs text-muted-foreground'>
                Don&apos;t see the collection you want?{' '}
                <Link href='/collections' className='underline'>
                  Create one in Collections management
                </Link>{' '}
                first.
              </p>
            </div>
          )}

          {formData.slideType === 'product_grid' && !isEditing && (
            <p className='text-xs text-muted-foreground rounded-md border border-dashed p-3'>
              Create this slide first, then add up to 4 products to it from the
              slide list.
            </p>
          )}

          <div className='space-y-2'>
            <Label>Eyebrow {needsCustomCopy ? '' : '(optional override)'}</Label>
            <Input
              value={formData.eyebrow}
              onChange={(e) => setFormData((prev) => ({ ...prev, eyebrow: e.target.value }))}
              placeholder='PROFESSIONAL TOOLS & WORKSHOP EQUIPMENT'
            />
          </div>

          <div className='space-y-2'>
            <Label>Title {needsCustomCopy ? '' : '(optional override)'}</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              placeholder={needsCustomCopy ? 'Required' : 'Falls back to the real name'}
              required={needsCustomCopy}
            />
          </div>

          <div className='space-y-2'>
            <Label>Description {needsCustomCopy ? '' : '(optional override)'}</Label>
            <Textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          {showImageUpload && (
            <div className='space-y-2'>
              <Label>Image</Label>
              <div
                {...imageDropzone.getRootProps()}
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
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
                      alt='Preview'
                      width={280}
                      height={140}
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
                ) : formData.imageUrl ? (
                  <div className='relative'>
                    <Image
                      src={formData.imageUrl}
                      alt='Existing'
                      width={280}
                      height={140}
                      className='mx-auto rounded object-cover'
                    />
                    <p className='text-xs text-muted-foreground mt-2'>Drop new image to replace</p>
                  </div>
                ) : (
                  <div className='py-4'>
                    <ImageIcon className='mx-auto h-8 w-8 text-muted-foreground mb-2' />
                    <p className='text-xs text-muted-foreground'>Drop image or click to upload</p>
                  </div>
                )}
              </div>
              <Input
                value={formData.imageUrl}
                onChange={(e) => setFormData((prev) => ({ ...prev, imageUrl: e.target.value }))}
                placeholder='Or paste an existing image URL'
                className='text-xs'
              />
            </div>
          )}

          {showCta && (
            <div className='grid grid-cols-2 gap-3'>
              <div className='space-y-2'>
                <Label>Primary button label</Label>
                <Input
                  value={formData.ctaLabel}
                  onChange={(e) => setFormData((prev) => ({ ...prev, ctaLabel: e.target.value }))}
                />
              </div>
              <div className='space-y-2'>
                <Label>Primary button link</Label>
                <Input
                  value={formData.ctaLink}
                  onChange={(e) => setFormData((prev) => ({ ...prev, ctaLink: e.target.value }))}
                  placeholder='/products'
                />
              </div>
              <div className='space-y-2'>
                <Label>Secondary button label</Label>
                <Input
                  value={formData.secondaryCtaLabel}
                  onChange={(e) => setFormData((prev) => ({ ...prev, secondaryCtaLabel: e.target.value }))}
                />
              </div>
              <div className='space-y-2'>
                <Label>Secondary button link</Label>
                <Input
                  value={formData.secondaryCtaLink}
                  onChange={(e) => setFormData((prev) => ({ ...prev, secondaryCtaLink: e.target.value }))}
                />
              </div>
            </div>
          )}

          <div className='space-y-2'>
            <Label>Platform</Label>
            <RadioGroup
              value={formData.platform}
              onValueChange={(v: 'both' | 'web' | 'mobile') => setFormData((prev) => ({ ...prev, platform: v }))}
              className='flex gap-4'
            >
              <div className='flex items-center gap-2'>
                <RadioGroupItem value='both' id='platform-both' />
                <Label htmlFor='platform-both' className='font-normal'>Both</Label>
              </div>
              <div className='flex items-center gap-2'>
                <RadioGroupItem value='web' id='platform-web' />
                <Label htmlFor='platform-web' className='font-normal'>Web only</Label>
              </div>
              <div className='flex items-center gap-2'>
                <RadioGroupItem value='mobile' id='platform-mobile' />
                <Label htmlFor='platform-mobile' className='font-normal'>Mobile only</Label>
              </div>
            </RadioGroup>
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label>Start Date (optional)</Label>
              <Input
                type='datetime-local'
                value={formData.startsAt?.slice(0, 16) || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, startsAt: e.target.value }))}
              />
            </div>
            <div className='space-y-2'>
              <Label>End Date (optional)</Label>
              <Input
                type='datetime-local'
                value={formData.endsAt?.slice(0, 16) || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, endsAt: e.target.value }))}
              />
            </div>
          </div>

          <div className='flex items-center gap-2'>
            <Switch
              id='isActive'
              checked={formData.isActive}
              onCheckedChange={(checked: boolean) => setFormData((prev) => ({ ...prev, isActive: checked }))}
            />
            <Label htmlFor='isActive'>Active</Label>
          </div>

          <div className='flex justify-end gap-3 pt-4 border-t'>
            <Button type='button' variant='outline' onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type='submit' disabled={isLoading}>
              {isLoading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              {isEditing ? 'Update' : 'Create'} Slide
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
