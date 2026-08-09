import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Separate from vite.config.ts on purpose -- that file's build/rollup
// config (manualChunks, visualizer, etc.) has nothing to do with running
// tests, and vitest picks this file up automatically when present instead
// of merging with vite.config.ts.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
