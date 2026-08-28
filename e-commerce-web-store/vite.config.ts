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

          // i18next + react-i18next + its HTML-parsing dep for <Trans> --
          // ~115KB unminified, previously falling into the entry chunk by
          // default (i18n.ts is imported eagerly in main.tsx, not lazy)
          // since nothing bucketed it. The single largest fixable
          // contributor to the entry chunk blowing its CI budget.
          if (
            inPkg('i18next') ||
            inPkg('react-i18next') ||
            inPkg('html-parse-stringify') ||
            inPkg('void-elements')
          ) {
            return 'vendor-i18n'
          }

          if (
            inPkg('lucide-react') ||
            inPkg('@radix-ui') ||
            inPkg('framer-motion') ||
            // Small, style-only utilities used by cn() everywhere --
            // tailwind-merge alone is ~97KB unminified (embeds the full
            // default Tailwind class-group config), the other single
            // largest contributor to the entry chunk before this bucket
            // existed. date-fns folded in here too rather than a
            // dedicated chunk for one importer's sake.
            inPkg('tailwind-merge') ||
            inPkg('clsx') ||
            inPkg('date-fns')
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
