'use client'

import { useRouter, useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productService } from '@/services/product.service'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  ArrowLeft,
  Edit,
  Trash2,
  Package,
  DollarSign,
  Warehouse,
  Image as ImageIcon,
  Calendar,
  Tag,
  Box,
  Scale,
  Sparkles,
  Copy,
  ExternalLink,
  MoreHorizontal,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { format } from 'date-fns'
import Link from 'next/link'
import { useState } from 'react'

export default function ProductDetailPage() {
  const router = useRouter()
  const params = useParams()
  const productId = params.id as string
  const queryClient = useQueryClient()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const {
    data: productData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      const response = await productService.getProduct(productId)
      return response?.data?.product
    },
    enabled: !!productId,
  })

  const deleteMutation = useMutation({
    mutationFn: () => productService.deleteProduct(productId),
    onSuccess: () => {
      toast.success('Product deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['products'] })
      router.push('/products')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete product')
    },
  })

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  if (isLoading) {
    return (
      <div className='space-y-6'>
        <div className='flex items-center gap-4'>
          <Skeleton className='h-10 w-10' />
          <div>
            <Skeleton className='h-8 w-64' />
            <Skeleton className='h-4 w-48 mt-2' />
          </div>
        </div>
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
          <div className='lg:col-span-2 space-y-6'>
            <Skeleton className='h-64' />
            <Skeleton className='h-48' />
          </div>
          <div className='space-y-6'>
            <Skeleton className='h-40' />
            <Skeleton className='h-32' />
          </div>
        </div>
      </div>
    )
  }

  if (error || !productData) {
    return (
      <div className='flex flex-col items-center justify-center py-12'>
        <Package className='h-16 w-16 text-muted-foreground mb-4' />
        <h2 className='text-xl font-semibold mb-2'>Product Not Found</h2>
        <p className='text-muted-foreground mb-4'>
          The product you&apos;re looking for doesn&apos;t exist or has been
          deleted.
        </p>
        <Link href='/products'>
          <Button>Back to Products</Button>
        </Link>
      </div>
    )
  }

  const product = productData

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-start justify-between'>
        <div className='flex items-center gap-4'>
          <Button variant='ghost' size='icon' onClick={() => router.back()}>
            <ArrowLeft className='h-5 w-5' />
          </Button>
          <div>
            <div className='flex items-center gap-3'>
              <h1 className='text-2xl font-bold'>{product.name}</h1>
              {product.isActive ? (
                <Badge className='bg-green-100 text-green-800'>Active</Badge>
              ) : (
                <Badge variant='secondary'>Inactive</Badge>
              )}
              {product.isFeatured && (
                <Badge className='bg-yellow-100 text-yellow-800'>
                  <Sparkles className='h-3 w-3 mr-1' />
                  Featured
                </Badge>
              )}
            </div>
            <p className='text-muted-foreground mt-1'>SKU: {product.sku}</p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <Link href={`/products/${productId}/edit`}>
            <Button>
              <Edit className='h-4 w-4 mr-2' />
              Edit Product
            </Button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='outline' size='icon'>
                <MoreHorizontal className='h-4 w-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem
                onClick={() => copyToClipboard(product.id || '', 'Product ID')}
              >
                <Copy className='h-4 w-4 mr-2' />
                Copy ID
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => copyToClipboard(product.sku, 'SKU')}
              >
                <Copy className='h-4 w-4 mr-2' />
                Copy SKU
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  window.open(`/products/${product.slug}`, '_blank')
                }
              >
                <ExternalLink className='h-4 w-4 mr-2' />
                View in Store
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className='text-destructive'
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className='h-4 w-4 mr-2' />
                Delete Product
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Main Content */}
        <div className='lg:col-span-2 space-y-6'>
          {/* Product Images */}
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='flex items-center gap-2'>
                <ImageIcon className='h-4 w-4' />
                Product Media
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(product as any).images?.length > 0 ? (
                <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                  {(product as any).images.map((image: any, index: number) => (
                    <div
                      key={index}
                      className='aspect-square rounded-lg overflow-hidden border'
                    >
                      <img
                        src={image.url || '/placeholder.png'}
                        alt={`${product.name} - Image ${index + 1}`}
                        className='w-full h-full object-cover'
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className='flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg'>
                  <ImageIcon className='h-12 w-12 text-muted-foreground mb-3' />
                  <p className='text-muted-foreground'>No images uploaded</p>
                  <Link href={`/products/${productId}/edit`} className='mt-3'>
                    <Button variant='outline' size='sm'>
                      Add Images
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Description */}
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              {product.shortDescription && (
                <div>
                  <p className='text-sm text-muted-foreground mb-1'>
                    Short Description
                  </p>
                  <p>{product.shortDescription}</p>
                </div>
              )}
              <div>
                <p className='text-sm text-muted-foreground mb-1'>
                  Full Description
                </p>
                <p className='whitespace-pre-wrap'>
                  {product.description || 'No description provided.'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Pricing & Inventory */}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            {/* Pricing */}
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='flex items-center gap-2'>
                  <DollarSign className='h-4 w-4' />
                  Pricing
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                <div className='flex justify-between items-center'>
                  <span className='text-muted-foreground'>Base Price</span>
                  <span className='text-xl font-bold'>
                    ${product.basePrice?.toFixed(2)}
                  </span>
                </div>
                {product.salePrice && (
                  <div className='flex justify-between items-center'>
                    <span className='text-muted-foreground'>Sale Price</span>
                    <span className='text-lg font-semibold text-green-600'>
                      ${product.salePrice.toFixed(2)}
                    </span>
                  </div>
                )}
                {product.costPrice && (
                  <>
                    <Separator />
                    <div className='flex justify-between items-center'>
                      <span className='text-muted-foreground'>Cost</span>
                      <span>${product.costPrice.toFixed(2)}</span>
                    </div>
                    <div className='flex justify-between items-center'>
                      <span className='text-muted-foreground'>Margin</span>
                      <span className='font-medium'>
                        {(
                          ((product.basePrice - product.costPrice) /
                            product.basePrice) *
                          100
                        ).toFixed(1)}
                        %
                      </span>
                    </div>
                  </>
                )}
                {product.taxRate && (
                  <div className='flex justify-between items-center'>
                    <span className='text-muted-foreground'>Tax Rate</span>
                    <span>{product.taxRate}%</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Inventory */}
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='flex items-center gap-2'>
                  <Warehouse className='h-4 w-4' />
                  Inventory
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                <div className='flex justify-between items-center'>
                  <span className='text-muted-foreground'>SKU</span>
                  <span className='font-mono'>{product.sku}</span>
                </div>
                <div className='flex justify-between items-center'>
                  <span className='text-muted-foreground'>Min Order Qty</span>
                  <span>{product.minOrderQuantity || 1}</span>
                </div>
                {product.maxOrderQuantity && (
                  <div className='flex justify-between items-center'>
                    <span className='text-muted-foreground'>Max Order Qty</span>
                    <span>{product.maxOrderQuantity}</span>
                  </div>
                )}
                <div className='flex justify-between items-center'>
                  <span className='text-muted-foreground'>Backorders</span>
                  <Badge
                    variant={
                      product.isBackorderAllowed ? 'default' : 'secondary'
                    }
                  >
                    {product.isBackorderAllowed ? 'Allowed' : 'Not Allowed'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Shipping */}
          {!product.isDigital && (
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='flex items-center gap-2'>
                  <Box className='h-4 w-4' />
                  Shipping
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                  {product.weight && (
                    <div className='p-3 rounded-lg bg-muted'>
                      <p className='text-xs text-muted-foreground mb-1'>
                        Weight
                      </p>
                      <p className='font-medium'>
                        {product.weight} {product.weightUnit || 'kg'}
                      </p>
                    </div>
                  )}
                  {product.length && (
                    <div className='p-3 rounded-lg bg-muted'>
                      <p className='text-xs text-muted-foreground mb-1'>
                        Length
                      </p>
                      <p className='font-medium'>
                        {product.length} {product.dimensionsUnit || 'cm'}
                      </p>
                    </div>
                  )}
                  {product.width && (
                    <div className='p-3 rounded-lg bg-muted'>
                      <p className='text-xs text-muted-foreground mb-1'>
                        Width
                      </p>
                      <p className='font-medium'>
                        {product.width} {product.dimensionsUnit || 'cm'}
                      </p>
                    </div>
                  )}
                  {product.height && (
                    <div className='p-3 rounded-lg bg-muted'>
                      <p className='text-xs text-muted-foreground mb-1'>
                        Height
                      </p>
                      <p className='font-medium'>
                        {product.height} {product.dimensionsUnit || 'cm'}
                      </p>
                    </div>
                  )}
                </div>
                {!product.weight &&
                  !product.length &&
                  !product.width &&
                  !product.height && (
                    <p className='text-muted-foreground text-center py-4'>
                      No shipping dimensions specified
                    </p>
                  )}
              </CardContent>
            </Card>
          )}

          {/* SEO */}
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle>SEO</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div>
                <p className='text-sm text-muted-foreground mb-1'>URL Slug</p>
                <p className='font-mono text-sm bg-muted p-2 rounded'>
                  /products/{product.slug}
                </p>
              </div>
              {product.metaTitle && (
                <div>
                  <p className='text-sm text-muted-foreground mb-1'>
                    Meta Title
                  </p>
                  <p>{product.metaTitle}</p>
                </div>
              )}
              {product.metaDescription && (
                <div>
                  <p className='text-sm text-muted-foreground mb-1'>
                    Meta Description
                  </p>
                  <p>{product.metaDescription}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className='space-y-6'>
          {/* Quick Info */}
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-sm'>Product Information</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3 text-sm'>
              <div className='flex justify-between items-center'>
                <span className='text-muted-foreground flex items-center gap-2'>
                  <Tag className='h-3.5 w-3.5' />
                  Category
                </span>
                <span>{product.categoryId || 'Uncategorized'}</span>
              </div>
              {product.brandId && (
                <div className='flex justify-between items-center'>
                  <span className='text-muted-foreground'>Brand</span>
                  <span>{product.brandId}</span>
                </div>
              )}
              <Separator />
              <div className='flex justify-between items-center'>
                <span className='text-muted-foreground flex items-center gap-2'>
                  <Calendar className='h-3.5 w-3.5' />
                  Created
                </span>
                <span>
                  {product.createdAt
                    ? format(new Date(product.createdAt), 'MMM d, yyyy')
                    : 'N/A'}
                </span>
              </div>
              <div className='flex justify-between items-center'>
                <span className='text-muted-foreground'>Updated</span>
                <span>
                  {product.updatedAt
                    ? format(new Date(product.updatedAt), 'MMM d, yyyy')
                    : 'N/A'}
                </span>
              </div>
              <Separator />
              <div className='flex justify-between items-center'>
                <span className='text-muted-foreground'>Digital Product</span>
                <Badge variant={product.isDigital ? 'default' : 'secondary'}>
                  {product.isDigital ? 'Yes' : 'No'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-sm'>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className='space-y-2'>
              <Link href={`/products/${productId}/edit`} className='block'>
                <Button variant='outline' className='w-full justify-start'>
                  <Edit className='h-4 w-4 mr-2' />
                  Edit Product
                </Button>
              </Link>
              <Button
                variant='outline'
                className='w-full justify-start'
                onClick={() => copyToClipboard(product.sku, 'SKU')}
              >
                <Copy className='h-4 w-4 mr-2' />
                Copy SKU
              </Button>
              <Button
                variant='outline'
                className='w-full justify-start text-destructive hover:text-destructive'
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className='h-4 w-4 mr-2' />
                Delete Product
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{product.name}&quot;? This
              action cannot be undone and will permanently remove the product
              and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
