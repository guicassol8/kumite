import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

import { resolveSiteUrl } from './src/lib/site-url'

// {{SITE_URL}} instead of Vite's native %VITE_SITE_URL% substitution: the
// native one only fires when the env var is actually set, and without it the
// literal %VITE_SITE_URL% would ship straight into the published HTML —
// exactly the case that has to work today, since the real domain's DNS is
// still pending (#62) and most deploys run on the default.
function kumiteSiteUrl(): Plugin {
  let siteUrl = resolveSiteUrl({})
  return {
    name: 'kumite-site-url',
    configResolved(config) {
      siteUrl = resolveSiteUrl(config.env)
    },
    transformIndexHtml(html) {
      return html.replaceAll('{{SITE_URL}}', siteUrl)
    },
  }
}

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    kumiteSiteUrl(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  server: {
    port: 5173,
  },
})
