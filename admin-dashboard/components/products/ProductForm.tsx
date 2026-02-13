'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { productService } from '@/services/product.service'
import { categoryService } from '@/services/category.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Loader2, Upload, X } from 'lucide-react'
import { useDropzone } from 'react-dropzone'

const productSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  price: z
    .string()
    .refine(
      (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
      'Price must be a positive number',
    ),
  compare_at_price: z.string().optional(),
  cost_per_item: z.string().optional(),
  sku: z.string().min(1, 'SKU is required'),
  barcode: z.string().optional(),
  track_quantity: z.boolean().default(true),
  quantity: z.string().optional(),
  category_id: z.string().min(1, 'Category is required'),
  status: z.enum(['draft', 'active', 'archived']),
  tags: z.string().optional(),
})

type ProductFormData = z.infer<typeof productSchema>

export function ProductForm() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [images, setImages] = useState<File[]>([])
  const [videos, setVideos] = useState<File[]>([])

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await categoryService.getCategories()
      return response?.data?.categories || []
    },
  })

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      status: 'draft',
      track_quantity: true,
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      // Convert form data to DTO
      const productData = {
        sku: data.sku,
        name: data.name,
        slug: data.name.toLowerCase().replace(/\s+/g, '-'),
        description: data.description,
        categoryId: data.category_id,
        basePrice: parseFloat(data.price),
        salePrice: data.compare_at_price
          ? parseFloat(data.compare_at_price)
          : undefined,
        costPrice: data.cost_per_item
          ? parseFloat(data.cost_per_item)
          : undefined,
        isActive: data.status === 'active',
      }

      // Use createProductWithMedia for single-request upload
      return productService.createProductWithMedia(
        productData,
        images.length > 0 ? images : undefined,
        videos.length > 0 ? videos : undefined,
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

  const onDrop = (acceptedFiles: File[], fileType: 'image' | 'video') => {
    if (fileType === 'image') {
      setImages((prev) => [...prev, ...acceptedFiles])
    } else {
      setVideos((prev) => [...prev, ...acceptedFiles])
    }
  }

  const { getRootProps: getImageRootProps, getInputProps: getImageInputProps } =
    useDropzone({
      onDrop: (files) => onDrop(files, 'image'),
      accept: { 'image/*': [] },
      maxSize: 5 * 1024 * 1024, // 5MB
    })

  const { getRootProps: getVideoRootProps, getInputProps: getVideoInputProps } =
    useDropzone({
      onDrop: (files) => onDrop(files, 'video'),
      accept: { 'video/*': [] },
      maxSize: 50 * 1024 * 1024, // 50MB
    })

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const removeVideo = (index: number) => {
    setVideos((prev) => prev.filter((_, i) => i !== index))
  }

  const trackQuantity = watch('track_quantity')

  return (
    <form
      onSubmit={handleSubmit((data) => createMutation.mutate(data))}
      className='space-y-6'
    >
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>
            Product name, description, and core details
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='name'>Product Name *</Label>
            <Input
              id='name'
              placeholder='e.g., iPhone 15 Pro Max'
              {...register('name')}
            />
            {errors.name && (
              <p className='text-sm text-red-600'>{errors.name.message}</p>
            )}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='description'>Description *</Label>
            <Textarea
              id='description'
              placeholder='Detailed product description...'
              rows={4}
              {...register('description')}
            />
            {errors.description && (
              <p className='text-sm text-red-600'>
                {errors.description.message}
              </p>
            )}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='category_id'>Category *</Label>
            <Select onValueChange={(value: string) => setValue('category_id', value)}>
              <SelectTrigger>
                <SelectValue placeholder='Select a category' />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((category: any) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category_id && (
              <p className='text-sm text-red-600'>
                {errors.category_id.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
          <CardDescription>
            Set product pricing and cost information
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='price'>Price *</Label>
              <Input
                id='price'
                type='number'
                step='0.01'
                placeholder='0.00'
                {...register('price')}
              />
              {errors.price && (
                <p className='text-sm text-red-600'>{errors.price.message}</p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='compare_at_price'>Compare at Price</Label>
              <Input
                id='compare_at_price'
                type='number'
                step='0.01'
                placeholder='0.00'
                {...register('compare_at_price')}
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='cost_per_item'>Cost per Item</Label>
              <Input
                id='cost_per_item'
                type='number'
                step='0.01'
                placeholder='0.00'
                {...register('cost_per_item')}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inventory */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory</CardTitle>
          <CardDescription>
            Manage stock and product identifiers
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='sku'>SKU *</Label>
              <Input
                id='sku'
                placeholder='e.g., IPH-15-PM-256'
                {...register('sku')}
              />
              {errors.sku && (
                <p className='text-sm text-red-600'>{errors.sku.message}</p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='barcode'>Barcode</Label>
              <Input
                id='barcode'
                placeholder='e.g., 123456789012'
                {...register('barcode')}
              />
            </div>
          </div>

          <div className='flex items-center space-x-2'>
            <Switch
              id='track_quantity'
              checked={trackQuantity}
              onCheckedChange={(checked: boolean) =>
                setValue('track_quantity', checked)
              }
            />
            <Label htmlFor='track_quantity' className='cursor-pointer'>
              Track quantity
            </Label>
          </div>

          {trackQuantity && (
            <div className='space-y-2'>
              <Label htmlFor='quantity'>Initial Quantity</Label>
              <Input
                id='quantity'
                type='number'
                placeholder='0'
                {...register('quantity')}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Media */}
      <Card>
        <CardHeader>
          <CardTitle>Media</CardTitle>
          <CardDescription>Add product images and videos</CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          {/* Images */}
          <div className='space-y-4'>
            <Label>Product Images</Label>
            <div
              {...getImageRootProps()}
              className='border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors'
            >
              <input {...getImageInputProps()} />
              <Upload className='w-12 h-12 mx-auto text-gray-400 mb-4' />
              <p className='text-sm text-gray-600 dark:text-gray-400'>
                Drag & drop images here, or click to select
              </p>
              <p className='text-xs text-gray-500 mt-2'>Max 5MB per image</p>
            </div>

            {images.length > 0 && (
              <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                {images.map((image, index) => (
                  <div key={index} className='relative group'>
                    <img
                      src={URL.createObjectURL(image)}
                      alt={`Preview ${index + 1}`}
                      className='w-full h-32 object-cover rounded-lg'
                    />
                    <button
                      type='button'
                      onClick={() => removeImage(index)}
                      className='absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity'
                    >
                      <X className='w-4 h-4' />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Videos */}
          <div className='space-y-4'>
            <Label>Product Videos</Label>
            <div
              {...getVideoRootProps()}
              className='border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors'
            >
              <input {...getVideoInputProps()} />
              <Upload className='w-12 h-12 mx-auto text-gray-400 mb-4' />
              <p className='text-sm text-gray-600 dark:text-gray-400'>
                Drag & drop videos here, or click to select
              </p>
              <p className='text-xs text-gray-500 mt-2'>Max 50MB per video</p>
            </div>

            {videos.length > 0 && (
              <div className='space-y-2'>
                {videos.map((video, index) => (
                  <div
                    key={index}
                    className='flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg'
                  >
                    <span className='text-sm font-medium'>{video.name}</span>
                    <button
                      type='button'
                      onClick={() => removeVideo(index)}
                      className='p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors'
                    >
                      <X className='w-4 h-4' />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Organization */}
      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>Product status and tags</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='status'>Status</Label>
            <Select
              defaultValue='draft'
              onValueChange={(value: any) => setValue('status', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='draft'>Draft</SelectItem>
                <SelectItem value='active'>Active</SelectItem>
                <SelectItem value='archived'>Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='tags'>Tags</Label>
            <Input
              id='tags'
              placeholder='e.g., electronics, smartphone, apple'
              {...register('tags')}
            />
            <p className='text-xs text-gray-500'>Separate tags with commas</p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className='flex items-center justify-end gap-4'>
        <Button
          type='button'
          variant='outline'
          onClick={() => router.push('/products')}
          disabled={createMutation.isPending}
        >
          Cancel
        </Button>
        <Button type='submit' disabled={createMutation.isPending}>
          {createMutation.isPending ? (
            <>
              <Loader2 className='w-4 h-4 mr-2 animate-spin' />
              Creating...
            </>
          ) : (
            'Create Product'
          )}
        </Button>
      </div>
    </form>
  )
}
