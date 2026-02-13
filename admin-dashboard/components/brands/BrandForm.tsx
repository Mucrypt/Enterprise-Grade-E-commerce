'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Loader2, Upload, X, Image as ImageIcon, Globe, Link2 } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

const brandSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters'),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100, 'Slug must be less than 100 characters')
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Slug must be lowercase with hyphens only'
    ),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  websiteUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  isActive: z.boolean().default(true),
})

type BrandFormData = z.infer<typeof brandSchema>

interface Brand {
  id: string
  name: string
  slug: string
  description?: string
  logo_url?: string
  website_url?: string
  is_active: boolean
}

interface BrandFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: BrandFormData & { logo?: File }) => Promise<void>
  brand?: Brand | null
  isLoading?: boolean
}

export function BrandForm({
  open,
  onClose,
  onSubmit,
  brand,
  isLoading,
}: BrandFormProps) {
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const form = useForm<BrandFormData>({
    resolver: zodResolver(brandSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      websiteUrl: '',
      isActive: true,
    },
  })

  // Reset form when dialog opens/closes or brand changes
  useEffect(() => {
    if (open) {
      if (brand) {
        form.reset({
          name: brand.name,
          slug: brand.slug,
          description: brand.description || '',
          websiteUrl: brand.website_url || '',
          isActive: brand.is_active,
        })
        setLogoPreview(brand.logo_url || null)
      } else {
        form.reset({
          name: '',
          slug: '',
          description: '',
          websiteUrl: '',
          isActive: true,
        })
        setLogoPreview(null)
      }
      setLogoFile(null)
    }
  }, [open, brand, form])

  // Auto-generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value
    form.setValue('name', newName)

    // Only auto-generate slug if it's empty or matches the previous auto-generated value
    const currentSlug = form.getValues('slug')
    const previousAutoSlug = generateSlug(form.getValues('name'))
    if (!currentSlug || currentSlug === previousAutoSlug) {
      form.setValue('slug', generateSlug(newName))
    }
  }

  // Handle logo upload
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processFile(file)
    }
  }

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      form.setError('root', { message: 'Logo must be less than 2MB' })
      return
    }
    setLogoFile(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setLogoPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const removeLogo = () => {
    setLogoFile(null)
    setLogoPreview(null)
  }

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      processFile(file)
    }
  }

  const handleSubmit = async (data: BrandFormData) => {
    await onSubmit({
      ...data,
      logo: logoFile || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>{brand ? 'Edit Brand' : 'Create Brand'}</DialogTitle>
          <DialogDescription>
            {brand
              ? 'Update brand information'
              : 'Add a new brand to your store'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className='space-y-6'>
            {/* Logo Upload */}
            <div className='space-y-2'>
              <FormLabel>Brand Logo</FormLabel>
              <div
                className={cn(
                  'border-2 border-dashed rounded-lg p-6 transition-colors',
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-primary/50',
                  'flex flex-col items-center justify-center gap-3'
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {logoPreview ? (
                  <div className='relative'>
                    <div className='relative h-24 w-24 rounded-lg overflow-hidden bg-muted'>
                      <Image
                        src={logoPreview}
                        alt='Logo preview'
                        fill
                        className='object-contain'
                      />
                    </div>
                    <Button
                      type='button'
                      variant='destructive'
                      size='icon'
                      className='absolute -top-2 -right-2 h-6 w-6'
                      onClick={removeLogo}
                    >
                      <X className='h-3 w-3' />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className='rounded-full bg-muted p-3'>
                      <ImageIcon className='h-6 w-6 text-muted-foreground' />
                    </div>
                    <div className='text-center'>
                      <p className='text-sm font-medium'>
                        Drag and drop or click to upload
                      </p>
                      <p className='text-xs text-muted-foreground'>
                        PNG, JPG, WEBP up to 2MB
                      </p>
                    </div>
                  </>
                )}
                <input
                  type='file'
                  accept='image/*'
                  onChange={handleLogoChange}
                  className={cn(
                    'absolute inset-0 opacity-0 cursor-pointer',
                    logoPreview && 'pointer-events-none'
                  )}
                />
              </div>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              {/* Name */}
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        onChange={handleNameChange}
                        placeholder='Brand name'
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Slug */}
              <FormField
                control={form.control}
                name='slug'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder='brand-slug' />
                    </FormControl>
                    <FormDescription>URL-friendly identifier</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Description */}
            <FormField
              control={form.control}
              name='description'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder='Brief description of the brand...'
                      rows={3}
                    />
                  </FormControl>
                  <FormDescription>
                    {field.value?.length || 0}/500 characters
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Website URL */}
            <FormField
              control={form.control}
              name='websiteUrl'
              render={({ field }) => (
                <FormItem>
                  <FormLabel className='flex items-center gap-2'>
                    <Globe className='h-4 w-4' />
                    Website URL
                  </FormLabel>
                  <FormControl>
                    <div className='relative'>
                      <Link2 className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                      <Input
                        {...field}
                        placeholder='https://www.brandwebsite.com'
                        className='pl-10'
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Active Status */}
            <FormField
              control={form.control}
              name='isActive'
              render={({ field }) => (
                <FormItem className='flex items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>Active Status</FormLabel>
                    <FormDescription>
                      Make this brand available for selection
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type='button' variant='outline' onClick={onClose}>
                Cancel
              </Button>
              <Button type='submit' disabled={isLoading}>
                {isLoading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                {brand ? 'Update Brand' : 'Create Brand'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
