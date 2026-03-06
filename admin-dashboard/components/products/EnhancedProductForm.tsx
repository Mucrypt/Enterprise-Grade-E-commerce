'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { productService, CreateProductDTO } from '@/services/product.service'
import { categoryService } from '@/services/category.service'
import { brandService } from '@/services/brand.service'
import { mediaService } from '@/services/media.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toast } from 'sonner'
import {
  Loader2,
  Save,
  ArrowLeft,
  Package,
  DollarSign,
  Warehouse,
  ImageIcon,
  Search,
  Settings,
  HelpCircle,
  Sparkles,
  Plus,
} from 'lucide-react'
import { MediaManager, type MediaFile } from './MediaManager'
import { BrandForm } from '@/components/brands/BrandForm'
import type { Products } from '@/types'

// Comprehensive validation schema
const productSchema = z.object({
  // Basic Information
  name: z
    .string()
    .min(3, 'Name must be at least 3 characters')
    .max(200, 'Name must be less than 200 characters'),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Slug must be lowercase with hyphens only',
    ),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(10000, 'Description must be less than 10000 characters'),
  shortDescription: z
    .string()
    .max(500, 'Short description must be less than 500 characters')
    .optional()
    .or(z.literal('')),
  categoryId: z.string().min(1, 'Category is required'),
  brandId: z.string().optional().or(z.literal('')),

  // Pricing
  basePrice: z
    .number({ invalid_type_error: 'Price must be a number' })
    .min(0, 'Price must be positive'),
  salePrice: z
    .number()
    .min(0, 'Sale price must be positive')
    .optional()
    .nullable(),
  costPrice: z.number().min(0, 'Cost must be positive').optional().nullable(),
  taxRate: z
    .number()
    .min(0, 'Tax rate must be positive')
    .max(100, 'Tax rate must be less than 100')
    .optional()
    .nullable(),

  // Inventory
  sku: z
    .string()
    .min(1, 'SKU is required')
    .max(100, 'SKU must be less than 100 characters'),
  minOrderQuantity: z
    .number()
    .int()
    .min(1, 'Minimum order quantity must be at least 1')
    .optional()
    .nullable(),
  maxOrderQuantity: z
    .number()
    .int()
    .min(1, 'Maximum order quantity must be at least 1')
    .optional()
    .nullable(),
  isBackorderAllowed: z.boolean().default(false),

  // Shipping
  weight: z.number().min(0, 'Weight must be positive').optional().nullable(),
  weightUnit: z.enum(['kg', 'g', 'lb', 'oz']).default('kg'),
  length: z.number().min(0, 'Length must be positive').optional().nullable(),
  width: z.number().min(0, 'Width must be positive').optional().nullable(),
  height: z.number().min(0, 'Height must be positive').optional().nullable(),
  dimensionsUnit: z.enum(['cm', 'in', 'm']).default('cm'),
  isDigital: z.boolean().default(false),

  // SEO
  metaTitle: z
    .string()
    .max(70, 'Meta title should be less than 70 characters')
    .optional()
    .or(z.literal('')),
  metaDescription: z
    .string()
    .max(160, 'Meta description should be less than 160 characters')
    .optional()
    .or(z.literal('')),

  // Status
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
})

type ProductFormData = z.infer<typeof productSchema>

interface EnhancedProductFormProps {
  product?: Products
  mode: 'create' | 'edit'
}

// Helper to generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// Helper to safely parse numeric values from API (PostgreSQL returns DECIMAL as strings)
function parseNumber(value: unknown, defaultValue: number): number
function parseNumber(value: unknown, defaultValue: null): number | null
function parseNumber(
  value: unknown,
  defaultValue: number | null,
): number | null {
  if (value === null || value === undefined || value === '') {
    return defaultValue
  }
  const parsed = typeof value === 'number' ? value : parseFloat(String(value))
  return isNaN(parsed) ? defaultValue : parsed
}

export function EnhancedProductForm({
  product,
  mode,
}: EnhancedProductFormProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('basic')
  const [images, setImages] = useState<MediaFile[]>([])
  const [videos, setVideos] = useState<MediaFile[]>([])
  const [autoSlug, setAutoSlug] = useState(mode === 'create')
  const [isBrandFormOpen, setIsBrandFormOpen] = useState(false)
  const [mediaInitialized, setMediaInitialized] = useState(false)
  // Track initial media IDs to detect removals
  const [initialImageIds, setInitialImageIds] = useState<string[]>([])
  const [initialVideoIds, setInitialVideoIds] = useState<string[]>([])

  // Initialize existing media when editing a product
  useEffect(() => {
    if (mode === 'edit' && product && !mediaInitialized) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const productMedia = (product as any).media
      if (Array.isArray(productMedia)) {
        const existingImages: MediaFile[] = []
        const existingVideos: MediaFile[] = []
        const imageIds: string[] = []
        const videoIds: string[] = []

        productMedia.forEach((media: any) => {
          const mediaType = media.media_type || media.type
          const url = media.file_path || media.url
          const thumbnailUrl = media.cdn_urls?.thumbnail || media.thumbnail_url

          const mediaFile: MediaFile = {
            id: media.id,
            url: url,
            thumbnailUrl: thumbnailUrl,
            type: mediaType === 'video' ? 'video' : 'image',
            isPrimary: media.is_primary || media.isPrimary,
            position: media.position || 0,
          }

          if (mediaType === 'video') {
            existingVideos.push(mediaFile)
            videoIds.push(media.id)
          } else {
            existingImages.push(mediaFile)
            imageIds.push(media.id)
          }
        })

        // Sort by position
        existingImages.sort((a, b) => a.position - b.position)
        existingVideos.sort((a, b) => a.position - b.position)

        setImages(existingImages)
        setVideos(existingVideos)
        setInitialImageIds(imageIds)
        setInitialVideoIds(videoIds)
      }
      setMediaInitialized(true)
    }
  }, [mode, product, mediaInitialized])

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await categoryService.getCategories()
      return response?.data?.categories || []
    },
  })

  // Fetch brands
  const { data: brandsData } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const response = await brandService.getBrands()
      return response?.data?.brands || []
    },
  })

  const categories = categoriesData || []
  const brands = brandsData || []

  // Create brand mutation
  const createBrandMutation = useMutation({
    mutationFn: (data: any) => brandService.createBrand(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['brands'] })
      setIsBrandFormOpen(false)
      if (response?.data?.brand?.id) {
        setValue('brandId', response.data.brand.id)
      }
      toast.success('Brand created successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create brand')
    },
  })

  // Form setup
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isDirty, isValid },
    reset,
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name || '',
      slug: product?.slug || '',
      description: product?.description || '',
      shortDescription: product?.shortDescription || '',
      categoryId: product?.categoryId || '',
      brandId: product?.brandId || '',
      basePrice: parseNumber(product?.basePrice, 0),
      salePrice: parseNumber(product?.salePrice, null),
      costPrice: parseNumber(product?.costPrice, null),
      taxRate: parseNumber(product?.taxRate, null),
      sku: product?.sku || '',
      minOrderQuantity: parseNumber(product?.minOrderQuantity, 1),
      maxOrderQuantity: parseNumber(product?.maxOrderQuantity, null),
      isBackorderAllowed: product?.isBackorderAllowed || false,
      weight: parseNumber(product?.weight, null),
      weightUnit: (product?.weightUnit as 'kg' | 'g' | 'lb' | 'oz') || 'kg',
      length: parseNumber(product?.length, null),
      width: parseNumber(product?.width, null),
      height: parseNumber(product?.height, null),
      dimensionsUnit: (product?.dimensionsUnit as 'cm' | 'in' | 'm') || 'cm',
      isDigital: product?.isDigital || false,
      metaTitle: product?.metaTitle || '',
      metaDescription: product?.metaDescription || '',
      isActive: product?.isActive ?? true,
      isFeatured: product?.isFeatured || false,
    },
    mode: 'onChange',
  })

  // Watch name for auto-slug
  const watchedName = watch('name')
  const watchedSlug = watch('slug')

  // Auto-generate slug from name
  useEffect(() => {
    if (autoSlug && watchedName) {
      setValue('slug', generateSlug(watchedName), { shouldValidate: true })
    }
  }, [watchedName, autoSlug, setValue])

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const productData: CreateProductDTO = {
        sku: data.sku,
        name: data.name,
        slug: data.slug,
        description: data.description,
        shortDescription: data.shortDescription || undefined,
        categoryId: data.categoryId,
        brandId: data.brandId || undefined,
        basePrice: data.basePrice,
        salePrice: data.salePrice || undefined,
        costPrice: data.costPrice || undefined,
        taxRate: data.taxRate || undefined,
        weight: data.weight || undefined,
        weightUnit: data.weightUnit,
        length: data.length || undefined,
        width: data.width || undefined,
        height: data.height || undefined,
        dimensionsUnit: data.dimensionsUnit,
        isActive: data.isActive,
        isDigital: data.isDigital,
        isFeatured: data.isFeatured,
        isBackorderAllowed: data.isBackorderAllowed,
        minOrderQuantity: data.minOrderQuantity || undefined,
        maxOrderQuantity: data.maxOrderQuantity || undefined,
        metaTitle: data.metaTitle || undefined,
        metaDescription: data.metaDescription || undefined,
      }

      // Get files from media state
      const imageFiles = images
        .filter((img) => img.file && !img.error)
        .map((img) => img.file!)
      const videoFiles = videos
        .filter((vid) => vid.file && !vid.error)
        .map((vid) => vid.file!)

      return productService.createProductWithMedia(
        productData,
        imageFiles.length > 0 ? imageFiles : undefined,
        videoFiles.length > 0 ? videoFiles : undefined,
      )
    },
    onSuccess: () => {
      toast.success('Product created successfully!')
      queryClient.invalidateQueries({ queryKey: ['products'] })
      router.push('/products')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create product')
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      if (!product?.id) throw new Error('Product ID is required')

      const productData = {
        sku: data.sku,
        name: data.name,
        slug: data.slug,
        description: data.description,
        shortDescription: data.shortDescription || undefined,
        categoryId: data.categoryId,
        brandId: data.brandId || undefined,
        basePrice: data.basePrice,
        salePrice: data.salePrice || undefined,
        costPrice: data.costPrice || undefined,
        taxRate: data.taxRate || undefined,
        weight: data.weight || undefined,
        weightUnit: data.weightUnit,
        length: data.length || undefined,
        width: data.width || undefined,
        height: data.height || undefined,
        dimensionsUnit: data.dimensionsUnit,
        isActive: data.isActive,
        isDigital: data.isDigital,
        isFeatured: data.isFeatured,
        isBackorderAllowed: data.isBackorderAllowed,
        minOrderQuantity: data.minOrderQuantity || undefined,
        maxOrderQuantity: data.maxOrderQuantity || undefined,
        metaTitle: data.metaTitle || undefined,
        metaDescription: data.metaDescription || undefined,
      }

      // Delete removed images (ones that were in initial set but not in current set)
      const currentImageIds = images.map((img) => img.id).filter((id) => !id.startsWith('temp-'))
      const removedImageIds = initialImageIds.filter((id) => !currentImageIds.includes(id))
      
      // Delete removed videos
      const currentVideoIds = videos.map((vid) => vid.id).filter((id) => !id.startsWith('temp-'))
      const removedVideoIds = initialVideoIds.filter((id) => !currentVideoIds.includes(id))

      // Delete removed media from server
      const deletePromises = [
        ...removedImageIds.map((mediaId) => 
          mediaService.deleteProductMedia(product.id, mediaId).catch((err) => {
            console.error(`Failed to delete image ${mediaId}:`, err)
          })
        ),
        ...removedVideoIds.map((mediaId) => 
          mediaService.deleteProductMedia(product.id, mediaId).catch((err) => {
            console.error(`Failed to delete video ${mediaId}:`, err)
          })
        ),
      ]
      
      if (deletePromises.length > 0) {
        await Promise.all(deletePromises)
      }

      // Get new files from media state (files with temp IDs are newly added)
      const imageFiles = images
        .filter((img) => img.file && !img.error && img.id.startsWith('temp-'))
        .map((img) => img.file!)
      const videoFiles = videos
        .filter((vid) => vid.file && !vid.error && vid.id.startsWith('temp-'))
        .map((vid) => vid.file!)

      // Use updateProductWithMedia if there are new files
      if (imageFiles.length > 0 || videoFiles.length > 0) {
        return productService.updateProductWithMedia(
          product.id,
          productData,
          imageFiles.length > 0 ? imageFiles : undefined,
          videoFiles.length > 0 ? videoFiles : undefined,
        )
      }

      return productService.updateProduct(product.id, productData)
    },
    onSuccess: () => {
      toast.success('Product updated successfully!')
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product', product?.id] })
      router.push('/products')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update product')
    },
  })

  const onSubmit = (data: ProductFormData) => {
    if (mode === 'create') {
      createMutation.mutate(data)
    } else {
      updateMutation.mutate(data)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  // Calculate profit margin
  const basePrice = watch('basePrice')
  const costPrice = watch('costPrice')
  const profitMargin =
    basePrice && costPrice ? ((basePrice - costPrice) / basePrice) * 100 : null

  // Tab validation indicators
  const getTabErrors = (tab: string) => {
    const tabFields: Record<string, (keyof ProductFormData)[]> = {
      basic: ['name', 'slug', 'description', 'categoryId'],
      pricing: ['basePrice', 'salePrice', 'costPrice', 'taxRate'],
      inventory: ['sku', 'minOrderQuantity', 'maxOrderQuantity'],
      shipping: ['weight', 'length', 'width', 'height'],
      seo: ['metaTitle', 'metaDescription'],
    }
    return tabFields[tab]?.some((field) => errors[field]) || false
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            onClick={() => router.push('/products')}
          >
            <ArrowLeft className='h-5 w-5' />
          </Button>
          <div>
            <h1 className='text-2xl font-bold'>
              {mode === 'create' ? 'Create Product' : 'Edit Product'}
            </h1>
            <p className='text-muted-foreground'>
              {mode === 'create'
                ? 'Add a new product to your catalog'
                : `Editing: ${product?.name}`}
            </p>
          </div>
        </div>
        <div className='flex items-center gap-3'>
          <Button
            type='button'
            variant='outline'
            onClick={() => router.push('/products')}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type='submit' disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                {mode === 'create' ? 'Creating...' : 'Saving...'}
              </>
            ) : (
              <>
                <Save className='h-4 w-4 mr-2' />
                {mode === 'create' ? 'Create Product' : 'Save Changes'}
              </>
            )}
          </Button>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Main Content */}
        <div className='lg:col-span-2 space-y-6'>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className='grid grid-cols-5 w-full'>
              <TabsTrigger
                value='basic'
                className='flex items-center gap-2'
                data-error={getTabErrors('basic')}
              >
                <Package className='h-4 w-4' />
                <span className='hidden sm:inline'>Basic</span>
                {getTabErrors('basic') && (
                  <span className='h-2 w-2 rounded-full bg-destructive' />
                )}
              </TabsTrigger>
              <TabsTrigger
                value='pricing'
                className='flex items-center gap-2'
                data-error={getTabErrors('pricing')}
              >
                <DollarSign className='h-4 w-4' />
                <span className='hidden sm:inline'>Pricing</span>
                {getTabErrors('pricing') && (
                  <span className='h-2 w-2 rounded-full bg-destructive' />
                )}
              </TabsTrigger>
              <TabsTrigger
                value='inventory'
                className='flex items-center gap-2'
                data-error={getTabErrors('inventory')}
              >
                <Warehouse className='h-4 w-4' />
                <span className='hidden sm:inline'>Inventory</span>
                {getTabErrors('inventory') && (
                  <span className='h-2 w-2 rounded-full bg-destructive' />
                )}
              </TabsTrigger>
              <TabsTrigger value='media' className='flex items-center gap-2'>
                <ImageIcon className='h-4 w-4' />
                <span className='hidden sm:inline'>Media</span>
              </TabsTrigger>
              <TabsTrigger
                value='seo'
                className='flex items-center gap-2'
                data-error={getTabErrors('seo')}
              >
                <Search className='h-4 w-4' />
                <span className='hidden sm:inline'>SEO</span>
                {getTabErrors('seo') && (
                  <span className='h-2 w-2 rounded-full bg-destructive' />
                )}
              </TabsTrigger>
            </TabsList>

            {/* Basic Information Tab */}
            <TabsContent value='basic' className='space-y-6 mt-6'>
              <Card>
                <CardHeader>
                  <CardTitle>Product Information</CardTitle>
                  <CardDescription>
                    Basic details about your product
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                  {/* Product Name */}
                  <div className='space-y-2'>
                    <Label htmlFor='name'>
                      Product Name <span className='text-destructive'>*</span>
                    </Label>
                    <Input
                      id='name'
                      placeholder='e.g., Wireless Gaming Keyboard'
                      {...register('name')}
                      className={errors.name ? 'border-destructive' : ''}
                    />
                    {errors.name && (
                      <p className='text-sm text-destructive'>
                        {errors.name.message}
                      </p>
                    )}
                  </div>

                  {/* Slug */}
                  <div className='space-y-2'>
                    <div className='flex items-center justify-between'>
                      <Label htmlFor='slug'>
                        URL Slug <span className='text-destructive'>*</span>
                      </Label>
                      <div className='flex items-center gap-2'>
                        <Checkbox
                          id='auto-slug'
                          checked={autoSlug}
                          onCheckedChange={(
                            checked: boolean | 'indeterminate',
                          ) => setAutoSlug(checked === true)}
                        />
                        <Label
                          htmlFor='auto-slug'
                          className='text-sm font-normal cursor-pointer'
                        >
                          Auto-generate from name
                        </Label>
                      </div>
                    </div>
                    <Input
                      id='slug'
                      placeholder='wireless-gaming-keyboard'
                      {...register('slug')}
                      disabled={autoSlug}
                      className={errors.slug ? 'border-destructive' : ''}
                    />
                    {errors.slug && (
                      <p className='text-sm text-destructive'>
                        {errors.slug.message}
                      </p>
                    )}
                    <p className='text-xs text-muted-foreground'>
                      URL: /products/{watchedSlug || 'slug'}
                    </p>
                  </div>

                  {/* Short Description */}
                  <div className='space-y-2'>
                    <Label htmlFor='shortDescription'>Short Description</Label>
                    <Textarea
                      id='shortDescription'
                      placeholder='Brief summary for listings and previews...'
                      rows={2}
                      {...register('shortDescription')}
                      className={
                        errors.shortDescription ? 'border-destructive' : ''
                      }
                    />
                    {errors.shortDescription && (
                      <p className='text-sm text-destructive'>
                        {errors.shortDescription.message}
                      </p>
                    )}
                    <p className='text-xs text-muted-foreground'>
                      {(watch('shortDescription') || '').length}/500 characters
                    </p>
                  </div>

                  {/* Full Description */}
                  <div className='space-y-2'>
                    <Label htmlFor='description'>
                      Full Description{' '}
                      <span className='text-destructive'>*</span>
                    </Label>
                    <Textarea
                      id='description'
                      placeholder='Detailed product description with features, specifications, and benefits...'
                      rows={6}
                      {...register('description')}
                      className={errors.description ? 'border-destructive' : ''}
                    />
                    {errors.description && (
                      <p className='text-sm text-destructive'>
                        {errors.description.message}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Category & Brand */}
              <Card>
                <CardHeader>
                  <CardTitle>Organization</CardTitle>
                  <CardDescription>
                    Categorize your product for better discovery
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    {/* Category */}
                    <div className='space-y-2'>
                      <Label>
                        Category <span className='text-destructive'>*</span>
                      </Label>
                      <Controller
                        name='categoryId'
                        control={control}
                        render={({ field }) => (
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger
                              className={
                                errors.categoryId ? 'border-destructive' : ''
                              }
                            >
                              <SelectValue placeholder='Select category' />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((category: any) => (
                                <SelectItem
                                  key={category.id}
                                  value={category.id}
                                >
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {errors.categoryId && (
                        <p className='text-sm text-destructive'>
                          {errors.categoryId.message}
                        </p>
                      )}
                    </div>

                    {/* Brand */}
                    <div className='space-y-2'>
                      <Label>Brand</Label>
                      <div className='flex gap-2'>
                        <Controller
                          name='brandId'
                          control={control}
                          render={({ field }) => (
                            <Select
                              value={field.value || 'none'}
                              onValueChange={(val: string) =>
                                field.onChange(val === 'none' ? '' : val)
                              }
                            >
                              <SelectTrigger className='flex-1'>
                                <SelectValue placeholder='Select brand (optional)' />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value='none'>No brand</SelectItem>
                                {brands.map((brand: any) => (
                                  <SelectItem key={brand.id} value={brand.id}>
                                    {brand.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        <Button
                          type='button'
                          variant='outline'
                          size='icon'
                          onClick={() => setIsBrandFormOpen(true)}
                          title='Create new brand'
                        >
                          <Plus className='h-4 w-4' />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Pricing Tab */}
            <TabsContent value='pricing' className='space-y-6 mt-6'>
              <Card>
                <CardHeader>
                  <CardTitle>Pricing</CardTitle>
                  <CardDescription>
                    Set your product pricing and cost information
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-6'>
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    {/* Base Price */}
                    <div className='space-y-2'>
                      <Label htmlFor='basePrice'>
                        Base Price <span className='text-destructive'>*</span>
                      </Label>
                      <div className='relative'>
                        <DollarSign className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                        <Input
                          id='basePrice'
                          type='number'
                          step='0.01'
                          min='0'
                          placeholder='0.00'
                          className={`pl-9 ${
                            errors.basePrice ? 'border-destructive' : ''
                          }`}
                          {...register('basePrice', { valueAsNumber: true })}
                        />
                      </div>
                      {errors.basePrice && (
                        <p className='text-sm text-destructive'>
                          {errors.basePrice.message}
                        </p>
                      )}
                    </div>

                    {/* Sale Price */}
                    <div className='space-y-2'>
                      <Label htmlFor='salePrice'>
                        Sale Price{' '}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className='h-3.5 w-3.5 inline ml-1 text-muted-foreground' />
                          </TooltipTrigger>
                          <TooltipContent>
                            Leave empty if not on sale
                          </TooltipContent>
                        </Tooltip>
                      </Label>
                      <div className='relative'>
                        <DollarSign className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                        <Input
                          id='salePrice'
                          type='number'
                          step='0.01'
                          min='0'
                          placeholder='0.00'
                          className='pl-9'
                          {...register('salePrice', { valueAsNumber: true })}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    {/* Cost Price */}
                    <div className='space-y-2'>
                      <Label htmlFor='costPrice'>
                        Cost per Item{' '}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className='h-3.5 w-3.5 inline ml-1 text-muted-foreground' />
                          </TooltipTrigger>
                          <TooltipContent>
                            Your cost to purchase or make this item
                          </TooltipContent>
                        </Tooltip>
                      </Label>
                      <div className='relative'>
                        <DollarSign className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                        <Input
                          id='costPrice'
                          type='number'
                          step='0.01'
                          min='0'
                          placeholder='0.00'
                          className='pl-9'
                          {...register('costPrice', { valueAsNumber: true })}
                        />
                      </div>
                    </div>

                    {/* Tax Rate */}
                    <div className='space-y-2'>
                      <Label htmlFor='taxRate'>Tax Rate (%)</Label>
                      <Input
                        id='taxRate'
                        type='number'
                        step='0.01'
                        min='0'
                        max='100'
                        placeholder='0'
                        {...register('taxRate', { valueAsNumber: true })}
                      />
                    </div>
                  </div>

                  {/* Profit Margin Display */}
                  {profitMargin !== null && (
                    <div className='p-4 rounded-lg bg-muted'>
                      <div className='flex items-center justify-between'>
                        <span className='text-sm font-medium'>
                          Profit Margin
                        </span>
                        <span
                          className={`text-lg font-bold ${
                            profitMargin > 0
                              ? 'text-green-600'
                              : profitMargin < 0
                              ? 'text-red-600'
                              : ''
                          }`}
                        >
                          {profitMargin.toFixed(1)}%
                        </span>
                      </div>
                      <p className='text-xs text-muted-foreground mt-1'>
                        Profit: $
                        {((basePrice || 0) - (costPrice || 0)).toFixed(2)} per
                        unit
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Inventory Tab */}
            <TabsContent value='inventory' className='space-y-6 mt-6'>
              <Card>
                <CardHeader>
                  <CardTitle>Inventory</CardTitle>
                  <CardDescription>
                    Manage stock and product identifiers
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                  {/* SKU */}
                  <div className='space-y-2'>
                    <Label htmlFor='sku'>
                      SKU <span className='text-destructive'>*</span>
                    </Label>
                    <Input
                      id='sku'
                      placeholder='e.g., WGK-RGB-001'
                      {...register('sku')}
                      className={errors.sku ? 'border-destructive' : ''}
                    />
                    {errors.sku && (
                      <p className='text-sm text-destructive'>
                        {errors.sku.message}
                      </p>
                    )}
                    <p className='text-xs text-muted-foreground'>
                      Stock Keeping Unit - unique identifier for this product
                    </p>
                  </div>

                  <Separator />

                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    {/* Min Order Quantity */}
                    <div className='space-y-2'>
                      <Label htmlFor='minOrderQuantity'>
                        Minimum Order Quantity
                      </Label>
                      <Input
                        id='minOrderQuantity'
                        type='number'
                        min='1'
                        placeholder='1'
                        {...register('minOrderQuantity', {
                          valueAsNumber: true,
                        })}
                      />
                    </div>

                    {/* Max Order Quantity */}
                    <div className='space-y-2'>
                      <Label htmlFor='maxOrderQuantity'>
                        Maximum Order Quantity
                      </Label>
                      <Input
                        id='maxOrderQuantity'
                        type='number'
                        min='1'
                        placeholder='No limit'
                        {...register('maxOrderQuantity', {
                          valueAsNumber: true,
                        })}
                      />
                    </div>
                  </div>

                  {/* Backorder */}
                  <div className='flex items-center space-x-3 p-4 rounded-lg border'>
                    <Controller
                      name='isBackorderAllowed'
                      control={control}
                      render={({ field }) => (
                        <Switch
                          id='isBackorderAllowed'
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                    <div className='space-y-0.5'>
                      <Label
                        htmlFor='isBackorderAllowed'
                        className='cursor-pointer'
                      >
                        Allow Backorders
                      </Label>
                      <p className='text-xs text-muted-foreground'>
                        Allow customers to order when out of stock
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Shipping Section */}
              <Card>
                <CardHeader>
                  <CardTitle>Shipping</CardTitle>
                  <CardDescription>
                    Product dimensions and weight for shipping calculations
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                  {/* Digital Product */}
                  <div className='flex items-center space-x-3 p-4 rounded-lg border'>
                    <Controller
                      name='isDigital'
                      control={control}
                      render={({ field }) => (
                        <Switch
                          id='isDigital'
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                    <div className='space-y-0.5'>
                      <Label htmlFor='isDigital' className='cursor-pointer'>
                        Digital Product
                      </Label>
                      <p className='text-xs text-muted-foreground'>
                        This product doesn&apos;t require shipping
                      </p>
                    </div>
                  </div>

                  {!watch('isDigital') && (
                    <>
                      {/* Weight */}
                      <div className='grid grid-cols-3 gap-4'>
                        <div className='col-span-2 space-y-2'>
                          <Label htmlFor='weight'>Weight</Label>
                          <Input
                            id='weight'
                            type='number'
                            step='0.01'
                            min='0'
                            placeholder='0'
                            {...register('weight', { valueAsNumber: true })}
                          />
                        </div>
                        <div className='space-y-2'>
                          <Label htmlFor='weightUnit'>Unit</Label>
                          <Controller
                            name='weightUnit'
                            control={control}
                            render={({ field }) => (
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value='kg'>kg</SelectItem>
                                  <SelectItem value='g'>g</SelectItem>
                                  <SelectItem value='lb'>lb</SelectItem>
                                  <SelectItem value='oz'>oz</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                      </div>

                      {/* Dimensions */}
                      <div className='space-y-2'>
                        <Label>Dimensions</Label>
                        <div className='grid grid-cols-4 gap-4'>
                          <div>
                            <Input
                              type='number'
                              step='0.1'
                              min='0'
                              placeholder='L'
                              {...register('length', { valueAsNumber: true })}
                            />
                          </div>
                          <div>
                            <Input
                              type='number'
                              step='0.1'
                              min='0'
                              placeholder='W'
                              {...register('width', { valueAsNumber: true })}
                            />
                          </div>
                          <div>
                            <Input
                              type='number'
                              step='0.1'
                              min='0'
                              placeholder='H'
                              {...register('height', { valueAsNumber: true })}
                            />
                          </div>
                          <Controller
                            name='dimensionsUnit'
                            control={control}
                            render={({ field }) => (
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value='cm'>cm</SelectItem>
                                  <SelectItem value='in'>in</SelectItem>
                                  <SelectItem value='m'>m</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                        <p className='text-xs text-muted-foreground'>
                          Length × Width × Height
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Media Tab */}
            <TabsContent value='media' className='mt-6'>
              <Card>
                <CardHeader>
                  <CardTitle>Product Media</CardTitle>
                  <CardDescription>
                    Add images and videos to showcase your product
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MediaManager
                    images={images}
                    videos={videos}
                    onImagesChange={setImages}
                    onVideosChange={setVideos}
                    onImageRemove={handleImageRemove}
                    maxImages={10}
                    maxVideos={3}
                    disabled={isPending}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* SEO Tab */}
            <TabsContent value='seo' className='space-y-6 mt-6'>
              <Card>
                <CardHeader>
                  <CardTitle>Search Engine Optimization</CardTitle>
                  <CardDescription>
                    Optimize how your product appears in search results
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                  {/* Meta Title */}
                  <div className='space-y-2'>
                    <Label htmlFor='metaTitle'>Meta Title</Label>
                    <Input
                      id='metaTitle'
                      placeholder={watch('name') || 'Product name'}
                      {...register('metaTitle')}
                      className={errors.metaTitle ? 'border-destructive' : ''}
                    />
                    {errors.metaTitle && (
                      <p className='text-sm text-destructive'>
                        {errors.metaTitle.message}
                      </p>
                    )}
                    <p className='text-xs text-muted-foreground'>
                      {(watch('metaTitle') || '').length}/70 characters
                      recommended
                    </p>
                  </div>

                  {/* Meta Description */}
                  <div className='space-y-2'>
                    <Label htmlFor='metaDescription'>Meta Description</Label>
                    <Textarea
                      id='metaDescription'
                      placeholder='Describe your product for search engines...'
                      rows={3}
                      {...register('metaDescription')}
                      className={
                        errors.metaDescription ? 'border-destructive' : ''
                      }
                    />
                    {errors.metaDescription && (
                      <p className='text-sm text-destructive'>
                        {errors.metaDescription.message}
                      </p>
                    )}
                    <p className='text-xs text-muted-foreground'>
                      {(watch('metaDescription') || '').length}/160 characters
                      recommended
                    </p>
                  </div>

                  {/* SEO Preview */}
                  <div className='p-4 rounded-lg border bg-muted/50'>
                    <p className='text-xs text-muted-foreground mb-2'>
                      Search Preview
                    </p>
                    <div className='space-y-1'>
                      <p className='text-blue-600 hover:underline cursor-pointer text-lg truncate'>
                        {watch('metaTitle') || watch('name') || 'Product Title'}
                      </p>
                      <p className='text-green-700 text-sm'>
                        yourstore.com/products/{watchedSlug || 'slug'}
                      </p>
                      <p className='text-sm text-muted-foreground line-clamp-2'>
                        {watch('metaDescription') ||
                          watch('shortDescription') ||
                          watch('description')?.slice(0, 160) ||
                          'Product description will appear here...'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className='space-y-6'>
          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Settings className='h-4 w-4' />
                Status
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              {/* Active Status */}
              <div className='flex items-center justify-between p-3 rounded-lg border'>
                <div className='space-y-0.5'>
                  <Label htmlFor='isActive' className='cursor-pointer'>
                    Active
                  </Label>
                  <p className='text-xs text-muted-foreground'>
                    Visible to customers
                  </p>
                </div>
                <Controller
                  name='isActive'
                  control={control}
                  render={({ field }) => (
                    <Switch
                      id='isActive'
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </div>

              {/* Featured Status */}
              <div className='flex items-center justify-between p-3 rounded-lg border'>
                <div className='space-y-0.5'>
                  <Label
                    htmlFor='isFeatured'
                    className='cursor-pointer flex items-center gap-2'
                  >
                    <Sparkles className='h-3.5 w-3.5 text-yellow-500' />
                    Featured
                  </Label>
                  <p className='text-xs text-muted-foreground'>
                    Show in featured section
                  </p>
                </div>
                <Controller
                  name='isFeatured'
                  control={control}
                  render={({ field }) => (
                    <Switch
                      id='isFeatured'
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats (Edit mode only) */}
          {mode === 'edit' && product && (
            <Card>
              <CardHeader>
                <CardTitle className='text-sm'>Product Info</CardTitle>
              </CardHeader>
              <CardContent className='space-y-3 text-sm'>
                <div className='flex justify-between'>
                  <span className='text-muted-foreground'>Created</span>
                  <span>
                    {product.createdAt
                      ? new Date(product.createdAt).toLocaleDateString()
                      : 'N/A'}
                  </span>
                </div>
                <div className='flex justify-between'>
                  <span className='text-muted-foreground'>Updated</span>
                  <span>
                    {product.updatedAt
                      ? new Date(product.updatedAt).toLocaleDateString()
                      : 'N/A'}
                  </span>
                </div>
                <div className='flex justify-between'>
                  <span className='text-muted-foreground'>ID</span>
                  <span className='font-mono text-xs truncate max-w-30'>
                    {product.id}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Form Validation Summary */}
          {Object.keys(errors).length > 0 && (
            <Card className='border-destructive'>
              <CardHeader className='pb-2'>
                <CardTitle className='text-sm text-destructive flex items-center gap-2'>
                  <span className='h-2 w-2 rounded-full bg-destructive' />
                  Validation Errors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className='text-xs space-y-1'>
                  {Object.entries(errors).map(([key, error]) => (
                    <li key={key} className='text-destructive'>
                      • {error?.message}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Inline Brand Creation Dialog */}
      <BrandForm
        open={isBrandFormOpen}
        onClose={() => setIsBrandFormOpen(false)}
        onSubmit={async (data) => {
          await createBrandMutation.mutateAsync(data)
        }}
        isLoading={createBrandMutation.isPending}
      />
    </form>
  )
}
