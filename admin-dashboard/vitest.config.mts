import { defineConfig } from 'vitest/config'
import path from 'path'
import { fileURLToPath } from 'url'

// Separate from next.config.ts on purpose, same reasoning as the web
// store's vitest.config.ts -- this only needs to run plain TS/TSX through
// esbuild for tests, not Next's own build pipeline. The admin dashboard
// had no test runner before this file; vitest + jsdom + Testing Library
// mirror exactly what e-commerce-web-store already uses so conventions
// stay consistent across the monorepo.
const dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(dirname, '.'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
})
