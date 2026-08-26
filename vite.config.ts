/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base './' so the app works from any path (GitHub Pages subdirectory).
// The Basic Pitch model + tfjs load lazily — MIDI users never download them.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    // Fonts inline as base64 into the stylesheet.
    assetsInlineLimit: 200_000,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
  },
})
