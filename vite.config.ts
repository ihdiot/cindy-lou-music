/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Everything inlines into one dist/index.html: the same file works hosted
// on any static server AND double-clicked from the Desktop (file:// is a
// secure context, so Web MIDI still works — no server needed for mom).
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: {
    // Fonts must inline as base64 so the one-file build works offline.
    assetsInlineLimit: 200_000,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
