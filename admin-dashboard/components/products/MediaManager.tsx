'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  Upload,
  X,
  Image as ImageIcon,
  Video,
  GripVertical,
  Star,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn, getAbsoluteMediaUrl } from '@/lib/utils'

export interface MediaFile {
  id: string
  file?: File
  url?: string
  thumbnailUrl?: string
  type: 'image' | 'video'
  isPrimary?: boolean
  position: number
  uploading?: boolean
  progress?: number
  error?: string
}

interface MediaManagerProps {
  images: MediaFile[]
  videos: MediaFile[]
  onImagesChange: (images: MediaFile[]) => void
  onVideosChange: (videos: MediaFile[]) => void
  onImageRemove?: (id: string) => void
  maxImages?: number
  maxVideos?: number
  maxImageSize?: number // in bytes
  maxVideoSize?: number // in bytes
  disabled?: boolean
}

export function MediaManager({
  images,
  videos,
  onImagesChange,
  onVideosChange,
  onImageRemove,
  maxImages = 10,
  maxVideos = 3,
  maxImageSize = 5 * 1024 * 1024, // 5MB
  maxVideoSize = 50 * 1024 * 1024, // 50MB
  disabled = false,
}: MediaManagerProps) {
  const [draggedItem, setDraggedItem] = useState<string | null>(null)

  // Generate unique ID for new files
  const generateId = () =>
    `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  // Handle image drop
  const onImageDrop = useCallback(
    (acceptedFiles: File[]) => {
      const remainingSlots = maxImages - images.length
      const filesToAdd = acceptedFiles.slice(0, remainingSlots)

      const newImages: MediaFile[] = filesToAdd.map((file, index) => {
        // Validate file size
        if (file.size > maxImageSize) {
          return {
            id: generateId(),
            file,
            type: 'image' as const,
            position: images.length + index,
            error: `File too large (max ${formatBytes(maxImageSize)})`,
          }
        }

        return {
          id: generateId(),
          file,
          url: URL.createObjectURL(file),
          type: 'image' as const,
          isPrimary: images.length === 0 && index === 0,
          position: images.length + index,
        }
      })

      onImagesChange([...images, ...newImages])
    },
    [images, maxImages, maxImageSize, onImagesChange],
  )

  // Handle video drop
  const onVideoDrop = useCallback(
    (acceptedFiles: File[]) => {
      const remainingSlots = maxVideos - videos.length
      const filesToAdd = acceptedFiles.slice(0, remainingSlots)

      const newVideos: MediaFile[] = filesToAdd.map((file, index) => {
        if (file.size > maxVideoSize) {
          return {
            id: generateId(),
            file,
            type: 'video' as const,
            position: videos.length + index,
            error: `File too large (max ${formatBytes(maxVideoSize)})`,
          }
        }

        return {
          id: generateId(),
          file,
          url: URL.createObjectURL(file),
          type: 'video' as const,
          position: videos.length + index,
        }
      })

      onVideosChange([...videos, ...newVideos])
    },
    [videos, maxVideos, maxVideoSize, onVideosChange],
  )

  const {
    getRootProps: getImageRootProps,
    getInputProps: getImageInputProps,
    isDragActive: isImageDragActive,
  } = useDropzone({
    onDrop: onImageDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/gif': ['.gif'],
    },
    disabled: disabled || images.length >= maxImages,
    multiple: true,
  })

  const {
    getRootProps: getVideoRootProps,
    getInputProps: getVideoInputProps,
    isDragActive: isVideoDragActive,
  } = useDropzone({
    onDrop: onVideoDrop,
    accept: {
      'video/mp4': ['.mp4'],
      'video/webm': ['.webm'],
      'video/quicktime': ['.mov'],
    },
    disabled: disabled || videos.length >= maxVideos,
    multiple: true,
  })

  // Remove image
  const removeImage = (id: string) => {
    // Track removal for server deletion
    if (onImageRemove) {
      onImageRemove(id)
    }
    const updated = images.filter((img) => img.id !== id)
    // Reassign positions
    const repositioned = updated.map((img, index) => ({
      ...img,
      position: index,
      isPrimary: index === 0 ? true : img.isPrimary,
    }))
    // Ensure first image is primary if no primary exists
    if (repositioned.length > 0 && !repositioned.some((img) => img.isPrimary)) {
      repositioned[0].isPrimary = true
    }
    onImagesChange(repositioned)
  }

  // Remove video
  const removeVideo = (id: string) => {
    const updated = videos.filter((vid) => vid.id !== id)
    const repositioned = updated.map((vid, index) => ({
      ...vid,
      position: index,
    }))
    onVideosChange(repositioned)
  }

  // Set primary image
  const setPrimaryImage = (id: string) => {
    const updated = images.map((img) => ({
      ...img,
      isPrimary: img.id === id,
    }))
    onImagesChange(updated)
  }

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedItem(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  // Handle drag over
  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggedItem || draggedItem === targetId) return

    const draggedIndex = images.findIndex((img) => img.id === draggedItem)
    const targetIndex = images.findIndex((img) => img.id === targetId)

    if (draggedIndex === -1 || targetIndex === -1) return

    // Reorder images
    const newImages = [...images]
    const [draggedImage] = newImages.splice(draggedIndex, 1)
    newImages.splice(targetIndex, 0, draggedImage)

    // Update positions
    const repositioned = newImages.map((img, index) => ({
      ...img,
      position: index,
    }))

    onImagesChange(repositioned)
  }

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedItem(null)
  }

  return (
    <div className='space-y-6'>
      {/* Images Section */}
      <div className='space-y-4'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <ImageIcon className='h-5 w-5 text-muted-foreground' />
            <h4 className='font-medium'>Product Images</h4>
            <Badge variant='outline'>
              {images.length}/{maxImages}
            </Badge>
          </div>
          {images.length > 0 && (
            <p className='text-xs text-muted-foreground'>
              Drag to reorder • Click star to set primary
            </p>
          )}
        </div>

        {/* Image Preview Grid */}
        {images.length > 0 && (
          <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4'>
            {images.map((image) => (
              <div
                key={image.id}
                draggable={!disabled && !image.uploading}
                onDragStart={(e) => handleDragStart(e, image.id)}
                onDragOver={(e) => handleDragOver(e, image.id)}
                onDragEnd={handleDragEnd}
                className={cn(
                  'relative group aspect-square rounded-xl overflow-hidden border-2 shadow-sm transition-all',
                  image.isPrimary
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-border hover:border-primary/50 hover:shadow-md',
                  draggedItem === image.id && 'opacity-50',
                  image.error && 'border-destructive',
                )}
              >
                {/* Image Preview */}
                {image.url ? (
                  <img
                    src={
                      image.url.startsWith('blob:')
                        ? image.url
                        : getAbsoluteMediaUrl(image.url) || image.url
                    }
                    alt='Product preview'
                    className='w-full h-full object-cover'
                  />
                ) : (
                  <div className='w-full h-full bg-muted flex items-center justify-center'>
                    <ImageIcon className='h-8 w-8 text-muted-foreground' />
                  </div>
                )}

                {/* Uploading Overlay */}
                {image.uploading && (
                  <div className='absolute inset-0 bg-background/80 flex flex-col items-center justify-center'>
                    <Loader2 className='h-6 w-6 animate-spin mb-2' />
                    <Progress value={image.progress} className='w-3/4 h-1' />
                  </div>
                )}

                {/* Error Overlay */}
                {image.error && (
                  <div className='absolute inset-0 bg-destructive/80 flex flex-col items-center justify-center p-2'>
                    <AlertCircle className='h-6 w-6 text-destructive-foreground mb-1' />
                    <p className='text-xs text-destructive-foreground text-center'>
                      {image.error}
                    </p>
                  </div>
                )}

                {/* Primary Badge */}
                {image.isPrimary && !image.error && (
                  <Badge className='absolute top-2 left-2 bg-primary text-primary-foreground'>
                    Primary
                  </Badge>
                )}

                {/* Action Buttons */}
                {!image.uploading && !image.error && (
                  <div className='absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2'>
                    {/* Drag Handle */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className='p-2 bg-white/20 rounded-lg cursor-grab'>
                          <GripVertical className='h-4 w-4 text-white' />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>Drag to reorder</TooltipContent>
                    </Tooltip>

                    {/* Set Primary */}
                    {!image.isPrimary && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type='button'
                            onClick={() => setPrimaryImage(image.id)}
                            className='p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors'
                          >
                            <Star className='h-4 w-4 text-white' />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Set as primary</TooltipContent>
                      </Tooltip>
                    )}

                    {/* Remove */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type='button'
                          onClick={() => removeImage(image.id)}
                          className='p-2 bg-red-500/80 rounded-lg hover:bg-red-500 transition-colors'
                        >
                          <X className='h-4 w-4 text-white' />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Remove image</TooltipContent>
                    </Tooltip>
                  </div>
                )}

                {/* Error Remove Button */}
                {image.error && (
                  <button
                    type='button'
                    onClick={() => removeImage(image.id)}
                    className='absolute top-2 right-2 p-1 bg-white rounded-full'
                  >
                    <X className='h-3 w-3 text-destructive' />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Image Dropzone */}
        {images.length < maxImages && (
          <div
            {...getImageRootProps()}
            className={cn(
              'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
              isImageDragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/40',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            <input {...getImageInputProps()} />
            <div className='mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary'>
              <Upload className='h-5 w-5' />
            </div>
            <p className='text-sm font-medium mb-1'>
              {isImageDragActive
                ? 'Drop images here...'
                : 'Drag & drop images here, or click to select'}
            </p>
            <p className='text-xs text-muted-foreground'>
              JPEG, PNG, WebP, GIF • Max {formatBytes(maxImageSize)} each
            </p>
          </div>
        )}
      </div>

      {/* Videos Section */}
      <div className='space-y-4'>
        <div className='flex items-center gap-2'>
          <Video className='h-5 w-5 text-muted-foreground' />
          <h4 className='font-medium'>Product Videos</h4>
          <Badge variant='outline'>
            {videos.length}/{maxVideos}
          </Badge>
        </div>

        {/* Video List */}
        {videos.length > 0 && (
          <div className='space-y-2'>
            {videos.map((video) => (
              <div
                key={video.id}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg border transition-colors',
                  video.error
                    ? 'border-destructive bg-destructive/5'
                    : 'border-border bg-muted/50 hover:bg-muted',
                )}
              >
                <div className='flex items-center gap-3 flex-1 min-w-0'>
                  <div className='w-12 h-12 rounded bg-muted flex items-center justify-center shrink-0'>
                    {video.url && !video.error ? (
                      <video
                        src={
                          video.url.startsWith('blob:')
                            ? video.url
                            : getAbsoluteMediaUrl(video.url) || video.url
                        }
                        className='w-full h-full object-cover rounded'
                      />
                    ) : (
                      <Video className='h-5 w-5 text-muted-foreground' />
                    )}
                  </div>
                  <div className='flex-1 min-w-0'>
                    <p className='text-sm font-medium truncate'>
                      {video.file?.name || 'Video'}
                    </p>
                    {video.error ? (
                      <p className='text-xs text-destructive'>{video.error}</p>
                    ) : video.file ? (
                      <p className='text-xs text-muted-foreground'>
                        {formatBytes(video.file.size)}
                      </p>
                    ) : null}
                  </div>
                </div>

                {video.uploading ? (
                  <div className='flex items-center gap-2'>
                    <Progress value={video.progress} className='w-20 h-1' />
                    <Loader2 className='h-4 w-4 animate-spin' />
                  </div>
                ) : (
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    onClick={() => removeVideo(video.id)}
                    className='text-muted-foreground hover:text-destructive'
                  >
                    <X className='h-4 w-4' />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Video Dropzone */}
        {videos.length < maxVideos && (
          <div
            {...getVideoRootProps()}
            className={cn(
              'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
              isVideoDragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            <input {...getVideoInputProps()} />
            <Upload className='h-8 w-8 mx-auto text-muted-foreground mb-3' />
            <p className='text-sm text-muted-foreground mb-1'>
              {isVideoDragActive
                ? 'Drop videos here...'
                : 'Drag & drop videos here, or click to select'}
            </p>
            <p className='text-xs text-muted-foreground'>
              MP4, WebM, MOV • Max {formatBytes(maxVideoSize)} each
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}
