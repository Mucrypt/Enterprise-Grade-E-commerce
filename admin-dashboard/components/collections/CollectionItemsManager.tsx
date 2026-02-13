'use client'

import React, { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  Trash2,
  GripVertical,
  Package,
  FolderTree,
  Search,
  CheckCircle2,
  X,
  ArrowUp,
  ArrowDown,
  Star,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react'
import { collectionService } from '@/services/collection.service'
import { productService } from '@/services/product.service'
import { categoryService } from '@/services/category.service'
import { toast } from 'sonner'
import Image from 'next/image'

interface CollectionItemsManagerProps {
  open: boolean
  onClose: () => void
  collection: any
  type: 'product' | 'category'
}

interface CollectionItem {
  id: string
  item_id: string
  position: number
  is_featured: boolean
  added_at: string
  // Product/Category fields
  name: string
  slug: string
  image_url?: string
  sku?: string
  base_price?: number
}

export function CollectionItemsManager({
  open,
  onClose,
  collection,
  type,
}: CollectionItemsManagerProps) {
  const queryClient = useQueryClient()
  const [showAddItems, setShowAddItems] = useState(false)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [itemToRemove, setItemToRemove] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const collectionId = collection?.id

  // Fetch collection items
  const {
    data: itemsData,
    isLoading: itemsLoading,
    refetch: refetchItems,
  } = useQuery({
    queryKey: [`${type}-collection-items`, collectionId],
    queryFn: async () => {
      if (type === 'product') {
        const response = (await collectionService.getProductCollection(
          collectionId,
        )) as any
        return response?.products || []
      } else {
        const response = (await collectionService.getCategoryCollection(
          collectionId,
        )) as any
        return response?.categories || []
      }
    },
    enabled: !!collectionId && open,
  })

  // Fetch available items to add
  const { data: availableItemsData, isLoading: availableLoading } = useQuery({
    queryKey: [`available-${type}s-for-collection`, collectionId, searchQuery],
    queryFn: async () => {
      if (type === 'product') {
        const response = (await productService.getProducts({
          limit: 50,
          search: searchQuery,
        })) as any
        return response?.items || response?.products || []
      } else {
        const response = (await categoryService.getCategories()) as any
        return response?.categories || []
      }
    },
    enabled: showAddItems,
  })

  const items: CollectionItem[] = itemsData || []
  const availableItems = availableItemsData || []

  // Filter out already added items
  const itemIds = items.map((item) => item.item_id || item.id)
  const filteredAvailableItems = availableItems.filter(
    (item: any) => !itemIds.includes(item.id),
  )

  // Add items mutation
  const addItemsMutation = useMutation({
    mutationFn: async (itemIds: string[]) => {
      if (type === 'product') {
        return collectionService.addProductsToCollection(collectionId, itemIds)
      } else {
        return collectionService.addCategoriesToCollection(
          collectionId,
          itemIds,
        )
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${type}-collection-items`] })
      queryClient.invalidateQueries({ queryKey: [`${type}-collections`] })
      setSelectedItems([])
      setShowAddItems(false)
      refetchItems()
      toast.success(
        `${type === 'product' ? 'Products' : 'Categories'} added to collection`,
      )
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to add items')
    },
  })

  // Remove item mutation
  const removeItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      if (type === 'product') {
        return collectionService.removeProductFromCollection(
          collectionId,
          itemId,
        )
      } else {
        return collectionService.removeCategoryFromCollection(
          collectionId,
          itemId,
        )
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${type}-collection-items`] })
      queryClient.invalidateQueries({ queryKey: [`${type}-collections`] })
      setItemToRemove(null)
      refetchItems()
      toast.success(
        `${
          type === 'product' ? 'Product' : 'Category'
        } removed from collection`,
      )
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to remove item')
    },
  })

  // Reorder items mutation
  const reorderMutation = useMutation({
    mutationFn: async (
      reorderedItems: Array<{
        productId?: string
        categoryId?: string
        position: number
      }>,
    ) => {
      if (type === 'product') {
        return collectionService.reorderProductsInCollection(
          collectionId,
          reorderedItems.map((item) => ({
            productId: item.productId!,
            position: item.position,
          })),
        )
      } else {
        return collectionService.reorderCategoriesInCollection(
          collectionId,
          reorderedItems.map((item) => ({
            categoryId: item.categoryId!,
            position: item.position,
          })),
        )
      }
    },
    onSuccess: () => {
      refetchItems()
      toast.success('Items reordered')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to reorder items')
    },
  })

  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    const newItems = [...items]
    const targetIndex = direction === 'up' ? index - 1 : index + 1

    if (targetIndex < 0 || targetIndex >= newItems.length)
      return // Swap positions
    ;[newItems[index], newItems[targetIndex]] = [
      newItems[targetIndex],
      newItems[index],
    ]

    // Update positions
    const reorderedItems = newItems.map((item, idx) => ({
      productId: type === 'product' ? item.item_id || item.id : undefined,
      categoryId: type === 'category' ? item.item_id || item.id : undefined,
      position: idx,
    }))

    reorderMutation.mutate(reorderedItems)
  }

  const handleAddSelected = () => {
    if (selectedItems.length === 0) {
      toast.error('Select at least one item to add')
      return
    }
    addItemsMutation.mutate(selectedItems)
  }

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId],
    )
  }

  const selectAllItems = () => {
    if (selectedItems.length === filteredAvailableItems.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(filteredAvailableItems.map((item: any) => item.id))
    }
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className='w-full sm:max-w-2xl overflow-hidden flex flex-col'>
        <SheetHeader>
          <SheetTitle className='flex items-center gap-2'>
            {type === 'product' ? (
              <Package className='h-5 w-5' />
            ) : (
              <FolderTree className='h-5 w-5' />
            )}
            Manage Collection Items
          </SheetTitle>
          <SheetDescription>
            {collection?.name} — {items.length}{' '}
            {type === 'product' ? 'products' : 'categories'}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-hidden flex flex-col mt-4'>
          {/* Action Bar */}
          <div className='flex items-center justify-between mb-4'>
            <div className='flex items-center gap-2'>
              <Badge variant='outline' className='text-sm'>
                {items.length} items
              </Badge>
              {items.filter((i) => i.is_featured).length > 0 && (
                <Badge variant='secondary' className='text-sm'>
                  <Star className='h-3 w-3 mr-1 fill-yellow-500 text-yellow-500' />
                  {items.filter((i) => i.is_featured).length} featured
                </Badge>
              )}
            </div>
            <Button onClick={() => setShowAddItems(true)} size='sm'>
              <Plus className='h-4 w-4 mr-2' />
              Add {type === 'product' ? 'Products' : 'Categories'}
            </Button>
          </div>

          <Separator />

          {/* Items List */}
          <ScrollArea className='flex-1 mt-4'>
            {itemsLoading ? (
              <div className='space-y-3'>
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className='h-16 w-full' />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className='text-center py-12'>
                <div className='mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4'>
                  {type === 'product' ? (
                    <Package className='h-6 w-6 text-muted-foreground' />
                  ) : (
                    <FolderTree className='h-6 w-6 text-muted-foreground' />
                  )}
                </div>
                <h3 className='text-lg font-medium'>
                  No items in this collection
                </h3>
                <p className='text-muted-foreground text-sm mt-1'>
                  Add {type === 'product' ? 'products' : 'categories'} to this
                  collection
                </p>
                <Button className='mt-4' onClick={() => setShowAddItems(true)}>
                  <Plus className='h-4 w-4 mr-2' />
                  Add {type === 'product' ? 'Products' : 'Categories'}
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-10'></TableHead>
                    <TableHead className='w-16'>Image</TableHead>
                    <TableHead>Name</TableHead>
                    {type === 'product' && <TableHead>SKU</TableHead>}
                    <TableHead className='text-center'>Position</TableHead>
                    <TableHead className='w-24'></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={item.id || item.item_id}>
                      <TableCell>
                        <GripVertical className='h-4 w-4 text-muted-foreground cursor-move' />
                      </TableCell>
                      <TableCell>
                        {item.image_url ? (
                          <Image
                            src={item.image_url}
                            alt={item.name}
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
                      <TableCell>
                        <div className='flex flex-col'>
                          <span className='font-medium'>{item.name}</span>
                          <span className='text-xs text-muted-foreground'>
                            {item.slug}
                          </span>
                        </div>
                      </TableCell>
                      {type === 'product' && (
                        <TableCell className='text-muted-foreground'>
                          {item.sku || '—'}
                        </TableCell>
                      )}
                      <TableCell className='text-center'>
                        <div className='flex items-center justify-center gap-1'>
                          <Button
                            variant='ghost'
                            size='icon'
                            className='h-7 w-7'
                            onClick={() => handleMoveItem(index, 'up')}
                            disabled={index === 0 || reorderMutation.isPending}
                          >
                            <ArrowUp className='h-3 w-3' />
                          </Button>
                          <span className='text-sm text-muted-foreground w-6 text-center'>
                            {index + 1}
                          </span>
                          <Button
                            variant='ghost'
                            size='icon'
                            className='h-7 w-7'
                            onClick={() => handleMoveItem(index, 'down')}
                            disabled={
                              index === items.length - 1 ||
                              reorderMutation.isPending
                            }
                          >
                            <ArrowDown className='h-3 w-3' />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-8 w-8 text-destructive hover:text-destructive'
                          onClick={() =>
                            setItemToRemove(item.item_id || item.id)
                          }
                        >
                          <Trash2 className='h-4 w-4' />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </div>

        {/* Add Items Dialog */}
        <AlertDialog open={showAddItems} onOpenChange={setShowAddItems}>
          <AlertDialogContent className='max-w-2xl max-h-[80vh] flex flex-col'>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Add {type === 'product' ? 'Products' : 'Categories'} to
                Collection
              </AlertDialogTitle>
              <AlertDialogDescription>
                Select items to add to "{collection?.name}"
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className='flex-1 overflow-hidden flex flex-col'>
              {/* Search */}
              <div className='relative mb-4'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                <input
                  type='text'
                  placeholder={`Search ${
                    type === 'product' ? 'products' : 'categories'
                  }...`}
                  className='w-full pl-10 pr-4 py-2 border rounded-md'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Select All */}
              {filteredAvailableItems.length > 0 && (
                <div className='flex items-center justify-between mb-2 p-2 bg-muted/50 rounded'>
                  <div className='flex items-center gap-2'>
                    <Checkbox
                      checked={
                        selectedItems.length === filteredAvailableItems.length
                      }
                      onCheckedChange={selectAllItems}
                    />
                    <span className='text-sm font-medium'>
                      Select All ({filteredAvailableItems.length})
                    </span>
                  </div>
                  <Badge variant='secondary'>
                    {selectedItems.length} selected
                  </Badge>
                </div>
              )}

              {/* Items Grid */}
              <ScrollArea className='flex-1 max-h-100'>
                {availableLoading ? (
                  <div className='space-y-2'>
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className='h-14 w-full' />
                    ))}
                  </div>
                ) : filteredAvailableItems.length === 0 ? (
                  <div className='text-center py-8'>
                    <p className='text-muted-foreground'>
                      {searchQuery
                        ? 'No items found matching your search'
                        : 'All items are already in this collection'}
                    </p>
                  </div>
                ) : (
                  <div className='space-y-1'>
                    {filteredAvailableItems.map((item: any) => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedItems.includes(item.id)
                            ? 'border-primary bg-primary/5'
                            : 'border-transparent hover:bg-muted/50'
                        }`}
                        onClick={() => toggleItemSelection(item.id)}
                      >
                        <Checkbox checked={selectedItems.includes(item.id)} />
                        {item.image_url || item.thumbnail_url ? (
                          <Image
                            src={item.image_url || item.thumbnail_url}
                            alt={item.name}
                            width={40}
                            height={40}
                            className='rounded object-cover'
                          />
                        ) : (
                          <div className='w-10 h-10 bg-muted rounded flex items-center justify-center'>
                            {type === 'product' ? (
                              <Package className='h-4 w-4 text-muted-foreground' />
                            ) : (
                              <FolderTree className='h-4 w-4 text-muted-foreground' />
                            )}
                          </div>
                        )}
                        <div className='flex-1 min-w-0'>
                          <p className='font-medium truncate'>{item.name}</p>
                          <p className='text-xs text-muted-foreground truncate'>
                            {type === 'product' ? item.sku : item.slug}
                          </p>
                        </div>
                        {type === 'product' && item.base_price && (
                          <span className='text-sm font-medium'>
                            ${Number(item.base_price).toFixed(2)}
                          </span>
                        )}
                        {selectedItems.includes(item.id) && (
                          <CheckCircle2 className='h-5 w-5 text-primary' />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            <AlertDialogFooter className='mt-4'>
              <AlertDialogCancel onClick={() => setSelectedItems([])}>
                Cancel
              </AlertDialogCancel>
              <Button
                onClick={handleAddSelected}
                disabled={
                  selectedItems.length === 0 || addItemsMutation.isPending
                }
              >
                {addItemsMutation.isPending && (
                  <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                )}
                Add {selectedItems.length}{' '}
                {selectedItems.length === 1 ? 'Item' : 'Items'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Remove Item Confirmation */}
        <AlertDialog
          open={!!itemToRemove}
          onOpenChange={() => setItemToRemove(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove from Collection</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove this {type} from the collection?
                The {type} itself will not be deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  itemToRemove && removeItemMutation.mutate(itemToRemove)
                }
                className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              >
                {removeItemMutation.isPending && (
                  <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                )}
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  )
}
