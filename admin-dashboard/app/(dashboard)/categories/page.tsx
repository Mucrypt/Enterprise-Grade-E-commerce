'use client'

import React, { useState, useMemo } from 'react'
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
} from 'lucide-react'
import { categoryService } from '@/services/category.service'
import { CategoryForm } from '@/components/categories/CategoryForm'
import { toast } from 'sonner'
import type { Category } from '@/types'
import Image from 'next/image'

export default function CategoriesPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [parentFilter, setParentFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [restoreId, setRestoreId] = useState<string | null>(null)

  // Fetch categories
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-categories', page, search, statusFilter, parentFilter],
    queryFn: async () => {
      const params: any = { page, limit: 20 }
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

  const handleFormSubmit = async (
    formData: any,
    files: { thumbnail?: File; banner?: File; icon?: File },
  ) => {
    if (editingCategory) {
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

  const categories = data?.categories || []
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Categories</h1>
          <p className='text-muted-foreground'>
            Manage product categories for your store
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className='h-4 w-4 mr-2' />
          Add Category
        </Button>
      </div>

      {/* Stats Cards */}
      <div className='grid gap-4 md:grid-cols-3'>
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
              {allCategories.filter((c: Category) => !c.parent_id).length}
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
          <div className='flex flex-col sm:flex-row gap-4 mb-6'>
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
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v)
                setPage(1)
              }}
            >
              <SelectTrigger className='w-[150px]'>
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
              onValueChange={(v) => {
                setParentFilter(v)
                setPage(1)
              }}
            >
              <SelectTrigger className='w-[180px]'>
                <SelectValue placeholder='Parent' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Categories</SelectItem>
                <SelectItem value='root'>Root Only</SelectItem>
                {allCategories.map((cat: Category) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
                    <TableHead className='w-[80px]'>Image</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Parent</TableHead>
                    <TableHead className='text-center'>Products</TableHead>
                    <TableHead className='text-center'>Order</TableHead>
                    <TableHead className='text-center'>Status</TableHead>
                    <TableHead className='w-[70px]'></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category: Category) => (
                    <TableRow key={category.id}>
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
                            width={48}
                            height={48}
                            className='rounded object-cover'
                          />
                        ) : (
                          <div className='w-12 h-12 bg-muted rounded flex items-center justify-center'>
                            <ImageIcon className='h-5 w-5 text-muted-foreground' />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className='font-medium'>
                        {category.name}
                      </TableCell>
                      <TableCell className='text-muted-foreground'>
                        {category.slug}
                      </TableCell>
                      <TableCell>
                        {category.parent_name ? (
                          <Badge variant='outline'>
                            {category.parent_name}
                          </Badge>
                        ) : (
                          <span className='text-muted-foreground'>—</span>
                        )}
                      </TableCell>
                      <TableCell className='text-center'>
                        <Badge variant='secondary'>
                          {category.product_count || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className='text-center'>
                        {category.display_order}
                      </TableCell>
                      <TableCell className='text-center'>
                        <Badge
                          variant={category.is_active ? 'default' : 'secondary'}
                        >
                          {category.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant='ghost' size='icon'>
                              <MoreHorizontal className='h-4 w-4' />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align='end'>
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleEdit(category)}
                            >
                              <Pencil className='mr-2 h-4 w-4' />
                              Edit
                            </DropdownMenuItem>
                            {category.is_active ? (
                              <DropdownMenuItem
                                onClick={() => setDeleteId(category.id)}
                                className='text-destructive'
                              >
                                <Trash2 className='mr-2 h-4 w-4' />
                                Delete
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => setRestoreId(category.id)}
                              >
                                <RotateCcw className='mr-2 h-4 w-4' />
                                Restore
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
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
