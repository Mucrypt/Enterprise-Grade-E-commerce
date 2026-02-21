import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Base path for reverse proxy setup (e.g., /admin)
  // Only used when NEXT_PUBLIC_BASE_PATH is set
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',

  // Enable standalone output for Docker
  output: 'standalone',

  // Image optimization
  images: {
    remotePatterns: [
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
        hostname: 'nexusai.lt',
        pathname: '/media/**',
      },
      {
        protocol: 'https',
        hostname: '*.nexusai.lt',
        pathname: '/media/**',
      },
    ],
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
