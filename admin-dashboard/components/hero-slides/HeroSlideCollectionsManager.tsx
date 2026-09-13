'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
  Layers,
  Search,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react'
import { heroSlideService, HeroSlide } from '@/services/hero-slide.service'
import { collectionService } from '@/services/collection.service'
import { getAbsoluteMediaUrl } from '@/lib/utils'
import { toast } from 'sonner'
import Image from 'next/image'

const MAX_ITEMS = 4

interface HeroSlideCollectionsManagerProps {
  open: boolean
  onClose: () => void
  slide: HeroSlide | null
}

interface SlideCollection {
  id: string
  name: string
  slug: string
  banner_url?: string | null
  image_url?: string | null
  items_count?: number
  item_position: number
}

export function HeroSlideCollectionsManager({ open, onClose, slide }: HeroSlideCollectionsManagerProps) {
  const queryClient = useQueryClient()
  const [showAddItems, setShowAddItems] = useState(false)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [itemToRemove, setItemToRemove] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const slideId = slide?.id

  const {
    data: itemsData,
    isLoading: itemsLoading,
    refetch: refetchItems,
  } = useQuery({
    queryKey: ['hero-slide-collections', slideId],
    queryFn: async () => {
      const response = (await heroSlideService.getById(slideId!)) as any
      return response?.data?.collections || []
    },
    enabled: !!slideId && open,
  })

  const { data: availableItemsData, isLoading: availableLoading } = useQuery({
    queryKey: ['available-collections-for-hero-slide', slideId, searchQuery],
    queryFn: async () => {
      const response = (await collectionService.getProductCollections({ limit: 50, search: searchQuery })) as any
      return response?.data || []
    },
    enabled: showAddItems,
  })

  const items: SlideCollection[] = itemsData || []
  const availableItems = availableItemsData || []
  const itemIds = items.map((item) => item.id)
  const filteredAvailableItems = availableItems.filter((item: any) => !itemIds.includes(item.id))
  const remainingSlots = MAX_ITEMS - items.length

  const addItemsMutation = useMutation({
    mutationFn: async (collectionIds: string[]) => {
      if (!slideId) throw new Error('No slide selected')
      return heroSlideService.addCollections(slideId, collectionIds)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hero-slide-collections'] })
      queryClient.invalidateQueries({ queryKey: ['hero-slides'] })
      setSelectedItems([])
      setShowAddItems(false)
      refetchItems()
      toast.success('Collections added to slide')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to add collections')
    },
  })

  const removeItemMutation = useMutation({
    mutationFn: async (collectionId: string) => {
      if (!slideId) throw new Error('No slide selected')
      return heroSlideService.removeCollection(slideId, collectionId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hero-slide-collections'] })
      queryClient.invalidateQueries({ queryKey: ['hero-slides'] })
      setItemToRemove(null)
      refetchItems()
      toast.success('Collection removed from slide')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to remove collection')
    },
  })

  const reorderMutation = useMutation({
    mutationFn: async (reordered: Array<{ collectionId: string; position: number }>) => {
      if (!slideId) throw new Error('No slide selected')
      return heroSlideService.reorderCollections(slideId, reordered)
    },
    onSuccess: () => {
      refetchItems()
      toast.success('Collections reordered')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to reorder collections')
    },
  })

  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    const newItems = [...items]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newItems.length) return
    ;[newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]]

    const reordered = newItems.map((item, idx) => ({ collectionId: item.id, position: idx }))
    reorderMutation.mutate(reordered)
  }

  const handleAddSelected = () => {
    if (selectedItems.length === 0) {
      toast.error('Select at least one collection to add')
      return
    }
    addItemsMutation.mutate(selectedItems)
  }

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems((prev) => {
      if (prev.includes(itemId)) return prev.filter((id) => id !== itemId)
      if (prev.length >= remainingSlots) {
        toast.error(`A collection grid slide can hold at most ${MAX_ITEMS} collections`)
        return prev
      }
      return [...prev, itemId]
    })
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className='w-full sm:max-w-2xl overflow-hidden flex flex-col'>
        <SheetHeader>
          <SheetTitle className='flex items-center gap-2'>
            <Layers className='h-5 w-5' />
            Manage Grid Collections
          </SheetTitle>
          <SheetDescription>
            {slide?.title || 'Grid slide'} — {items.length} / {MAX_ITEMS} collections
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-hidden flex flex-col mt-4'>
          <div className='flex items-center justify-between mb-4'>
            <Badge variant='outline' className='text-sm'>
              {items.length} of {MAX_ITEMS} collections
            </Badge>
            <Button onClick={() => setShowAddItems(true)} size='sm' disabled={remainingSlots <= 0}>
              <Plus className='h-4 w-4 mr-2' />
              Add Collections
            </Button>
          </div>

          <Separator />

          <ScrollArea className='flex-1 mt-4'>
            {itemsLoading ? (
              <div className='space-y-3'>
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className='h-16 w-full' />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className='text-center py-12'>
                <div className='mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4'>
                  <Layers className='h-6 w-6 text-muted-foreground' />
                </div>
                <h3 className='text-lg font-medium'>No collections in this slide</h3>
                <p className='text-muted-foreground text-sm mt-1'>
                  Add up to {MAX_ITEMS} collections to show together as tiles in this slide
                </p>
                <Button className='mt-4' onClick={() => setShowAddItems(true)}>
                  <Plus className='h-4 w-4 mr-2' />
                  Add Collections
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-16'>Image</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className='text-center'>Position</TableHead>
                    <TableHead className='w-16'></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => {
                    const image = getAbsoluteMediaUrl(item.banner_url || item.image_url)
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          {image ? (
                            <Image src={image} alt={item.name} width={40} height={40} className='rounded object-cover' />
                          ) : (
                            <div className='w-10 h-10 bg-muted rounded flex items-center justify-center'>
                              <ImageIcon className='h-4 w-4 text-muted-foreground' />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className='flex flex-col'>
                            <span className='font-medium'>{item.name}</span>
                            <span className='text-xs text-muted-foreground'>{item.slug}</span>
                          </div>
                        </TableCell>
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
                            <span className='text-sm text-muted-foreground w-6 text-center'>{index + 1}</span>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='h-7 w-7'
                              onClick={() => handleMoveItem(index, 'down')}
                              disabled={index === items.length - 1 || reorderMutation.isPending}
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
                            onClick={() => setItemToRemove(item.id)}
                          >
                            <Trash2 className='h-4 w-4' />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </div>

        <AlertDialog open={showAddItems} onOpenChange={setShowAddItems}>
          <AlertDialogContent className='max-w-2xl max-h-[80vh] flex flex-col'>
            <AlertDialogHeader>
              <AlertDialogTitle>Add Collections to Slide</AlertDialogTitle>
              <AlertDialogDescription>
                Select up to {remainingSlots} more collection{remainingSlots === 1 ? '' : 's'} for &quot;{slide?.title}&quot;
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className='flex-1 overflow-hidden flex flex-col'>
              <div className='relative mb-4'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                <input
                  type='text'
                  placeholder='Search collections...'
                  className='w-full pl-10 pr-4 py-2 border rounded-md'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

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
                      {searchQuery ? 'No collections found matching your search' : 'All collections are already in this slide'}
                    </p>
                  </div>
                ) : (
                  <div className='space-y-1'>
                    {filteredAvailableItems.map((item: any) => {
                      const image = getAbsoluteMediaUrl(item.banner_url || item.image_url)
                      return (
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
                          {image ? (
                            <Image src={image} alt={item.name} width={40} height={40} className='rounded object-cover' />
                          ) : (
                            <div className='w-10 h-10 bg-muted rounded flex items-center justify-center'>
                              <Layers className='h-4 w-4 text-muted-foreground' />
                            </div>
                          )}
                          <div className='flex-1 min-w-0'>
                            <p className='font-medium truncate'>{item.name}</p>
                            <p className='text-xs text-muted-foreground truncate'>{item.slug}</p>
                          </div>
                          {typeof item.items_count === 'number' && (
                            <span className='text-xs text-muted-foreground'>{item.items_count} items</span>
                          )}
                          {selectedItems.includes(item.id) && <CheckCircle2 className='h-5 w-5 text-primary' />}
                        </div>
                      )
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>

            <AlertDialogFooter className='mt-4'>
              <AlertDialogCancel onClick={() => setSelectedItems([])}>Cancel</AlertDialogCancel>
              <Button onClick={handleAddSelected} disabled={selectedItems.length === 0 || addItemsMutation.isPending}>
                {addItemsMutation.isPending && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
                Add {selectedItems.length} {selectedItems.length === 1 ? 'Collection' : 'Collections'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!itemToRemove} onOpenChange={() => setItemToRemove(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove from Slide</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove this collection from the slide? The collection itself will not be deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => itemToRemove && removeItemMutation.mutate(itemToRemove)}
                className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              >
                {removeItemMutation.isPending && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  )
}
