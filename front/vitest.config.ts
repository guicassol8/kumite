import path from 'node:path'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/web-storage-jsdom.ts', './src/test/blockly-jsdom.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
