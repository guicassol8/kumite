import { defineConfig } from 'vitest/config'

// The package has to work headless on the back too, so its own suite runs in
// Node — leaning on jsdom here would hide a Node-only breakage until #20.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
