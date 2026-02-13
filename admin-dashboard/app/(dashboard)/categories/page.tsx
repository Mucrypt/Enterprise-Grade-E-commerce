'use client'

import React, { useState, useMemo, useCallback } from 'react'
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
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FolderTree,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  RotateCcw,
  ChevronRight,
  Image as ImageIcon,
  Package,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  Columns,
  X,
  Layers,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { categoryService } from '@/services/category.service'
import { CategoryForm } from '@/components/categories/CategoryForm'
import { toast } from 'sonner'
import type { Category } from '@/types'
import Image from 'next/image'

// Column configuration
interface ColumnConfig {
  id: string
  label: string
  visible: boolean
  sortable?: boolean
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'select', label: '', visible: true, sortable: false },
  { id: 'image', label: 'Image', visible: true, sortable: false },
  { id: 'name', label: 'Name', visible: true, sortable: true },
  { id: 'slug', label: 'Slug', visible: true, sortable: false },
  { id: 'parent', label: 'Parent', visible: true, sortable: false },
  { id: 'products', label: 'Products', visible: true, sortable: false },
  { id: 'subcategories', label: 'Sub-cats', visible: true, sortable: false },
  { id: 'order', label: 'Order', visible: true, sortable: true },
  { id: 'status', label: 'Status', visible: true, sortable: false },
  { id: 'actions', label: '', visible: true, sortable: false },
]

export default function CategoriesPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [parentFilter, setParentFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('display_order')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [restoreId, setRestoreId] = useState<string | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set(),
  )
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS)

  // Fetch categories
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: [
      'admin-categories',
      page,
      search,
      statusFilter,
      parentFilter,
      sortBy,
      sortOrder,
    ],
    queryFn: async () => {
      const params: any = { page, limit: 20, sortBy, sortOrder }
      if (search) params.search = search
      if (statusFilter !== 'all') params.isActive = statusFilter === 'active'
      if (parentFilter === 'root') params.parentId = null
      else if (parentFilter !== 'all') params.parentId = parentFilter

      const response = await categoryService.getAllCategories(params)
      return response.data
    },
  })

  // Get all categories for parent filter dropdown
  const { data: allCategoriesData } = useQuery({
    queryKey: ['all-categories-list'],
    queryFn: async () => {
      const response = await categoryService.getCategories()
      return response.data?.categories || []
    },
  })

  const allCategories = allCategoriesData || []

  // Create category mutation
  const createMutation = useMutation({
    mutationFn: async ({
      data,
      files,
    }: {
      data: any
      files: { thumbnail?: File; banner?: File; icon?: File }
    }) => {
      if (files.thumbnail || files.banner || files.icon) {
        return categoryService.createCategoryWithMedia(
          data,
          files.thumbnail,
          files.banner,
          files.icon,
        )
      }
      return categoryService.createCategory(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] })
      queryClient.invalidateQueries({ queryKey: ['all-categories-list'] })
      setIsFormOpen(false)
      toast.success('Category created successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create category')
    },
  })

  // Update category mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
      files,
    }: {
      id: string
      data: any
      files: { thumbnail?: File; banner?: File; icon?: File }
    }) => {
      if (files.thumbnail || files.banner || files.icon) {
        return categoryService.updateCategoryWithMedia(id, data, files)
      }
      return categoryService.updateCategory(id, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] })
      queryClient.invalidateQueries({ queryKey: ['all-categories-list'] })
      setIsFormOpen(false)
      setEditingCategory(null)
      toast.success('Category updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update category')
    },
  })

  // Delete category mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => categoryService.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] })
      queryClient.invalidateQueries({ queryKey: ['all-categories-list'] })
      setDeleteId(null)
      toast.success('Category deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete category')
    },
  })

  // Restore category mutation
  const restoreMutation = useMutation({
    mutationFn: (id: string) => categoryService.restoreCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] })
      queryClient.invalidateQueries({ queryKey: ['all-categories-list'] })
      setRestoreId(null)
      toast.success('Category restored successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to restore category')
    },
  })

  // Bulk update mutation (for activating/deactivating)
  const bulkUpdateMutation = useMutation({
    mutationFn: async ({
      ids,
      updates,
    }: {
      ids: string[]
      updates: { isActive?: boolean }
    }) => {
      // Process each category update
      const promises = ids.map((id) =>
        categoryService.updateCategory(id, updates),
      )
      return Promise.all(promises)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] })
      setSelectedCategories(new Set())
      toast.success(
        `${selectedCategories.size} categories updated successfully`,
      )
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update categories')
    },
  })

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const promises = ids.map((id) => categoryService.deleteCategory(id))
      return Promise.all(promises)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] })
      setSelectedCategories(new Set())
      toast.success(
        `${selectedCategories.size} categories deleted successfully`,
      )
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete categories')
    },
  })

  const categories = data?.categories || []
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 }

  // Selection handlers
  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedCategories(new Set(categories.map((c: Category) => c.id!)))
      } else {
        setSelectedCategories(new Set())
      }
    },
    [categories],
  )

  const handleSelectCategory = useCallback((id: string, checked: boolean) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }, [])

  // Duplicate handler
  const handleDuplicate = async (category: Category) => {
    const duplicatedData = {
      name: `${category.name} (Copy)`,
      slug: `${category.slug}-copy-${Date.now()}`,
      description: category.description || '',
      parentId: category.parent_id || category.parentId || null,
      isActive: false, // Start as inactive
      displayOrder: (category.display_order || category.displayOrder || 0) + 1,
      metaTitle: category.meta_title || '',
      metaDescription: category.meta_description || '',
    }

    try {
      await createMutation.mutateAsync({ data: duplicatedData, files: {} })
      toast.success('Category duplicated successfully')
    } catch (error) {
      toast.error('Failed to duplicate category')
    }
  }

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
    setSearch('')
    setStatusFilter('all')
    setParentFilter('all')
    setSortBy('display_order')
    setSortOrder('asc')
    setPage(1)
  }, [])

  // Get sub-category count for a category
  const getSubcategoryCount = useCallback(
    (categoryId: string) => {
      return allCategories.filter(
        (c: Category) => (c.parent_id || c.parentId) === categoryId,
      ).length
    },
    [allCategories],
  )

  const hasActiveFilters =
    search ||
    statusFilter !== 'all' ||
    parentFilter !== 'all' ||
    sortBy !== 'display_order'

  const handleFormSubmit = async (
    formData: any,
    files: { thumbnail?: File; banner?: File; icon?: File },
  ) => {
    if (editingCategory && editingCategory.id) {
      await updateMutation.mutateAsync({
        id: editingCategory.id,
        data: formData,
        files,
      })
    } else {
      await createMutation.mutateAsync({ data: formData, files })
    }
  }

  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setEditingCategory(null)
  }

  const getMediaUrl = (category: Category, purpose: string) => {
    const media = category.media?.find((m: any) => m.media_purpose === purpose)
    return (
      media?.cdn_urls?.thumbnail || media?.cdn_urls?.small || media?.file_path
    )
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Categories</h1>
          <p className='text-muted-foreground'>
            {pagination.total} categories in your store
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <Button variant='outline' size='sm' onClick={() => refetch()}>
            \n{' '}
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`}
            />
            \n Refresh
          </Button>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className='h-4 w-4 mr-2' />
            Add Category
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className='grid gap-4 md:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Total Categories
            </CardTitle>
            <FolderTree className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{pagination.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Root Categories
            </CardTitle>
            <ChevronRight className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {
                allCategories.filter(
                  (c: Category) => !c.parent_id && !c.parentId,
                ).length
              }
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Active</CardTitle>
            <CheckCircle className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {
                allCategories.filter((c: Category) => c.is_active || c.isActive)
                  .length
              }
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>With Products</CardTitle>
            <Package className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {
                categories.filter((c: Category) => (c.product_count || 0) > 0)
                  .length
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <FolderTree className='h-5 w-5' />
            Categories
          </CardTitle>
          <CardDescription>
            View and manage all product categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex flex-col lg:flex-row gap-4 mb-6'>
            <div className='relative flex-1'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
              <Input
                placeholder='Search categories...'
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className='pl-10'
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
                >
                  <X className='h-4 w-4' />
                </button>
              )}
            </div>
            <div className='flex flex-wrap items-center gap-2'>
              <Select
                value={statusFilter}
                onValueChange={(v: string) => {
                  setStatusFilter(v)
                  setPage(1)
                }}
              >
                <SelectTrigger className='w-32'>
                  <SelectValue placeholder='Status' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Status</SelectItem>
                  <SelectItem value='active'>Active</SelectItem>
                  <SelectItem value='inactive'>Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={parentFilter}
                onValueChange={(v: string) => {
                  setParentFilter(v)
                  setPage(1)
                }}
              >
                <SelectTrigger className='w-36'>
                  <SelectValue placeholder='Parent' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All</SelectItem>
                  <SelectItem value='root'>Root Only</SelectItem>
                  {allCategories.map((cat: Category) => (
                    <SelectItem key={cat.id} value={cat.id!}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  <SelectItem value='display_order-asc'>
                    Order: Low to High
                  </SelectItem>
                  <SelectItem value='display_order-desc'>
                    Order: High to Low
                  </SelectItem>
                  <SelectItem value='name-asc'>Name A-Z</SelectItem>
                  <SelectItem value='name-desc'>Name Z-A</SelectItem>
                  <SelectItem value='created_at-desc'>Newest First</SelectItem>
                  <SelectItem value='created_at-asc'>Oldest First</SelectItem>
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
            <div className='flex flex-wrap items-center gap-2 mb-4 pb-4 border-b'>
              <span className='text-sm text-muted-foreground'>
                Active filters:
              </span>
              {search && (
                <Badge variant='secondary' className='gap-1'>
                  Search: &quot;{search}&quot;
                  <button onClick={() => setSearch('')}>
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
              {parentFilter !== 'all' && (
                <Badge variant='secondary' className='gap-1'>
                  Parent:{' '}
                  {parentFilter === 'root'
                    ? 'Root'
                    : allCategories.find((c: Category) => c.id === parentFilter)
                        ?.name}
                  <button onClick={() => setParentFilter('all')}>
                    <X className='h-3 w-3' />
                  </button>
                </Badge>
              )}
            </div>
          )}

          {/* Bulk Actions */}
          {selectedCategories.size > 0 && (
            <div className='flex items-center gap-3 mb-4 pb-4 border-b'>
              <span className='text-sm font-medium'>
                {selectedCategories.size} selected
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
                        ids: Array.from(selectedCategories),
                        updates: { isActive: true },
                      })
                    }
                  >
                    <CheckCircle className='h-4 w-4 mr-2' />
                    Activate
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      bulkUpdateMutation.mutate({
                        ids: Array.from(selectedCategories),
                        updates: { isActive: false },
                      })
                    }
                  >
                    <XCircle className='h-4 w-4 mr-2' />
                    Deactivate
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant='outline'
                size='sm'
                className='text-destructive'
                onClick={() =>
                  bulkDeleteMutation.mutate(Array.from(selectedCategories))
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
                onClick={() => setSelectedCategories(new Set())}
              >
                Clear Selection
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
              Failed to load categories
            </div>
          ) : categories.length === 0 ? (
            <div className='text-center py-12'>
              <FolderTree className='mx-auto h-12 w-12 text-muted-foreground mb-4' />
              <h3 className='text-lg font-semibold'>No categories found</h3>
              <p className='text-muted-foreground mb-4'>
                {search
                  ? 'Try adjusting your search'
                  : 'Get started by creating your first category'}
              </p>
              {!search && (
                <Button onClick={() => setIsFormOpen(true)}>
                  <Plus className='h-4 w-4 mr-2' />
                  Create Category
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.find((c) => c.id === 'select')?.visible && (
                      <TableHead className='w-12'>
                        <Checkbox
                          checked={
                            categories.length > 0 &&
                            selectedCategories.size === categories.length
                          }
                          onCheckedChange={handleSelectAll}
                          aria-label='Select all'
                        />
                      </TableHead>
                    )}
                    {columns.find((c) => c.id === 'image')?.visible && (
                      <TableHead className='w-16'>Image</TableHead>
                    )}
                    {columns.find((c) => c.id === 'name')?.visible && (
                      <TableHead>
                        <button
                          className='flex items-center gap-1 hover:text-foreground transition-colors'
                          onClick={() => handleSort('name')}
                        >
                          Name
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
                    {columns.find((c) => c.id === 'slug')?.visible && (
                      <TableHead>Slug</TableHead>
                    )}
                    {columns.find((c) => c.id === 'parent')?.visible && (
                      <TableHead>Parent</TableHead>
                    )}
                    {columns.find((c) => c.id === 'products')?.visible && (
                      <TableHead className='text-center'>Products</TableHead>
                    )}
                    {columns.find((c) => c.id === 'subcategories')?.visible && (
                      <TableHead className='text-center'>Sub-cats</TableHead>
                    )}
                    {columns.find((c) => c.id === 'order')?.visible && (
                      <TableHead className='text-center'>
                        <button
                          className='flex items-center gap-1 hover:text-foreground transition-colors mx-auto'
                          onClick={() => handleSort('display_order')}
                        >
                          Order
                          {sortBy === 'display_order' ? (
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
                    {columns.find((c) => c.id === 'status')?.visible && (
                      <TableHead className='text-center'>Status</TableHead>
                    )}
                    {columns.find((c) => c.id === 'actions')?.visible && (
                      <TableHead className='w-16'></TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category: Category) => (
                    <TableRow
                      key={category.id}
                      className={
                        selectedCategories.has(category.id!)
                          ? 'bg-muted/50'
                          : undefined
                      }
                    >
                      {columns.find((c) => c.id === 'select')?.visible && (
                        <TableCell>
                          <Checkbox
                            checked={selectedCategories.has(category.id!)}
                            onCheckedChange={(
                              checked: boolean | 'indeterminate',
                            ) =>
                              handleSelectCategory(
                                category.id!,
                                checked === true,
                              )
                            }
                            aria-label={`Select ${category.name}`}
                          />
                        </TableCell>
                      )}
                      {columns.find((c) => c.id === 'image')?.visible && (
                        <TableCell>
                          {getMediaUrl(category, 'thumbnail') ||
                          getMediaUrl(category, 'icon') ? (
                            <Image
                              src={
                                getMediaUrl(category, 'thumbnail') ||
                                getMediaUrl(category, 'icon') ||
                                ''
                              }
                              alt={category.name}
                              width={40}
                              height={40}
                              className='rounded object-cover'
                            />
                          ) : (
                            <div className='w-10 h-10 bg-muted rounded flex items-center justify-center'>
                              <ImageIcon className='h-4 w-4 text-muted-foreground' />
                            </div>
                          )}
                        </TableCell>
                      )}
                      {columns.find((c) => c.id === 'name')?.visible && (
                        <TableCell className='font-medium'>
                          {category.name}
                        </TableCell>
                      )}
                      {columns.find((c) => c.id === 'slug')?.visible && (
                        <TableCell className='text-muted-foreground text-sm'>
                          {category.slug}
                        </TableCell>
                      )}
                      {columns.find((c) => c.id === 'parent')?.visible && (
                        <TableCell>
                          {category.parent_name ? (
                            <Badge variant='outline'>
                              {category.parent_name}
                            </Badge>
                          ) : (
                            <Badge variant='secondary'>Root</Badge>
                          )}
                        </TableCell>
                      )}
                      {columns.find((c) => c.id === 'products')?.visible && (
                        <TableCell className='text-center'>
                          <Badge variant='secondary'>
                            {category.product_count || 0}
                          </Badge>
                        </TableCell>
                      )}
                      {columns.find((c) => c.id === 'subcategories')
                        ?.visible && (
                        <TableCell className='text-center'>
                          <Badge variant='outline'>
                            {getSubcategoryCount(category.id!)}
                          </Badge>
                        </TableCell>
                      )}
                      {columns.find((c) => c.id === 'order')?.visible && (
                        <TableCell className='text-center'>
                          {category.display_order}
                        </TableCell>
                      )}
                      {columns.find((c) => c.id === 'status')?.visible && (
                        <TableCell className='text-center'>
                          <Badge
                            variant={
                              category.is_active ? 'default' : 'secondary'
                            }
                          >
                            {category.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                      )}
                      {columns.find((c) => c.id === 'actions')?.visible && (
                        <TableCell>
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
                                onClick={() => handleEdit(category)}
                              >
                                <Pencil className='mr-2 h-4 w-4' />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDuplicate(category)}
                              >
                                <Copy className='mr-2 h-4 w-4' />
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {category.is_active ? (
                                <DropdownMenuItem
                                  onClick={() => setDeleteId(category.id!)}
                                  className='text-destructive'
                                >
                                  <Trash2 className='mr-2 h-4 w-4' />
                                  Delete
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => setRestoreId(category.id!)}
                                >
                                  <RotateCcw className='mr-2 h-4 w-4' />
                                  Restore
                                </DropdownMenuItem>
                              )}
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

      {/* Category Form Modal */}
      <CategoryForm
        open={isFormOpen}
        onClose={handleCloseForm}
        onSubmit={handleFormSubmit}
        category={editingCategory}
        categories={allCategories}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this category? This action will
              deactivate the category but can be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Confirmation */}
      <AlertDialog open={!!restoreId} onOpenChange={() => setRestoreId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore this category? It will become
              active again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => restoreId && restoreMutation.mutate(restoreId)}
            >
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
