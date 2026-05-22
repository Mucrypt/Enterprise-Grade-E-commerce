import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

const isBundleAnalyzeRun = process.env.ANALYZE_BUNDLE === 'true'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    ...(isBundleAnalyzeRun
      ? [
          visualizer({
            filename: 'dist/stats.html',
            template: 'treemap',
            gzipSize: true,
            brotliSize: true,
            emitFile: false,
            open: false,
          }),
          visualizer({
            filename: 'dist/stats.json',
            template: 'raw-data',
            gzipSize: true,
            brotliSize: true,
            emitFile: false,
            open: false,
          }),
        ]
      : []),
  ],
  build: {
    // Keep warnings meaningful so bundle growth is caught early in CI.
    chunkSizeWarningLimit: 450,
    rollupOptions: {
      output: {
        // Deterministic patterns improve long-term CDN/browser cache behavior.
        entryFileNames: 'assets/entry-[name]-[hash].js',
        chunkFileNames: 'assets/chunk-[name]-[hash].js',
        assetFileNames: 'assets/asset-[name]-[hash][extname]',
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          const inPkg = (pkg: string) => id.includes(`/node_modules/${pkg}/`)

          // Keep React and its close runtime deps in one stable chunk.
          if (inPkg('react') || inPkg('react-dom') || inPkg('scheduler')) {
            return 'vendor-react'
          }

          if (
            inPkg('react-router') ||
            inPkg('react-router-dom') ||
            inPkg('@remix-run/router')
          ) {
            return 'vendor-router'
          }

          if (inPkg('@tanstack/react-query') || inPkg('@tanstack/query-core')) {
            return 'vendor-query'
          }

          if (
            inPkg('lucide-react') ||
            inPkg('@radix-ui') ||
            inPkg('framer-motion')
          ) {
            return 'vendor-ui'
          }

          if (
            inPkg('axios') ||
            inPkg('@stripe/react-stripe-js') ||
            inPkg('@stripe/stripe-js')
          ) {
            return 'vendor-network-payments'
          }

          // Leave everything else to Rollup's default chunking to avoid
          // forcing cross-import cycles between custom vendor chunks.
          return
        },
      },
    },
  },
})
