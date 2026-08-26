import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1200, height: 900 },
    // The default headless shell has no audio stack — getUserMedia throws
    // NotSupportedError. The full Chromium build in headless mode works.
    channel: 'chromium',
    permissions: ['midi', 'microphone'],
    launchOptions: {
      args: [
        // Real getUserMedia plumbing without hardware.
        '--use-fake-device-for-media-capture',
        '--use-fake-ui-for-media-capture',
        '--autoplay-policy=no-user-gesture-required',
      ],
    },
  },
  webServer: {
    command:
      'npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
