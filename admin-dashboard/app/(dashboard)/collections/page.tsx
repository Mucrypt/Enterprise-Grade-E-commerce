'use client'

import React, { useState } from 'react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Layers,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Package,
  FolderTree,
  Eye,
  EyeOff,
  Star,
  Settings2,
  Copy,
  Calendar,
  Clock,
  TrendingUp,
  Image as ImageIcon,
} from 'lucide-react'
import { collectionService } from '@/services/collection.service'
import {
  CollectionForm,
  CollectionFormData,
} from '@/components/collections/CollectionForm'
import { CollectionItemsManager } from '@/components/collections/CollectionItemsManager'
import { toast } from 'sonner'
import Image from 'next/image'
import { formatDistanceToNow } from 'date-fns'

interface Collection {
  id: string
  name: string
  slug: string
  description?: string
  short_description?: string
  image_url?: string
  banner_url?: string
  visibility: string
  display_order: string
  position: number
  is_active: boolean
  is_featured: boolean
  items_count: number
  starts_at?: string
  ends_at?: string
  created_at: string
  updated_at: string
}

export default function CollectionsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'products' | 'categories'>(
    'products',
  )
  const [search, setSearch] = useState('')
  const [visibilityFilter, setVisibilityFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingCollection, setEditingCollection] = useState<Collection | null>(
    null,
  )
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [managingItemsCollection, setManagingItemsCollection] =
    useState<Collection | null>(null)

  // Fetch product collections
  const {
    data: productCollectionsData,
    isLoading: isLoadingProducts,
    error: productError,
  } = useQuery({
    queryKey: ['product-collections', page, search, visibilityFilter],
    queryFn: async () => {
      const params: any = { page, limit: 20 }
      if (visibilityFilter !== 'all') params.visibility = visibilityFilter
      const response = (await collectionService.getProductCollections(
        params,
      )) as { data: any }
      return response.data
    },
    enabled: activeTab === 'products',
  })

  // Fetch category collections
  const {
    data: categoryCollectionsData,
    isLoading: isLoadingCategories,
    error: categoryError,
  } = useQuery({
    queryKey: ['category-collections', page, search, visibilityFilter],
    queryFn: async () => {
      const params: any = { page, limit: 20 }
      if (visibilityFilter !== 'all') params.visibility = visibilityFilter
      const response = (await collectionService.getCategoryCollections(
        params,
      )) as { data: any }
      return response.data
    },
    enabled: activeTab === 'categories',
  })

  // Create product collection
  const createProductMutation = useMutation({
    mutationFn: (data: CollectionFormData) =>
      collectionService.createProductCollection(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-collections'] })
      setIsFormOpen(false)
      toast.success('Product collection created successfully')
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message || 'Failed to create collection',
      )
    },
  })

  // Create category collection
  const createCategoryMutation = useMutation({
    mutationFn: (data: CollectionFormData) =>
      collectionService.createCategoryCollection(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-collections'] })
      setIsFormOpen(false)
      toast.success('Category collection created successfully')
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message || 'Failed to create collection',
      )
    },
  })

  // Update product collection
  const updateProductMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Partial<CollectionFormData>
    }) => collectionService.updateProductCollection(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-collections'] })
      setIsFormOpen(false)
      setEditingCollection(null)
      toast.success('Product collection updated successfully')
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message || 'Failed to update collection',
      )
    },
  })

  // Update category collection
  const updateCategoryMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Partial<CollectionFormData>
    }) => collectionService.updateCategoryCollection(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-collections'] })
      setIsFormOpen(false)
      setEditingCollection(null)
      toast.success('Category collection updated successfully')
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message || 'Failed to update collection',
      )
    },
  })

  // Delete product collection
  const deleteProductMutation = useMutation({
    mutationFn: (id: string) => collectionService.deleteProductCollection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-collections'] })
      setDeleteId(null)
      toast.success('Product collection deleted successfully')
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message || 'Failed to delete collection',
      )
    },
  })

  // Delete category collection
  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => collectionService.deleteCategoryCollection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-collections'] })
      setDeleteId(null)
      toast.success('Category collection deleted successfully')
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message || 'Failed to delete collection',
      )
    },
  })

  const handleFormSubmit = async (formData: CollectionFormData) => {
    if (editingCollection) {
      if (activeTab === 'products') {
        await updateProductMutation.mutateAsync({
          id: editingCollection.id,
          data: formData,
        })
      } else {
        await updateCategoryMutation.mutateAsync({
          id: editingCollection.id,
          data: formData,
        })
      }
    } else {
      if (activeTab === 'products') {
        await createProductMutation.mutateAsync(formData)
      } else {
        await createCategoryMutation.mutateAsync(formData)
      }
    }
  }

  const handleEdit = (collection: Collection) => {
    setEditingCollection(collection)
    setIsFormOpen(true)
  }

  const handleDelete = () => {
    if (!deleteId) return
    if (activeTab === 'products') {
      deleteProductMutation.mutate(deleteId)
    } else {
      deleteCategoryMutation.mutate(deleteId)
    }
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setEditingCollection(null)
  }

  const handleDuplicate = async (collection: Collection) => {
    const duplicatedData = {
      name: `${collection.name} (Copy)`,
      slug: `${collection.slug}-copy-${Date.now()}`,
      description: collection.description || '',
      shortDescription: collection.short_description || '',
      imageUrl: collection.image_url || '',
      bannerUrl: collection.banner_url || '',
      visibility: collection.visibility as 'public' | 'private' | 'hidden',
      displayOrder: String(collection.display_order),
      position: collection.position + 1,
      isActive: false, // Start as inactive
      isFeatured: false,
      startsAt: collection.starts_at,
      endsAt: collection.ends_at,
    }

    try {
      if (activeTab === 'products') {
        await createProductMutation.mutateAsync(duplicatedData)
      } else {
        await createCategoryMutation.mutateAsync(duplicatedData)
      }
      toast.success('Collection duplicated successfully')
    } catch (error) {
      toast.error('Failed to duplicate collection')
    }
  }

  const getSchedulingStatus = (collection: Collection) => {
    const now = new Date()
    const startsAt = collection.starts_at
      ? new Date(collection.starts_at)
      : null
    const endsAt = collection.ends_at ? new Date(collection.ends_at) : null

    if (startsAt && startsAt > now) {
      return {
        status: 'scheduled',
        label: `Starts ${formatDistanceToNow(startsAt, { addSuffix: true })}`,
        variant: 'outline' as const,
        icon: Calendar,
      }
    }

    if (endsAt && endsAt < now) {
      return {
        status: 'ended',
        label: 'Ended',
        variant: 'secondary' as const,
        icon: Clock,
      }
    }

    if (startsAt && endsAt && startsAt <= now && endsAt > now) {
      return {
        status: 'active',
        label: `Ends ${formatDistanceToNow(endsAt, { addSuffix: true })}`,
        variant: 'default' as const,
        icon: TrendingUp,
      }
    }

    return null
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value as 'products' | 'categories')
    setPage(1)
    setSearch('')
    setVisibilityFilter('all')
  }

  const isLoading =
    activeTab === 'products' ? isLoadingProducts : isLoadingCategories
  const error = activeTab === 'products' ? productError : categoryError
  const data =
    activeTab === 'products' ? productCollectionsData : categoryCollectionsData
  const collections = data?.collections || []
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 }

  const isFormLoading =
    createProductMutation.isPending ||
    createCategoryMutation.isPending ||
    updateProductMutation.isPending ||
    updateCategoryMutation.isPending

  const getVisibilityBadge = (visibility: string) => {
    switch (visibility) {
      case 'public':
        return (
          <Badge variant='default'>
            <Eye className='h-3 w-3 mr-1' />
            Public
          </Badge>
        )
      case 'private':
        return (
          <Badge variant='secondary'>
            <EyeOff className='h-3 w-3 mr-1' />
            Private
          </Badge>
        )
      case 'hidden':
        return (
          <Badge variant='outline'>
            <EyeOff className='h-3 w-3 mr-1' />
            Hidden
          </Badge>
        )
      default:
        return <Badge variant='outline'>{visibility}</Badge>
    }
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Collections</h1>
          <p className='text-muted-foreground'>
            Organize products and categories into collections
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className='h-4 w-4 mr-2' />
          Add Collection
        </Button>
      </div>

      {/* Stats Cards */}
      <div className='grid gap-4 md:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Product Collections
            </CardTitle>
            <Package className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {productCollectionsData?.pagination?.total || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Category Collections
            </CardTitle>
            <FolderTree className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {categoryCollectionsData?.pagination?.total || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Featured</CardTitle>
            <Star className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {collections.filter((c: Collection) => c.is_featured).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Items</CardTitle>
            <Layers className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {collections.reduce(
                (sum: number, c: Collection) => sum + (c.items_count || 0),
                0,
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content with Tabs */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Layers className='h-5 w-5' />
            Collections
          </CardTitle>
          <CardDescription>
            Manage your product and category collections
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className='mb-4'>
              <TabsTrigger value='products' className='flex items-center gap-2'>
                <Package className='h-4 w-4' />
                Product Collections
              </TabsTrigger>
              <TabsTrigger
                value='categories'
                className='flex items-center gap-2'
              >
                <FolderTree className='h-4 w-4' />
                Category Collections
              </TabsTrigger>
            </TabsList>

            {/* Filters */}
            <div className='flex flex-col sm:flex-row gap-4 mb-6'>
              <div className='relative flex-1'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                <Input
                  placeholder='Search collections...'
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                  className='pl-10'
                />
              </div>
              <Select
                value={visibilityFilter}
                onValueChange={(v: string) => {
                  setVisibilityFilter(v)
                  setPage(1)
                }}
              >
                <SelectTrigger className='w-40'>
                  <SelectValue placeholder='Visibility' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Visibility</SelectItem>
                  <SelectItem value='public'>Public</SelectItem>
                  <SelectItem value='private'>Private</SelectItem>
                  <SelectItem value='hidden'>Hidden</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <TabsContent value='products'>
              {renderCollectionsTable()}
            </TabsContent>

            <TabsContent value='categories'>
              {renderCollectionsTable()}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Collection Form Modal */}
      <CollectionForm
        open={isFormOpen}
        onClose={handleCloseForm}
        onSubmit={handleFormSubmit}
        collection={editingCollection}
        isLoading={isFormLoading}
        type={activeTab === 'products' ? 'product' : 'category'}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Collection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this collection? This action
              cannot be undone. Items in the collection will not be deleted.
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

      {/* Collection Items Manager */}
      {managingItemsCollection && (
        <CollectionItemsManager
          collectionId={managingItemsCollection.id}
          collectionName={managingItemsCollection.name}
          collectionType={activeTab === 'products' ? 'product' : 'category'}
          open={!!managingItemsCollection}
          onClose={() => setManagingItemsCollection(null)}
          onItemsChange={() => {
            queryClient.invalidateQueries({
              queryKey: [
                activeTab === 'products'
                  ? 'product-collections'
                  : 'category-collections',
              ],
            })
          }}
        />
      )}
    </div>
  )

  function renderCollectionsTable() {
    if (isLoading) {
      return (
        <div className='space-y-3'>
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className='h-16 w-full' />
          ))}
        </div>
      )
    }

    if (error) {
      return (
        <div className='text-center py-8 text-destructive'>
          Failed to load collections
        </div>
      )
    }

    if (collections.length === 0) {
      return (
        <div className='text-center py-12'>
          <Layers className='mx-auto h-12 w-12 text-muted-foreground mb-4' />
          <h3 className='text-lg font-semibold'>No collections found</h3>
          <p className='text-muted-foreground mb-4'>
            {search
              ? 'Try adjusting your search'
              : `Get started by creating your first ${
                  activeTab === 'products' ? 'product' : 'category'
                } collection`}
          </p>
          {!search && (
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className='h-4 w-4 mr-2' />
              Create Collection
            </Button>
          )}
        </div>
      )
    }

    return (
      <>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-16'></TableHead>
              <TableHead>Name</TableHead>
              <TableHead className='text-center'>Items</TableHead>
              <TableHead className='text-center'>Visibility</TableHead>
              <TableHead className='text-center'>Status</TableHead>
              <TableHead className='text-center'>Schedule</TableHead>
              <TableHead className='text-center'>Featured</TableHead>
              <TableHead className='w-20'></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {collections.map((collection: Collection) => {
              const scheduling = getSchedulingStatus(collection)

              return (
                <TableRow key={collection.id}>
                  <TableCell>
                    {collection.image_url ? (
                      <div className='relative h-10 w-10 rounded-md overflow-hidden bg-muted'>
                        <Image
                          src={collection.image_url}
                          alt={collection.name}
                          fill
                          className='object-cover'
                        />
                      </div>
                    ) : (
                      <div className='h-10 w-10 rounded-md bg-muted flex items-center justify-center'>
                        <ImageIcon className='h-5 w-5 text-muted-foreground' />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className='space-y-1'>
                      <p className='font-medium'>{collection.name}</p>
                      <p className='text-xs text-muted-foreground'>
                        {collection.slug}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className='text-center'>
                    <Badge
                      variant='secondary'
                      className='cursor-pointer hover:bg-secondary/80'
                      onClick={() => setManagingItemsCollection(collection)}
                    >
                      {collection.items_count || 0}{' '}
                      {activeTab === 'products' ? 'products' : 'categories'}
                    </Badge>
                  </TableCell>
                  <TableCell className='text-center'>
                    {getVisibilityBadge(collection.visibility)}
                  </TableCell>
                  <TableCell className='text-center'>
                    <Badge
                      variant={collection.is_active ? 'default' : 'secondary'}
                    >
                      {collection.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className='text-center'>
                    {scheduling ? (
                      <Badge variant={scheduling.variant} className='text-xs'>
                        <scheduling.icon className='h-3 w-3 mr-1' />
                        {scheduling.label}
                      </Badge>
                    ) : (
                      <span className='text-xs text-muted-foreground'>-</span>
                    )}
                  </TableCell>
                  <TableCell className='text-center'>
                    {collection.is_featured && (
                      <Star className='h-4 w-4 text-yellow-500 mx-auto fill-yellow-500' />
                    )}
                  </TableCell>
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
                          onClick={() => setManagingItemsCollection(collection)}
                        >
                          <Settings2 className='mr-2 h-4 w-4' />
                          Manage Items
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleEdit(collection)}
                        >
                          <Pencil className='mr-2 h-4 w-4' />
                          Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDuplicate(collection)}
                        >
                          <Copy className='mr-2 h-4 w-4' />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleteId(collection.id)}
                          className='text-destructive'
                        >
                          <Trash2 className='mr-2 h-4 w-4' />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
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
    )
  }
}
