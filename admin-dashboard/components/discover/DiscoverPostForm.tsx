'use client'

import React, { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { X, Video, Image as ImageIcon, Loader2 } from 'lucide-react'
import { categoryService } from '@/services/category.service'
import { getAbsoluteMediaUrl } from '@/lib/utils'
import type {
  DiscoverPost,
  DiscoverPostFormData,
  DiscoverPostFiles,
  DiscoverMediaType,
} from '@/services/discover.service'

interface FilePreview {
  file: File
  preview: string
}

export interface DiscoverPostFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: DiscoverPostFormData, files: DiscoverPostFiles) => Promise<void>
  post?: DiscoverPost | null
  isLoading?: boolean
}

const emptyForm: DiscoverPostFormData = {
  mediaType: 'video',
  caption: '',
  categoryId: '',
  isActive: true,
  videoUrl: '',
  videoPosterUrl: '',
}

export function DiscoverPostForm({ open, onClose, onSubmit, post, isLoading = false }: DiscoverPostFormProps) {
  const [formData, setFormData] = useState<DiscoverPostFormData>(emptyForm)
  const [videoPreview, setVideoPreview] = useState<FilePreview | null>(null)
  const [posterPreview, setPosterPreview] = useState<FilePreview | null>(null)
  const [imagePreviews, setImagePreviews] = useState<FilePreview[]>([])
  const isEditing = !!post

  const { data: categoriesData } = useQuery({
    queryKey: ['discover', 'categories'],
    queryFn: () => categoryService.getCategories(),
    enabled: open,
  })
  const categories = categoriesData?.data?.categories || []

  const videoDropzone = useDropzone({
    accept: { 'video/mp4': ['.mp4'], 'video/quicktime': ['.mov'] },
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024,
    onDrop: (accepted) => {
      if (accepted.length > 0) {
        const file = accepted[0]
        setVideoPreview({ file, preview: URL.createObjectURL(file) })
      }
    },
  })

  const posterDropzone = useDropzone({
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
    onDrop: (accepted) => {
      if (accepted.length > 0) {
        const file = accepted[0]
        setPosterPreview({ file, preview: URL.createObjectURL(file) })
      }
    },
  })

  const imagesDropzone = useDropzone({
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    maxFiles: 10,
    maxSize: 5 * 1024 * 1024,
    onDrop: (accepted) => {
      setImagePreviews((prev) => [
        ...prev,
        ...accepted.map((file) => ({ file, preview: URL.createObjectURL(file) })),
      ].slice(0, 10))
    },
  })

  useEffect(() => {
    if (post) {
      setFormData({
        mediaType: post.media_type,
        caption: post.caption || '',
        categoryId: post.category_id || '',
        isActive: post.is_active,
        videoUrl: post.video_url || '',
        videoPosterUrl: post.video_poster_url || '',
      })
    } else {
      setFormData(emptyForm)
    }
    setVideoPreview(null)
    setPosterPreview(null)
    setImagePreviews([])
  }, [post, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(formData, {
      video: videoPreview?.file,
      poster: posterPreview?.file,
      images: imagePreviews.length > 0 ? imagePreviews.map((p) => p.file) : undefined,
    })
  }

  const isVideo = formData.mediaType === 'video'

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit' : 'Create'} Discover Post</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update this Discover feed post.'
              : 'Add a new post to the Discover feed. Tag products after creating it.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-5'>
          <div className='space-y-2'>
            <Label>Media Type</Label>
            <RadioGroup
              value={formData.mediaType}
              onValueChange={(v: DiscoverMediaType) => setFormData((prev) => ({ ...prev, mediaType: v }))}
              className='flex gap-4'
              disabled={isEditing}
            >
              <div className='flex items-center gap-2'>
                <RadioGroupItem value='video' id='media-video' />
                <Label htmlFor='media-video' className='font-normal'>Video</Label>
              </div>
              <div className='flex items-center gap-2'>
                <RadioGroupItem value='image' id='media-image' />
                <Label htmlFor='media-image' className='font-normal'>Image Carousel</Label>
              </div>
            </RadioGroup>
          </div>

          {isVideo ? (
            <>
              <div className='space-y-2'>
                <Label>Video {isEditing ? '(optional -- keeps existing if not replaced)' : ''}</Label>
                <div
                  {...videoDropzone.getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                    videoDropzone.isDragActive
                      ? 'border-primary bg-primary/5'
                      : 'border-muted-foreground/25 hover:border-primary/50'
                  }`}
                >
                  <input {...videoDropzone.getInputProps()} />
                  {videoPreview ? (
                    <div className='relative inline-block'>
                      <video src={videoPreview.preview} className='mx-auto max-h-40 rounded' controls />
                      <Button
                        type='button'
                        variant='destructive'
                        size='icon'
                        className='absolute top-0 right-0 h-6 w-6'
                        onClick={(e) => {
                          e.stopPropagation()
                          setVideoPreview(null)
                        }}
                      >
                        <X className='h-3 w-3' />
                      </Button>
                    </div>
                  ) : formData.videoUrl ? (
                    <p className='text-xs text-muted-foreground py-4'>
                      A video is already attached. Drop a new one to replace it.
                    </p>
                  ) : (
                    <div className='py-4'>
                      <Video className='mx-auto h-8 w-8 text-muted-foreground mb-2' />
                      <p className='text-xs text-muted-foreground'>
                        Drop a pre-compressed MP4 (max 100MB) or click to upload
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className='space-y-2'>
                <Label>Poster Image {isEditing ? '(optional -- keeps existing if not replaced)' : ''}</Label>
                <p className='text-xs text-muted-foreground'>
                  Shown before the video plays and while it loads -- no automatic thumbnail is generated.
                </p>
                <div
                  {...posterDropzone.getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                    posterDropzone.isDragActive
                      ? 'border-primary bg-primary/5'
                      : 'border-muted-foreground/25 hover:border-primary/50'
                  }`}
                >
                  <input {...posterDropzone.getInputProps()} />
                  {posterPreview ? (
                    <div className='relative inline-block'>
                      <Image src={posterPreview.preview} alt='Poster preview' width={200} height={112} className='mx-auto rounded object-cover' />
                      <Button
                        type='button'
                        variant='destructive'
                        size='icon'
                        className='absolute top-0 right-0 h-6 w-6'
                        onClick={(e) => {
                          e.stopPropagation()
                          setPosterPreview(null)
                        }}
                      >
                        <X className='h-3 w-3' />
                      </Button>
                    </div>
                  ) : formData.videoPosterUrl ? (
                    <div className='relative inline-block'>
                      <Image
                        src={getAbsoluteMediaUrl(formData.videoPosterUrl) || formData.videoPosterUrl}
                        alt='Existing poster'
                        width={200}
                        height={112}
                        className='mx-auto rounded object-cover'
                      />
                      <p className='text-xs text-muted-foreground mt-2'>Drop new image to replace</p>
                    </div>
                  ) : (
                    <div className='py-4'>
                      <ImageIcon className='mx-auto h-8 w-8 text-muted-foreground mb-2' />
                      <p className='text-xs text-muted-foreground'>Drop poster image or click to upload</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className='space-y-2'>
              <Label>Images {isEditing ? '(adding more appends to the existing carousel)' : '(up to 10, in order)'}</Label>
              <div
                {...imagesDropzone.getRootProps()}
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                  imagesDropzone.isDragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-primary/50'
                }`}
              >
                <input {...imagesDropzone.getInputProps()} />
                {imagePreviews.length > 0 ? (
                  <div className='flex flex-wrap gap-2 justify-center'>
                    {imagePreviews.map((p, idx) => (
                      <div key={idx} className='relative'>
                        <Image src={p.preview} alt={`Image ${idx + 1}`} width={80} height={80} className='rounded object-cover' />
                        <Button
                          type='button'
                          variant='destructive'
                          size='icon'
                          className='absolute -top-2 -right-2 h-5 w-5'
                          onClick={(e) => {
                            e.stopPropagation()
                            setImagePreviews((prev) => prev.filter((_, i) => i !== idx))
                          }}
                        >
                          <X className='h-3 w-3' />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className='py-4'>
                    <ImageIcon className='mx-auto h-8 w-8 text-muted-foreground mb-2' />
                    <p className='text-xs text-muted-foreground'>Drop images or click to upload</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className='space-y-2'>
            <Label>Caption</Label>
            <Textarea
              rows={2}
              value={formData.caption}
              onChange={(e) => setFormData((prev) => ({ ...prev, caption: e.target.value }))}
              placeholder='30-second demo: impact driver vs standard drill'
            />
          </div>

          <div className='space-y-2'>
            <Label>Category tag (optional)</Label>
            <Select
              value={formData.categoryId || undefined}
              onValueChange={(v: string) => setFormData((prev) => ({ ...prev, categoryId: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder='No category tag' />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='flex items-center gap-2'>
            <Switch
              id='isActive'
              checked={formData.isActive}
              onCheckedChange={(checked: boolean) => setFormData((prev) => ({ ...prev, isActive: checked }))}
            />
            <Label htmlFor='isActive'>Active</Label>
          </div>

          <div className='flex justify-end gap-3 pt-4 border-t'>
            <Button type='button' variant='outline' onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type='submit' disabled={isLoading}>
              {isLoading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              {isEditing ? 'Update' : 'Create'} Post
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
