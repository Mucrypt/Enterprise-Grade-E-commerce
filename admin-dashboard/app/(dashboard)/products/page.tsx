'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { productService, ProductFilters } from '@/services/product.service'
import { categoryService } from '@/services/category.service'
import supplierService from '@/services/supplier.service'
import { getAbsoluteMediaUrl } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
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
  Plus,
  Package,
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Columns,
  Copy,
  Image as ImageIcon,
  Box,
  Star,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Products } from '@/types'
import { useDebounce } from '@/hooks/useDebounce'

// Column configuration
interface ColumnConfig {
  id: string
  label: string
  visible: boolean
  sortable?: boolean
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'select', label: '', visible: true, sortable: false },
  { id: 'name', label: 'Product', visible: true, sortable: true },
  { id: 'sku', label: 'SKU', visible: true, sortable: true },
  { id: 'price', label: 'Price', visible: true, sortable: true },
  { id: 'stock', label: 'Stock', visible: true, sortable: false },
  { id: 'category', label: 'Category', visible: true, sortable: false },
  { id: 'status', label: 'Status', visible: true, sortable: false },
  { id: 'created', label: 'Created', visible: true, sortable: true },
  { id: 'actions', label: '', visible: true, sortable: false },
]

export default function ProductsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [limit] = useState(20)

  // UI state
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(
    new Set(),
  )
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS)

  // Debounce search query
  const debouncedSearch = useDebounce(searchQuery, 300)

  // Build filters for API
  const filters: ProductFilters = useMemo(
    () => ({
      page,
      limit,
      categoryId: categoryFilter !== 'all' ? categoryFilter : undefined,
      sortBy:
        sortBy === 'name' ? 'name' : sortBy === 'price' ? 'base_price' : sortBy,
      sortOrder,
    }),
    [page, limit, categoryFilter, sortBy, sortOrder],
  )

  // Normalize product from snake_case API response to camelCase
  const normalizeProduct = (p: any): Products => ({
    ...p,
    id: p.id,
    sku: p.sku,
    name: p.name,
    slug: p.slug,
    description: p.description,
    shortDescription: p.short_description || p.shortDescription,
    categoryId: p.category_id || p.categoryId,
    brandId: p.brand_id || p.brandId,
    basePrice: parseFloat(p.base_price) || p.basePrice || 0,
    salePrice: p.sale_price ? parseFloat(p.sale_price) : p.salePrice,
    costPrice: p.cost_price ? parseFloat(p.cost_price) : p.costPrice,
    taxRate: p.tax_rate ? parseFloat(p.tax_rate) : p.taxRate,
    weight: p.weight ? parseFloat(p.weight) : undefined,
    weightUnit: p.weight_unit || p.weightUnit,
    isActive: p.is_active ?? p.isActive ?? true,
    isDigital: p.is_digital ?? p.isDigital ?? false,
    isFeatured: p.is_featured ?? p.isFeatured ?? false,
    metaTitle: p.meta_title || p.metaTitle,
    metaDescription: p.meta_description || p.metaDescription,
    createdAt: p.created_at || p.createdAt,
    updatedAt: p.updated_at || p.updatedAt,
    // Nested objects
    categoryName: p.category_name || p.categoryName,
    categorySlug: p.category_slug || p.categorySlug,
    brandName: p.brand_name || p.brandName,
    brandSlug: p.brand_slug || p.brandSlug,
    images: p.images || [],
    total_stock: p.total_stock || 0,
  })

  // Fetch products
  const {
    data: productsData,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['products', filters, debouncedSearch],
    queryFn: async () => {
      const response = await productService.getProducts(filters)
      // Handle both API response formats (products vs items, totalPages vs pages)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = response?.data as any
      const rawItems = data?.items || data?.products || []
      return {
        items: rawItems.map(normalizeProduct),
        pagination: {
          page: data?.pagination?.page || 1,
          limit: data?.pagination?.limit || 20,
          total: data?.pagination?.total || 0,
          pages: data?.pagination?.pages || data?.pagination?.totalPages || 1,
        },
      }
    },
  })

  // Fetch categories for filter
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await categoryService.getCategories()
      return response?.data?.categories || []
    },
  })

  const { data: autoPausedData } = useQuery({
    queryKey: ['products-auto-paused-badges'],
    queryFn: async () => {
      const response = await supplierService.getAutoPausedProducts(500)
      return response?.data?.items || []
    },
  })

  const products = productsData?.items || []
  const totalProducts = productsData?.pagination?.total || 0
  const totalPages = productsData?.pagination?.pages || 1
  const categories = categoriesData || []
  const autoPausedProductIds = useMemo(
    () => new Set((autoPausedData || []).map((item: any) => item.product_id)),
    [autoPausedData],
  )

  // Filter products by search (client-side for immediate feedback)
  const filteredProducts = useMemo(() => {
    if (!debouncedSearch) return products

    const search = debouncedSearch.toLowerCase()
    return products.filter(
      (product: Products) =>
        product.name.toLowerCase().includes(search) ||
        product.sku.toLowerCase().includes(search) ||
        product.description?.toLowerCase().includes(search),
    )
  }, [products, debouncedSearch])

  // Further filter by status (client-side)
  const displayProducts = useMemo(() => {
    if (statusFilter === 'all') return filteredProducts

    return filteredProducts.filter((product: Products) => {
      if (statusFilter === 'active') return product.isActive
      if (statusFilter === 'inactive') return !product.isActive
      if (statusFilter === 'featured') return product.isFeatured
      return true
    })
  }, [filteredProducts, statusFilter])

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => productService.deleteProduct(id),
    onSuccess: () => {
      toast.success('Product deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['products'] })
      setDeleteId(null)
      setSelectedProducts((prev) => {
        const next = new Set(prev)
        if (deleteId) next.delete(deleteId)
        return next
      })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete product')
    },
  })

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: (productIds: string[]) =>
      productService.bulkDeleteProducts(productIds),
    onSuccess: () => {
      toast.success(`${selectedProducts.size} products deleted successfully`)
      queryClient.invalidateQueries({ queryKey: ['products'] })
      setSelectedProducts(new Set())
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete products')
    },
  })

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: ({
      productIds,
      updates,
    }: {
      productIds: string[]
      updates: { isActive?: boolean; isFeatured?: boolean }
    }) => productService.bulkUpdateProducts(productIds, updates),
    onSuccess: () => {
      toast.success('Products updated successfully')
      queryClient.invalidateQueries({ queryKey: ['products'] })
      setSelectedProducts(new Set())
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update products')
    },
  })

  // Duplicate handler
  const handleDuplicate = async (product: Products) => {
    const duplicatedData = {
      sku: `${product.sku}-COPY-${Date.now()}`,
      name: `${product.name} (Copy)`,
      slug: `${product.slug}-copy-${Date.now()}`,
      description: product.description || '',
      shortDescription: product.shortDescription || '',
      categoryId: product.categoryId ?? '',
      brandId: product.brandId,
      basePrice: product.basePrice || 0,
      salePrice: product.salePrice,
      costPrice: product.costPrice,
      taxRate: product.taxRate,
      weight: product.weight,
      weightUnit: product.weightUnit,
      isActive: false, // Start as inactive
      isDigital: product.isDigital,
      isFeatured: false,
      metaTitle: product.metaTitle,
      metaDescription: product.metaDescription,
    }

    try {
      await productService.createProduct(duplicatedData)
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Product duplicated successfully')
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || 'Failed to duplicate product',
      )
    }
  }

  // Selection handlers
  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedProducts(
          new Set(displayProducts.map((p: Products) => p.id!)),
        )
      } else {
        setSelectedProducts(new Set())
      }
    },
    [displayProducts],
  )

  const handleSelectProduct = useCallback((id: string, checked: boolean) => {
    setSelectedProducts((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }, [])

  // Sort handler
  const handleSort = useCallback(
    (column: string) => {
      if (sortBy === column) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortBy(column)
        setSortOrder('asc')
      }
    },
    [sortBy],
  )

  // Column visibility handler
  const toggleColumn = useCallback((columnId: string) => {
    setColumns((prev) =>
      prev.map((col) =>
        col.id === columnId ? { ...col, visible: !col.visible } : col,
      ),
    )
  }, [])

  // Reset filters
  const resetFilters = useCallback(() => {
    setSearchQuery('')
    setCategoryFilter('all')
    setStatusFilter('all')
    setSortBy('created_at')
    setSortOrder('desc')
    setPage(1)
  }, [])

  const hasActiveFilters =
    searchQuery ||
    categoryFilter !== 'all' ||
    statusFilter !== 'all' ||
    sortBy !== 'created_at' ||
    sortOrder !== 'desc'

  // Loading skeleton
  if (isLoading) {
    return (
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <div>
            <Skeleton className='h-8 w-48' />
            <Skeleton className='h-4 w-64 mt-2' />
          </div>
          <Skeleton className='h-10 w-32' />
        </div>
        <Skeleton className='h-12 w-full' />
        <Skeleton className='h-96 w-full' />
      </div>
    )
  }

  // Empty state
  if (!products.length && !hasActiveFilters) {
    return (
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-3xl font-bold'>Products</h1>
            <p className='text-muted-foreground mt-2'>
              Manage your product catalog
            </p>
          </div>
          <Link href='/products/new'>
            <Button>
              <Plus className='w-4 h-4 mr-2' />
              Add Product
            </Button>
          </Link>
        </div>

        <Card className='border-dashed'>
          <CardHeader className='text-center py-12'>
            <div className='mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4'>
              <Package className='w-8 h-8 text-muted-foreground' />
            </div>
            <CardTitle>No products yet</CardTitle>
            <CardDescription className='max-w-md mx-auto mt-2'>
              Get started by creating your first product. You can add images,
              set prices, manage inventory, and more.
            </CardDescription>
          </CardHeader>
          <CardContent className='text-center pb-12'>
            <Link href='/products/new'>
              <Button size='lg'>
                <Plus className='w-4 h-4 mr-2' />
                Create Your First Product
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
        <div>
          <h1 className='text-3xl font-bold'>Products</h1>
          <p className='text-muted-foreground mt-1'>
            {totalProducts} products in your catalog
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <Button variant='outline' size='sm' onClick={() => refetch()}>
            <RefreshCw
              className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
          <Link href='/products/new'>
            <Button>
              <Plus className='w-4 h-4 mr-2' />
              Add Product
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters Bar */}
      <Card>
        <CardContent className='p-4'>
          <div className='flex flex-col lg:flex-row gap-4'>
            {/* Search */}
            <div className='relative flex-1'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
              <Input
                placeholder='Search products by name, SKU, or description...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='pl-9'
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
                >
                  <X className='h-4 w-4' />
                </button>
              )}
            </div>

            {/* Filter controls */}
            <div className='flex flex-wrap items-center gap-2'>
              {/* Category Filter */}
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className='w-37.5'>
                  <SelectValue placeholder='Category' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Categories</SelectItem>
                  {categories.map((category: any) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className='w-32.5'>
                  <SelectValue placeholder='Status' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Status</SelectItem>
                  <SelectItem value='active'>Active</SelectItem>
                  <SelectItem value='inactive'>Inactive</SelectItem>
                  <SelectItem value='featured'>Featured</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort */}
              <Select
                value={`${sortBy}-${sortOrder}`}
                onValueChange={(val: string) => {
                  const [newSortBy, newSortOrder] = val.split('-')
                  setSortBy(newSortBy)
                  setSortOrder(newSortOrder as 'asc' | 'desc')
                }}
              >
                <SelectTrigger className='w-40'>
                  <SelectValue placeholder='Sort by' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='created_at-desc'>Newest First</SelectItem>
                  <SelectItem value='created_at-asc'>Oldest First</SelectItem>
                  <SelectItem value='name-asc'>Name A-Z</SelectItem>
                  <SelectItem value='name-desc'>Name Z-A</SelectItem>
                  <SelectItem value='price-asc'>Price: Low to High</SelectItem>
                  <SelectItem value='price-desc'>Price: High to Low</SelectItem>
                </SelectContent>
              </Select>

              {/* Column Visibility */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant='outline' size='icon'>
                    <Columns className='h-4 w-4' />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
                  <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {columns
                    .filter(
                      (col) => col.id !== 'select' && col.id !== 'actions',
                    )
                    .map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        checked={column.visible}
                        onCheckedChange={() => toggleColumn(column.id)}
                      >
                        {column.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Reset Filters */}
              {hasActiveFilters && (
                <Button variant='ghost' size='sm' onClick={resetFilters}>
                  <X className='h-4 w-4 mr-1' />
                  Reset
                </Button>
              )}
            </div>
          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className='flex flex-wrap items-center gap-2 mt-4 pt-4 border-t'>
              <span className='text-sm text-muted-foreground'>
                Active filters:
              </span>
              {searchQuery && (
                <Badge variant='secondary' className='gap-1'>
                  Search: &quot;{searchQuery}&quot;
                  <button onClick={() => setSearchQuery('')}>
                    <X className='h-3 w-3' />
                  </button>
                </Badge>
              )}
              {categoryFilter !== 'all' && (
                <Badge variant='secondary' className='gap-1'>
                  Category:{' '}
                  {categories.find((c: any) => c.id === categoryFilter)?.name}
                  <button onClick={() => setCategoryFilter('all')}>
                    <X className='h-3 w-3' />
                  </button>
                </Badge>
              )}
              {statusFilter !== 'all' && (
                <Badge variant='secondary' className='gap-1'>
                  Status: {statusFilter}
                  <button onClick={() => setStatusFilter('all')}>
                    <X className='h-3 w-3' />
                  </button>
                </Badge>
              )}
            </div>
          )}

          {/* Bulk Actions */}
          {selectedProducts.size > 0 && (
            <div className='flex items-center gap-3 mt-4 pt-4 border-t'>
              <span className='text-sm font-medium'>
                {selectedProducts.size} selected
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant='outline' size='sm'>
                    Bulk Actions
                    <ArrowUpDown className='h-4 w-4 ml-1' />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='start'>
                  <DropdownMenuLabel>Update Status</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() =>
                      bulkUpdateMutation.mutate({
                        productIds: Array.from(selectedProducts),
                        updates: { isActive: true },
                      })
                    }
                  >
                    Activate Products
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      bulkUpdateMutation.mutate({
                        productIds: Array.from(selectedProducts),
                        updates: { isActive: false },
                      })
                    }
                  >
                    Deactivate Products
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Featured</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() =>
                      bulkUpdateMutation.mutate({
                        productIds: Array.from(selectedProducts),
                        updates: { isFeatured: true },
                      })
                    }
                  >
                    Mark as Featured
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      bulkUpdateMutation.mutate({
                        productIds: Array.from(selectedProducts),
                        updates: { isFeatured: false },
                      })
                    }
                  >
                    Remove Featured
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant='outline'
                size='sm'
                className='text-destructive'
                onClick={() =>
                  bulkDeleteMutation.mutate(Array.from(selectedProducts))
                }
                disabled={bulkDeleteMutation.isPending}
              >
                <Trash2 className='h-4 w-4 mr-1' />
                {bulkDeleteMutation.isPending
                  ? 'Deleting...'
                  : 'Delete Selected'}
              </Button>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => setSelectedProducts(new Set())}
              >
                Clear Selection
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardContent className='p-0'>
          <Table>
            <TableHeader>
              <TableRow>
                {columns.find((c) => c.id === 'select')?.visible && (
                  <TableHead className='w-12'>
                    <Checkbox
                      checked={
                        displayProducts.length > 0 &&
                        selectedProducts.size === displayProducts.length
                      }
                      onCheckedChange={handleSelectAll}
                      aria-label='Select all'
                    />
                  </TableHead>
                )}
                {columns.find((c) => c.id === 'name')?.visible && (
                  <TableHead>
                    <button
                      className='flex items-center gap-1 hover:text-foreground transition-colors'
                      onClick={() => handleSort('name')}
                    >
                      Product
                      {sortBy === 'name' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className='h-4 w-4' />
                        ) : (
                          <ArrowDown className='h-4 w-4' />
                        )
                      ) : (
                        <ArrowUpDown className='h-4 w-4 opacity-50' />
                      )}
                    </button>
                  </TableHead>
                )}
                {columns.find((c) => c.id === 'sku')?.visible && (
                  <TableHead className='min-w-30 whitespace-nowrap'>
                    SKU
                  </TableHead>
                )}
                {columns.find((c) => c.id === 'price')?.visible && (
                  <TableHead>
                    <button
                      className='flex items-center gap-1 hover:text-foreground transition-colors'
                      onClick={() => handleSort('price')}
                    >
                      Price
                      {sortBy === 'price' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className='h-4 w-4' />
                        ) : (
                          <ArrowDown className='h-4 w-4' />
                        )
                      ) : (
                        <ArrowUpDown className='h-4 w-4 opacity-50' />
                      )}
                    </button>
                  </TableHead>
                )}
                {columns.find((c) => c.id === 'stock')?.visible && (
                  <TableHead className='text-center'>Stock</TableHead>
                )}
                {columns.find((c) => c.id === 'category')?.visible && (
                  <TableHead>Category</TableHead>
                )}
                {columns.find((c) => c.id === 'status')?.visible && (
                  <TableHead>Status</TableHead>
                )}
                {columns.find((c) => c.id === 'created')?.visible && (
                  <TableHead>
                    <button
                      className='flex items-center gap-1 hover:text-foreground transition-colors'
                      onClick={() => handleSort('created_at')}
                    >
                      Created
                      {sortBy === 'created_at' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className='h-4 w-4' />
                        ) : (
                          <ArrowDown className='h-4 w-4' />
                        )
                      ) : (
                        <ArrowUpDown className='h-4 w-4 opacity-50' />
                      )}
                    </button>
                  </TableHead>
                )}
                {columns.find((c) => c.id === 'actions')?.visible && (
                  <TableHead className='text-right'>Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayProducts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.filter((c) => c.visible).length}
                    className='h-32 text-center'
                  >
                    <div className='flex flex-col items-center justify-center text-muted-foreground'>
                      <Search className='h-8 w-8 mb-2' />
                      <p>No products found</p>
                      <p className='text-sm'>
                        Try adjusting your search or filters
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                displayProducts.map((product: Products) => (
                  <TableRow
                    key={product.id}
                    className={
                      selectedProducts.has(product.id!)
                        ? 'bg-muted/50'
                        : undefined
                    }
                  >
                    {columns.find((c) => c.id === 'select')?.visible && (
                      <TableCell>
                        <Checkbox
                          checked={selectedProducts.has(product.id!)}
                          onCheckedChange={(
                            checked: boolean | 'indeterminate',
                          ) =>
                            handleSelectProduct(product.id!, checked === true)
                          }
                          aria-label={`Select ${product.name}`}
                        />
                      </TableCell>
                    )}
                    {columns.find((c) => c.id === 'name')?.visible && (
                      <TableCell>
                        <div className='flex items-center gap-3'>
                          {(() => {
                            const primaryImage =
                              (product as any).images?.find(
                                (img: any) => img.is_primary,
                              ) || (product as any).images?.[0]
                            const imageUrl = getAbsoluteMediaUrl(
                              primaryImage?.image_url ||
                                primaryImage?.file_path ||
                                primaryImage?.url ||
                                primaryImage?.cdn_urls?.thumbnail,
                            )
                            return imageUrl ? (
                              <div className='relative w-10 h-10 rounded overflow-hidden bg-muted shrink-0'>
                                <Image
                                  src={imageUrl}
                                  alt={product.name}
                                  fill
                                  className='object-cover'
                                />
                              </div>
                            ) : (
                              <div className='w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0'>
                                <ImageIcon className='h-5 w-5 text-muted-foreground' />
                              </div>
                            )
                          })()}
                          <div className='min-w-0'>
                            <Link
                              href={`/products/${product.id}`}
                              className='font-medium hover:underline truncate block'
                            >
                              {product.name}
                            </Link>
                            {product.shortDescription && (
                              <p className='text-xs text-muted-foreground truncate max-w-50'>
                                {product.shortDescription}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    )}
                    {columns.find((c) => c.id === 'sku')?.visible && (
                      <TableCell className='font-mono text-xs whitespace-nowrap'>
                        {product.sku}
                      </TableCell>
                    )}
                    {columns.find((c) => c.id === 'price')?.visible && (
                      <TableCell>
                        <div>
                          <span className='font-medium'>
                            ${product.basePrice?.toFixed(2)}
                          </span>
                          {product.salePrice && (
                            <span className='text-xs text-green-600 ml-2'>
                              Sale: ${product.salePrice.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    )}
                    {columns.find((c) => c.id === 'stock')?.visible && (
                      <TableCell className='text-center'>
                        {(() => {
                          const stock = (product as any).total_stock || 0
                          return (
                            <Badge
                              variant={
                                stock > 10
                                  ? 'secondary'
                                  : stock > 0
                                  ? 'outline'
                                  : 'destructive'
                              }
                            >
                              <Box className='h-3 w-3 mr-1' />
                              {stock}
                            </Badge>
                          )
                        })()}
                      </TableCell>
                    )}
                    {columns.find((c) => c.id === 'category')?.visible && (
                      <TableCell>
                        <Badge variant='outline'>
                          {(product as any).category_name ||
                            product.categoryId ||
                            'Uncategorized'}
                        </Badge>
                      </TableCell>
                    )}
                    {columns.find((c) => c.id === 'status')?.visible && (
                      <TableCell>
                        <div className='flex items-center gap-2'>
                          {product.isActive ? (
                            <Badge className='bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'>
                              Active
                            </Badge>
                          ) : (
                            <Badge variant='secondary'>Inactive</Badge>
                          )}
                          {product.isFeatured && (
                            <Badge className='bg-yellow-100 text-yellow-800'>
                              Featured
                            </Badge>
                          )}
                          {product.id && autoPausedProductIds.has(product.id) && (
                            <Badge className='bg-red-100 text-red-800'>
                              <AlertTriangle className='mr-1 h-3 w-3' />
                              Guardrail Paused
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    )}
                    {columns.find((c) => c.id === 'created')?.visible && (
                      <TableCell className='text-sm text-muted-foreground'>
                        {product.createdAt
                          ? format(new Date(product.createdAt), 'MMM d, yyyy')
                          : 'N/A'}
                      </TableCell>
                    )}
                    {columns.find((c) => c.id === 'actions')?.visible && (
                      <TableCell className='text-right'>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant='ghost' size='icon'>
                              <MoreHorizontal className='h-4 w-4' />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align='end' className='w-44'>
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(`/products/${product.id}`)
                              }
                            >
                              <Eye className='h-4 w-4 mr-2' />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(`/products/${product.id}/edit`)
                              }
                            >
                              <Edit className='h-4 w-4 mr-2' />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDuplicate(product)}
                            >
                              <Copy className='h-4 w-4 mr-2' />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() =>
                                bulkUpdateMutation.mutate({
                                  productIds: [product.id!],
                                  updates: { isFeatured: !product.isFeatured },
                                })
                              }
                            >
                              <Star className='h-4 w-4 mr-2' />
                              {product.isFeatured ? 'Unfeature' : 'Feature'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteId(product.id!)}
                              className='text-destructive'
                            >
                              <Trash2 className='h-4 w-4 mr-2' />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>

        {/* Pagination */}
        {totalPages > 1 && (
          <CardContent className='border-t py-4'>
            <div className='flex items-center justify-between'>
              <p className='text-sm text-muted-foreground'>
                Showing {(page - 1) * limit + 1} to{' '}
                {Math.min(page * limit, totalProducts)} of {totalProducts}{' '}
                products
              </p>
              <div className='flex items-center gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <span className='text-sm'>
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this product? This action cannot
              be undone and will permanently remove the product and all
              associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
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
