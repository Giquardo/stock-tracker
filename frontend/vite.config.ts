/// <reference types="vitest/config" />
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * docs/data/ is the hand-edited source for temporary sample data. Browsers
 * can't read arbitrary filesystem paths, so this copies it into public/data
 * (served + precached like any other static asset) on every dev start and
 * build. public/data itself is gitignored — docs/data is the only copy
 * meant to be edited.
 */
function syncSampleData(): Plugin {
  return {
    name: 'sync-sample-data',
    buildStart() {
      const srcDir = path.resolve(dirname, '../docs/data')
      const destDir = path.resolve(dirname, 'public/data')
      if (!fs.existsSync(srcDir)) return
      fs.mkdirSync(destDir, { recursive: true })
      for (const file of fs.readdirSync(srcDir)) {
        fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file))
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    syncSampleData(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-icon.svg'],
      manifest: {
        name: 'Stock Check & Reorder',
        short_name: 'Stock Check',
        description: 'Weekly stockroom check and reorder list',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          {
            src: 'pwa-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
          {
            src: 'pwa-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ico,csv}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
  },
})
