import type { NextConfig } from 'next'
import type { RemotePattern } from 'next/dist/shared/lib/image-config'

const configuredMediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL
const configuredMediaPattern: RemotePattern | null = (() => {
  if (!configuredMediaUrl) return null

  try {
    const parsed = new URL(configuredMediaUrl)
    return {
      protocol: parsed.protocol.replace(':', '') as 'http' | 'https',
      hostname: parsed.hostname,
      pathname: `${parsed.pathname.replace(/\/$/, '')}/**`,
    }
  } catch {
    return null
  }
})()

const remotePatterns: RemotePattern[] = [
  {
    protocol: 'http',
    hostname: 'localhost',
    port: '9000',
    pathname: '/media/**',
  },
  {
    protocol: 'https',
    hostname: '*.techtools.com',
    pathname: '/media/**',
  },
  {
    protocol: 'https',
    hostname: 'techtoolstore.com',
    pathname: '/media/**',
  },
  {
    protocol: 'https',
    hostname: '*.techtoolstore.com',
    pathname: '/media/**',
  },
  {
    protocol: 'https',
    hostname: 'res.cloudinary.com',
    pathname: '/**',
  },
  {
    protocol: 'https',
    hostname: '*.r2.dev',
    pathname: '/**',
  },
]

if (
  configuredMediaPattern &&
  !remotePatterns.some(
    (pattern) =>
      pattern.protocol === configuredMediaPattern.protocol &&
      pattern.hostname === configuredMediaPattern.hostname &&
      pattern.pathname === configuredMediaPattern.pathname,
  )
) {
  remotePatterns.push(configuredMediaPattern)
}

const nextConfig: NextConfig = {
  // Base path for reverse proxy setup (e.g., /admin)
  // Only used when NEXT_PUBLIC_BASE_PATH is set
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',

  // Enable standalone output for Docker
  output: 'standalone',

  // Image optimization
  images: {
    remotePatterns,
    formats: ['image/webp', 'image/avif'],
  },

  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000/api/v1',
    NEXT_PUBLIC_MEDIA_URL:
      process.env.NEXT_PUBLIC_MEDIA_URL || 'http://localhost:9000/media',
  },

  // Webpack configuration
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      }
    }
    return config
  },

  // Enable experimental features
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },

  // Enable Turbopack (Next.js 16+ default)
  turbopack: {},
}

export default nextConfig
