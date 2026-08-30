'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  UploadCloud,
  X,
  CheckCircle2,
  XCircle,
  Loader2,
  ImageIcon,
} from 'lucide-react'
import { categoryService } from '@/services/category.service'
import type { Category } from '@/types'

type MediaPurpose = 'icon' | 'banner' | 'thumbnail'

type MatchConfidence = 'exact' | 'fuzzy' | 'none'

type RowStatus = 'pending' | 'uploading' | 'success' | 'error'

interface BulkRow {
  id: string
  file: File
  preview: string
  categoryId: string | null
  confidence: MatchConfidence
  status: RowStatus
  errorMessage?: string
}

const PURPOSE_OPTIONS: { value: MediaPurpose; label: string; hint: string }[] = [
  {
    value: 'icon',
    label: 'Icon',
    hint: 'Small round icon shown in the mega menu and category tiles',
  },
  {
    value: 'banner',
    label: 'Banner',
    hint: 'Wide hero image for category pages',
  },
  {
    value: 'thumbnail',
    label: 'Thumbnail',
    hint: 'Card/tile image shown in category grids',
  },
]

// Concurrent uploads at once -- fast enough to move through 70+ files in a
// couple of minutes, gentle enough not to hammer the API/image processor
// with dozens of simultaneous sharp resize jobs.
const UPLOAD_CONCURRENCY = 3

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '') // strip a file extension if present
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function matchCategory(
  filename: string,
  categories: Category[],
): { categoryId: string | null; confidence: MatchConfidence } {
  const norm = normalize(filename)
  if (!norm) return { categoryId: null, confidence: 'none' }

  const exactSlug = categories.find((c) => normalize(c.slug) === norm)
  if (exactSlug) return { categoryId: exactSlug.id, confidence: 'exact' }

  const exactName = categories.find((c) => normalize(c.name) === norm)
  if (exactName) return { categoryId: exactName.id, confidence: 'exact' }

  const fuzzy = categories.find((c) => {
    const slugNorm = normalize(c.slug)
    return slugNorm.length > 2 && (norm.includes(slugNorm) || slugNorm.includes(norm))
  })
  if (fuzzy) return { categoryId: fuzzy.id, confidence: 'fuzzy' }

  return { categoryId: null, confidence: 'none' }
}

function categoryLabel(category: Category): string {
  return category.parent_name ? `${category.parent_name} › ${category.name}` : category.name
}

export default function BulkCategoryMediaPage() {
  const [purpose, setPurpose] = useState<MediaPurpose>('icon')
  const [rows, setRows] = useState<BulkRow[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories-bulk-media-picker'],
    queryFn: () => categoryService.getAllCategories({ limit: 500 }),
  })

  const categories = useMemo(
    () => categoriesData?.data?.categories || [],
    [categoriesData],
  )

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b))),
    [categories],
  )

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (categories.length === 0) {
        toast.error('Categories are still loading -- try dropping files again in a moment.')
        return
      }

      const newRows: BulkRow[] = acceptedFiles.map((file) => {
        const { categoryId, confidence } = matchCategory(file.name, categories)
        return {
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          preview: URL.createObjectURL(file),
          categoryId,
          confidence,
          status: 'pending',
        }
      })

      setRows((prev) => [...prev, ...newRows])

      const matched = newRows.filter((r) => r.categoryId).length
      toast.success(
        `Added ${newRows.length} file${newRows.length === 1 ? '' : 's'} -- ${matched} auto-matched to a category.`,
      )
    },
    [categories],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.gif'] },
    maxSize: 5 * 1024 * 1024,
    multiple: true,
    onDrop,
  })

  const removeRow = (id: string) => {
    setRows((prev) => {
      const target = prev.find((r) => r.id === id)
      if (target) URL.revokeObjectURL(target.preview)
      return prev.filter((r) => r.id !== id)
    })
  }

  const setRowCategory = (id: string, categoryId: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, categoryId, confidence: 'exact' } : r)),
    )
  }

  const clearAll = () => {
    rows.forEach((r) => URL.revokeObjectURL(r.preview))
    setRows([])
  }

  const readyCount = rows.filter((r) => r.categoryId && r.status !== 'success').length
  const unmatchedCount = rows.filter((r) => !r.categoryId).length

  const runUploads = async () => {
    const queue = rows.filter((r) => r.categoryId && r.status !== 'success')
    if (queue.length === 0) return

    setIsUploading(true)

    let cursor = 0
    let succeeded = 0
    let failed = 0

    async function worker() {
      while (cursor < queue.length) {
        const row = queue[cursor]
        cursor += 1

        setRows((prev) =>
          prev.map((r) => (r.id === row.id ? { ...r, status: 'uploading' } : r)),
        )

        try {
          await categoryService.updateCategoryWithMedia(row.categoryId as string, {}, {
            [purpose]: row.file,
          })
          succeeded += 1
          setRows((prev) =>
            prev.map((r) => (r.id === row.id ? { ...r, status: 'success' } : r)),
          )
        } catch (error: unknown) {
          failed += 1
          const message =
            (error as { response?: { data?: { error?: string; message?: string } } })
              ?.response?.data?.error ||
            (error as { response?: { data?: { error?: string; message?: string } } })
              ?.response?.data?.message ||
            'Upload failed'
          setRows((prev) =>
            prev.map((r) =>
              r.id === row.id ? { ...r, status: 'error', errorMessage: message } : r,
            ),
          )
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(UPLOAD_CONCURRENCY, queue.length) }, () => worker()),
    )

    setIsUploading(false)
    toast[failed > 0 ? 'error' : 'success'](
      `Bulk upload finished: ${succeeded} succeeded${failed > 0 ? `, ${failed} failed` : ''}.`,
    )
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-3'>
        <Button variant='ghost' size='icon' asChild>
          <Link href='/categories'>
            <ArrowLeft className='h-4 w-4' />
          </Link>
        </Button>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Bulk Category Media Upload</h1>
          <p className='text-sm text-muted-foreground'>
            Drop many icon/banner/thumbnail files at once -- each one is auto-matched to a
            category by filename (e.g. <code>power-tools.png</code> matches &ldquo;Power Tools&rdquo;),
            and you can correct any mismatch before uploading.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. What are you uploading?</CardTitle>
          <CardDescription>
            Every file in this batch is uploaded as the same media purpose.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex flex-wrap gap-2'>
            {PURPOSE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type='button'
                onClick={() => setPurpose(option.value)}
                className={`rounded-lg border px-4 py-2 text-left text-sm transition-colors ${
                  purpose === option.value
                    ? 'border-primary bg-primary/5 font-semibold text-primary'
                    : 'border-border hover:bg-muted'
                }`}
              >
                <div>{option.label}</div>
                <div className='text-xs font-normal text-muted-foreground'>{option.hint}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Drop your files</CardTitle>
          <CardDescription>
            Name each file after its category (matching the category name or slug) for the
            best auto-match, e.g. <code>hand-tools.jpg</code> or <code>Woodworking Tools.png</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
              isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
            }`}
          >
            <input {...getInputProps()} />
            <UploadCloud className='h-8 w-8 text-muted-foreground' />
            <p className='text-sm font-medium'>
              {isDragActive ? 'Drop the files here' : 'Drag & drop images, or click to browse'}
            </p>
            <p className='text-xs text-muted-foreground'>
              You can drop as many files as you like -- JPG, PNG, WebP, GIF, up to 5MB each
            </p>
          </div>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0'>
            <div>
              <CardTitle>3. Review matches ({rows.length})</CardTitle>
              <CardDescription>
                {unmatchedCount > 0
                  ? `${unmatchedCount} file${unmatchedCount === 1 ? '' : 's'} need a category picked manually before upload.`
                  : 'Every file has a category -- ready to upload.'}
              </CardDescription>
            </div>
            <div className='flex gap-2'>
              <Button variant='outline' size='sm' onClick={clearAll} disabled={isUploading}>
                Clear all
              </Button>
              <Button
                size='sm'
                onClick={runUploads}
                disabled={isUploading || readyCount === 0 || categoriesLoading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' /> Uploading...
                  </>
                ) : (
                  `Upload All (${readyCount})`
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-16'>Preview</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className='w-28'>Match</TableHead>
                  <TableHead className='w-20'>Status</TableHead>
                  <TableHead className='w-10' />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className='h-10 w-10 overflow-hidden rounded-md border bg-muted'>
                        {row.preview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.preview}
                            alt={row.file.name}
                            className='h-full w-full object-cover'
                          />
                        ) : (
                          <ImageIcon className='h-full w-full p-2 text-muted-foreground' />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className='max-w-48 truncate text-sm' title={row.file.name}>
                      {row.file.name}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={row.categoryId || undefined}
                        onValueChange={(value: string) => setRowCategory(row.id, value)}
                        disabled={row.status === 'uploading' || row.status === 'success'}
                      >
                        <SelectTrigger className='h-8 w-full'>
                          <SelectValue placeholder='Pick a category...' />
                        </SelectTrigger>
                        <SelectContent>
                          {sortedCategories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {categoryLabel(category)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {row.confidence === 'exact' && row.categoryId && (
                        <Badge variant='default'>Exact</Badge>
                      )}
                      {row.confidence === 'fuzzy' && row.categoryId && (
                        <Badge variant='secondary'>Fuzzy</Badge>
                      )}
                      {!row.categoryId && <Badge variant='destructive'>No match</Badge>}
                    </TableCell>
                    <TableCell>
                      {row.status === 'pending' && (
                        <span className='text-xs text-muted-foreground'>Pending</span>
                      )}
                      {row.status === 'uploading' && (
                        <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />
                      )}
                      {row.status === 'success' && (
                        <CheckCircle2 className='h-4 w-4 text-emerald-600' />
                      )}
                      {row.status === 'error' && (
                        <span title={row.errorMessage}>
                          <XCircle className='h-4 w-4 text-destructive' />
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='h-7 w-7'
                        onClick={() => removeRow(row.id)}
                        disabled={row.status === 'uploading'}
                      >
                        <X className='h-3.5 w-3.5' />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
