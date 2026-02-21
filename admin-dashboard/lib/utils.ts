import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Construct absolute media URL from relative path
 * Handles paths like /media/..., media/..., or just the filepath
 */
export function getAbsoluteMediaUrl(
  path: string | null | undefined,
): string | null {
  if (!path) return null

  const mediaBase =
    process.env.NEXT_PUBLIC_MEDIA_URL || 'https://nexusai.lt/media'

  // Remove leading /media/ or / to normalize
  const cleanPath = path.startsWith('/media/')
    ? path.slice(7)
    : path.startsWith('/')
    ? path.slice(1)
    : path

  return `${mediaBase}/${cleanPath}`
}
