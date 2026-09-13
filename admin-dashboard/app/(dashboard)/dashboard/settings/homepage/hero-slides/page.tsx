'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Plus,
  Pencil,
  Trash2,
  Image as ImageIcon,
  Loader2,
  Layers,
} from 'lucide-react'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import { heroSlideService, HeroSlide, HeroSlideFormData } from '@/services/hero-slide.service'
import { HeroSlideForm } from '@/components/hero-slides/HeroSlideForm'
import { HeroSlideItemsManager } from '@/components/hero-slides/HeroSlideItemsManager'

const SLIDE_TYPE_LABELS: Record<string, string> = {
  custom: 'Custom Banner',
  product: 'Product',
  category: 'Category',
  product_collection: 'Product Collection',
  category_collection: 'Category Collection',
  product_grid: 'Product Grid',
}

export default function HeroSlidesPage() {
  return (
    <RequirePagePermission permission='homepage.view'>
      <HeroSlidesContent />
    </RequirePagePermission>
  )
}

function HeroSlidesContent() {
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editingSlide, setEditingSlide] = useState<HeroSlide | null>(null)
  const [itemsSlide, setItemsSlide] = useState<HeroSlide | null>(null)
  const [slideToDelete, setSlideToDelete] = useState<HeroSlide | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['hero-slides'],
    queryFn: () => heroSlideService.getAll(),
  })
  const slides: HeroSlide[] = (data as any)?.data || []

  const createMutation = useMutation({
    mutationFn: ({ formData, file }: { formData: HeroSlideFormData; file?: File }) =>
      file ? heroSlideService.createWithMedia(formData, file) : heroSlideService.create(formData),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['hero-slides'] })
      toast.success('Hero slide created')
      setFormOpen(false)
      if (result?.data?.slide_type === 'product_grid') {
        setItemsSlide(result.data)
      }
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to create hero slide'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, formData, file }: { id: string; formData: Partial<HeroSlideFormData>; file?: File }) =>
      file ? heroSlideService.updateWithMedia(id, formData, file) : heroSlideService.update(id, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hero-slides'] })
      toast.success('Hero slide updated')
      setFormOpen(false)
      setEditingSlide(null)
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to update hero slide'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => heroSlideService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hero-slides'] })
      toast.success('Hero slide deleted')
      setSlideToDelete(null)
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to delete hero slide'),
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      heroSlideService.update(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hero-slides'] })
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to update slide'),
  })

  const reorderMutation = useMutation({
    mutationFn: (order: Array<{ id: string; position: number }>) => heroSlideService.reorder(order),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hero-slides'] })
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to reorder slides'),
  })

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newSlides = [...slides]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newSlides.length) return
    ;[newSlides[index], newSlides[targetIndex]] = [newSlides[targetIndex], newSlides[index]]
    reorderMutation.mutate(newSlides.map((s, idx) => ({ id: s.id, position: idx })))
  }

  const handleSubmit = async (formData: HeroSlideFormData, file?: File) => {
    if (editingSlide) {
      await updateMutation.mutateAsync({ id: editingSlide.id, formData, file })
    } else {
      await createMutation.mutateAsync({ formData, file })
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-3'>
        <Button variant='ghost' size='icon' asChild>
          <Link href='/dashboard/settings/homepage'>
            <ArrowLeft className='h-4 w-4' />
          </Link>
        </Button>
        <div className='flex-1'>
          <h1 className='text-2xl font-bold tracking-tight'>Hero Slides</h1>
          <p className='text-sm text-muted-foreground'>
            Manage the homepage hero carousel shown on web and mobile -- pick
            products, categories, collections, or build a multi-product grid
            slide. Changes go live immediately.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingSlide(null)
            setFormOpen(true)
          }}
        >
          <Plus className='mr-2 h-4 w-4' />
          Add Slide
        </Button>
      </div>

      {isLoading ? (
        <div className='space-y-3'>
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className='h-16 w-full' />
          ))}
        </div>
      ) : slides.length === 0 ? (
        <div className='text-center py-16 border border-dashed rounded-lg'>
          <div className='mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4'>
            <Layers className='h-6 w-6 text-muted-foreground' />
          </div>
          <h3 className='text-lg font-medium'>No hero slides yet</h3>
          <p className='text-muted-foreground text-sm mt-1'>
            Add your first slide to start managing the homepage hero carousel.
          </p>
          <Button
            className='mt-4'
            onClick={() => {
              setEditingSlide(null)
              setFormOpen(true)
            }}
          >
            <Plus className='mr-2 h-4 w-4' />
            Add Slide
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-16'>Image</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead className='text-center'>Order</TableHead>
              <TableHead className='text-center'>Active</TableHead>
              <TableHead className='w-28'></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slides.map((slide, index) => (
              <TableRow key={slide.id}>
                <TableCell>
                  {slide.image_url ? (
                    <Image src={slide.image_url} alt={slide.title || ''} width={40} height={40} className='rounded object-cover' />
                  ) : (
                    <div className='w-10 h-10 bg-muted rounded flex items-center justify-center'>
                      <ImageIcon className='h-4 w-4 text-muted-foreground' />
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <span className='font-medium'>{slide.title || <span className='text-muted-foreground'>Untitled</span>}</span>
                </TableCell>
                <TableCell>
                  <div className='flex items-center gap-2'>
                    <Badge variant='outline'>{SLIDE_TYPE_LABELS[slide.slide_type] || slide.slide_type}</Badge>
                    {slide.slide_type === 'product_grid' && (
                      <Button variant='link' size='sm' className='h-auto p-0' onClick={() => setItemsSlide(slide)}>
                        Manage products
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant='secondary' className='capitalize'>{slide.platform}</Badge>
                </TableCell>
                <TableCell className='text-center'>
                  <div className='flex items-center justify-center gap-1'>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-7 w-7'
                      onClick={() => handleMove(index, 'up')}
                      disabled={index === 0 || reorderMutation.isPending}
                    >
                      <ArrowUp className='h-3 w-3' />
                    </Button>
                    <span className='text-sm text-muted-foreground w-6 text-center'>{index + 1}</span>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-7 w-7'
                      onClick={() => handleMove(index, 'down')}
                      disabled={index === slides.length - 1 || reorderMutation.isPending}
                    >
                      <ArrowDown className='h-3 w-3' />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className='text-center'>
                  <Switch
                    checked={slide.is_active}
                    onCheckedChange={(checked: boolean) =>
                      toggleActiveMutation.mutate({ id: slide.id, isActive: checked })
                    }
                  />
                </TableCell>
                <TableCell>
                  <div className='flex items-center gap-1'>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-8 w-8'
                      onClick={() => {
                        setEditingSlide(slide)
                        setFormOpen(true)
                      }}
                    >
                      <Pencil className='h-4 w-4' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-8 w-8 text-destructive hover:text-destructive'
                      onClick={() => setSlideToDelete(slide)}
                    >
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <HeroSlideForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditingSlide(null)
        }}
        onSubmit={handleSubmit}
        slide={editingSlide}
        isLoading={isSaving}
      />

      <HeroSlideItemsManager
        open={!!itemsSlide}
        onClose={() => setItemsSlide(null)}
        slide={itemsSlide}
      />

      <AlertDialog open={!!slideToDelete} onOpenChange={() => setSlideToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Hero Slide</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this slide? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => slideToDelete && deleteMutation.mutate(slideToDelete.id)}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {deleteMutation.isPending && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
