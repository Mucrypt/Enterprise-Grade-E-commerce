'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Tag,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Columns,
  Copy,
  CheckCircle,
  XCircle,
  Globe,
  Image as ImageIcon,
  Package,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import Image from 'next/image'
import { brandService, Brand } from '@/services/brand.service'
import { BrandForm } from '@/components/brands/BrandForm'
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
  { id: 'logo', label: 'Logo', visible: true, sortable: false },
  { id: 'name', label: 'Name', visible: true, sortable: true },
  { id: 'slug', label: 'Slug', visible: true, sortable: true },
  { id: 'description', label: 'Description', visible: false, sortable: false },
  { id: 'website', label: 'Website', visible: true, sortable: false },
  { id: 'products', label: 'Products', visible: true, sortable: true },
  { id: 'status', label: 'Status', visible: true, sortable: true },
  { id: 'created', label: 'Created', visible: false, sortable: true },
  { id: 'actions', label: '', visible: true, sortable: false },
]

export default function BrandsPage() {
  const queryClient = useQueryClient()

  // State
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set())
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS)
  const [sortBy, setSortBy] = useState<string>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const debouncedSearch = useDebounce(search, 300)

  // Fetch brands
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      'brands',
      page,
      debouncedSearch,
      statusFilter,
      sortBy,
      sortOrder,
    ],
    queryFn: async () => {
      const params: any = {
        page,
        limit: 20,
        sortBy,
        sortOrder,
      }
      if (debouncedSearch) params.search = debouncedSearch
      if (statusFilter !== 'all') params.isActive = statusFilter === 'active'

      const response = await brandService.getAllBrands(params)
      return response?.data
    },
  })

  const brands: Brand[] = data?.brands || []
  const pagination = data?.pagination || {
    page: 1,
    totalPages: 1,
    total: 0,
    limit: 20,
  }

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (formData: any) => brandService.createBrand(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] })
      setIsFormOpen(false)
      toast.success('Brand created successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create brand')
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      brandService.updateBrand(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] })
      setIsFormOpen(false)
      setEditingBrand(null)
      toast.success('Brand updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update brand')
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => brandService.deleteBrand(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] })
      setDeleteId(null)
      toast.success('Brand deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete brand')
    },
  })

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: ({
      ids,
      data,
    }: {
      ids: string[]
      data: { is_active?: boolean }
    }) => brandService.bulkUpdateBrands(ids, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] })
      setSelectedBrands(new Set())
      toast.success('Brands updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update brands')
    },
  })

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => brandService.bulkDeleteBrands(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] })
      setSelectedBrands(new Set())
      toast.success('Brands deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete brands')
    },
  })

  // Selection handlers
  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedBrands(new Set(brands.map((b) => b.id)))
      } else {
        setSelectedBrands(new Set())
      }
    },
    [brands],
  )

  const handleSelectBrand = useCallback((id: string, checked: boolean) => {
    setSelectedBrands((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }, [])

  // Form handlers
  const handleFormSubmit = async (formData: any) => {
    if (editingBrand) {
      await updateMutation.mutateAsync({ id: editingBrand.id, data: formData })
    } else {
      await createMutation.mutateAsync(formData)
    }
  }

  const handleEdit = (brand: Brand) => {
    setEditingBrand(brand)
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setEditingBrand(null)
  }

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId)
    }
  }

  const handleDuplicate = async (brand: Brand) => {
    const duplicatedData = {
      name: `${brand.name} (Copy)`,
      slug: `${brand.slug}-copy-${Date.now()}`,
      description: brand.description || '',
      websiteUrl: brand.website_url || '',
      isActive: false,
    }

    try {
      await createMutation.mutateAsync(duplicatedData)
      toast.success('Brand duplicated successfully')
    } catch {
      toast.error('Failed to duplicate brand')
    }
  }

  // Sorting handler
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  // Column visibility toggle
  const toggleColumn = (columnId: string) => {
    setColumns((prev) =>
      prev.map((col) =>
        col.id === columnId ? { ...col, visible: !col.visible } : col,
      ),
    )
  }

  const isColumnVisible = (columnId: string) => {
    return columns.find((col) => col.id === columnId)?.visible ?? true
  }

  // Reset filters
  const resetFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setSortBy('name')
    setSortOrder('asc')
    setPage(1)
  }

  const hasActiveFilters = search || statusFilter !== 'all'

  // Stats
  const totalBrands = pagination.total || 0
  const activeBrands = brands.filter((b: Brand) => b.is_active).length
  const totalProducts = brands.reduce(
    (sum: number, b: Brand) => sum + (b.product_count || 0),
    0,
  )

  const isFormLoading = createMutation.isPending || updateMutation.isPending

  // Sort icon helper
  const getSortIcon = (column: string) => {
    if (sortBy !== column)
      return <ArrowUpDown className='ml-1 h-3 w-3 text-muted-foreground' />
    return sortOrder === 'asc' ? (
      <ArrowUp className='ml-1 h-3 w-3' />
    ) : (
      <ArrowDown className='ml-1 h-3 w-3' />
    )
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Brands</h1>
          <p className='text-muted-foreground'>
            Manage product brands for your store
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            size='icon'
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
            />
          </Button>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className='h-4 w-4 mr-2' />
            Add Brand
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className='grid gap-4 md:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Brands</CardTitle>
            <Tag className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{totalBrands}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Active Brands</CardTitle>
            <CheckCircle className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-green-600'>
              {activeBrands}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Inactive</CardTitle>
            <XCircle className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-muted-foreground'>
              {brands.length - activeBrands}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Total Products
            </CardTitle>
            <Package className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{totalProducts}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Tag className='h-5 w-5' />
            Brands
          </CardTitle>
          <CardDescription>View and manage all product brands</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters & Actions */}
          <div className='flex flex-col sm:flex-row gap-4 mb-6'>
            <div className='relative flex-1'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
              <Input
                placeholder='Search brands...'
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className='pl-10'
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v: string) => {
                setStatusFilter(v)
                setPage(1)
              }}
            >
              <SelectTrigger className='w-40'>
                <SelectValue placeholder='Status' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Status</SelectItem>
                <SelectItem value='active'>Active</SelectItem>
                <SelectItem value='inactive'>Inactive</SelectItem>
              </SelectContent>
            </Select>

            {/* Column visibility */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='outline' size='icon'>
                  <Columns className='h-4 w-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-48'>
                <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {columns
                  .filter((col) => col.id !== 'select' && col.id !== 'actions')
                  .map((col) => (
                    <DropdownMenuCheckboxItem
                      key={col.id}
                      checked={col.visible}
                      onCheckedChange={() => toggleColumn(col.id)}
                    >
                      {col.label}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Bulk Actions */}
          {selectedBrands.size > 0 && (
            <div className='flex items-center gap-2 mb-4 p-3 bg-muted rounded-lg'>
              <span className='text-sm font-medium'>
                {selectedBrands.size} selected
              </span>
              <Button
                variant='outline'
                size='sm'
                onClick={() =>
                  bulkUpdateMutation.mutate({
                    ids: Array.from(selectedBrands),
                    data: { is_active: true },
                  })
                }
              >
                <CheckCircle className='h-4 w-4 mr-1' />
                Activate
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={() =>
                  bulkUpdateMutation.mutate({
                    ids: Array.from(selectedBrands),
                    data: { is_active: false },
                  })
                }
              >
                <XCircle className='h-4 w-4 mr-1' />
                Deactivate
              </Button>
              <Button
                variant='destructive'
                size='sm'
                onClick={() => {
                  if (confirm(`Delete ${selectedBrands.size} brands?`)) {
                    bulkDeleteMutation.mutate(Array.from(selectedBrands))
                  }
                }}
              >
                <Trash2 className='h-4 w-4 mr-1' />
                Delete
              </Button>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => setSelectedBrands(new Set())}
              >
                Clear
              </Button>
            </div>
          )}

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className='flex items-center gap-2 mb-4'>
              <span className='text-sm text-muted-foreground'>
                Active filters:
              </span>
              {search && (
                <Badge variant='secondary' className='flex items-center gap-1'>
                  Search: {search}
                  <X
                    className='h-3 w-3 cursor-pointer'
                    onClick={() => setSearch('')}
                  />
                </Badge>
              )}
              {statusFilter !== 'all' && (
                <Badge variant='secondary' className='flex items-center gap-1'>
                  Status: {statusFilter}
                  <X
                    className='h-3 w-3 cursor-pointer'
                    onClick={() => setStatusFilter('all')}
                  />
                </Badge>
              )}
              <Button variant='ghost' size='sm' onClick={resetFilters}>
                Clear all
              </Button>
            </div>
          )}

          {/* Table */}
          {isLoading ? (
            <div className='space-y-3'>
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className='h-16 w-full' />
              ))}
            </div>
          ) : error ? (
            <div className='text-center py-8 text-destructive'>
              Failed to load brands
            </div>
          ) : brands.length === 0 ? (
            <div className='text-center py-12'>
              <Tag className='mx-auto h-12 w-12 text-muted-foreground mb-4' />
              <h3 className='text-lg font-semibold'>No brands found</h3>
              <p className='text-muted-foreground mb-4'>
                {search
                  ? 'Try adjusting your search'
                  : 'Get started by creating your first brand'}
              </p>
              {!search && (
                <Button onClick={() => setIsFormOpen(true)}>
                  <Plus className='h-4 w-4 mr-2' />
                  Create Brand
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    {isColumnVisible('select') && (
                      <TableHead className='w-12'>
                        <Checkbox
                          checked={
                            brands.length > 0 &&
                            selectedBrands.size === brands.length
                          }
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                    )}
                    {isColumnVisible('logo') && (
                      <TableHead className='w-16'>Logo</TableHead>
                    )}
                    {isColumnVisible('name') && (
                      <TableHead
                        className='cursor-pointer hover:text-foreground'
                        onClick={() => handleSort('name')}
                      >
                        <div className='flex items-center'>
                          Name {getSortIcon('name')}
                        </div>
                      </TableHead>
                    )}
                    {isColumnVisible('slug') && <TableHead>Slug</TableHead>}
                    {isColumnVisible('description') && (
                      <TableHead>Description</TableHead>
                    )}
                    {isColumnVisible('website') && (
                      <TableHead>Website</TableHead>
                    )}
                    {isColumnVisible('products') && (
                      <TableHead
                        className='cursor-pointer hover:text-foreground text-center'
                        onClick={() => handleSort('product_count')}
                      >
                        <div className='flex items-center justify-center'>
                          Products {getSortIcon('product_count')}
                        </div>
                      </TableHead>
                    )}
                    {isColumnVisible('status') && (
                      <TableHead
                        className='cursor-pointer hover:text-foreground text-center'
                        onClick={() => handleSort('is_active')}
                      >
                        <div className='flex items-center justify-center'>
                          Status {getSortIcon('is_active')}
                        </div>
                      </TableHead>
                    )}
                    {isColumnVisible('created') && (
                      <TableHead
                        className='cursor-pointer hover:text-foreground'
                        onClick={() => handleSort('created_at')}
                      >
                        <div className='flex items-center'>
                          Created {getSortIcon('created_at')}
                        </div>
                      </TableHead>
                    )}
                    {isColumnVisible('actions') && (
                      <TableHead className='w-20' />
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brands.map((brand: Brand) => (
                    <TableRow key={brand.id}>
                      {isColumnVisible('select') && (
                        <TableCell>
                          <Checkbox
                            checked={selectedBrands.has(brand.id)}
                            onCheckedChange={(checked: boolean) =>
                              handleSelectBrand(brand.id, checked)
                            }
                          />
                        </TableCell>
                      )}
                      {isColumnVisible('logo') && (
                        <TableCell>
                          {brand.logo_url ? (
                            <div className='relative h-10 w-10 rounded-md overflow-hidden bg-muted'>
                              <Image
                                src={brand.logo_url}
                                alt={brand.name}
                                fill
                                className='object-contain'
                              />
                            </div>
                          ) : (
                            <div className='h-10 w-10 rounded-md bg-muted flex items-center justify-center'>
                              <ImageIcon className='h-5 w-5 text-muted-foreground' />
                            </div>
                          )}
                        </TableCell>
                      )}
                      {isColumnVisible('name') && (
                        <TableCell className='font-medium'>
                          {brand.name}
                        </TableCell>
                      )}
                      {isColumnVisible('slug') && (
                        <TableCell className='text-muted-foreground text-sm'>
                          {brand.slug}
                        </TableCell>
                      )}
                      {isColumnVisible('description') && (
                        <TableCell className='max-w-xs truncate'>
                          {brand.description || '-'}
                        </TableCell>
                      )}
                      {isColumnVisible('website') && (
                        <TableCell>
                          {brand.website_url ? (
                            <a
                              href={brand.website_url}
                              target='_blank'
                              rel='noopener noreferrer'
                              className='text-sm text-blue-600 hover:underline flex items-center gap-1'
                            >
                              <Globe className='h-3 w-3' />
                              Visit
                              <ExternalLink className='h-3 w-3' />
                            </a>
                          ) : (
                            <span className='text-muted-foreground'>-</span>
                          )}
                        </TableCell>
                      )}
                      {isColumnVisible('products') && (
                        <TableCell className='text-center'>
                          <Badge variant='secondary'>
                            {brand.product_count || 0}
                          </Badge>
                        </TableCell>
                      )}
                      {isColumnVisible('status') && (
                        <TableCell className='text-center'>
                          <Badge
                            variant={brand.is_active ? 'default' : 'secondary'}
                          >
                            {brand.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                      )}
                      {isColumnVisible('created') && (
                        <TableCell className='text-sm text-muted-foreground'>
                          {format(new Date(brand.created_at), 'MMM dd, yyyy')}
                        </TableCell>
                      )}
                      {isColumnVisible('actions') && (
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant='ghost' size='icon'>
                                <MoreHorizontal className='h-4 w-4' />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align='end' className='w-48'>
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleEdit(brand)}
                              >
                                <Pencil className='mr-2 h-4 w-4' />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDuplicate(brand)}
                              >
                                <Copy className='mr-2 h-4 w-4' />
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() =>
                                  updateMutation.mutate({
                                    id: brand.id,
                                    data: { isActive: !brand.is_active },
                                  })
                                }
                              >
                                {brand.is_active ? (
                                  <>
                                    <XCircle className='mr-2 h-4 w-4' />
                                    Deactivate
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className='mr-2 h-4 w-4' />
                                    Activate
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeleteId(brand.id)}
                                className='text-destructive'
                              >
                                <Trash2 className='mr-2 h-4 w-4' />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className='flex items-center justify-between mt-4'>
                  <p className='text-sm text-muted-foreground'>
                    Page {pagination.page} of {pagination.totalPages} (
                    {pagination.total} total)
                  </p>
                  <div className='flex gap-2'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() =>
                        setPage((p) => Math.min(pagination.totalPages, p + 1))
                      }
                      disabled={page === pagination.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Brand Form Modal */}
      <BrandForm
        open={isFormOpen}
        onClose={handleCloseForm}
        onSubmit={handleFormSubmit}
        brand={editingBrand}
        isLoading={isFormLoading}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Brand</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this brand? This action cannot be
              undone. Products using this brand will need to be updated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
