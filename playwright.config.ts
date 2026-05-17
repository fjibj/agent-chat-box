import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], channel: 'msedge' as const },
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'msedge' as const,
        storageState: path.join(__dirname, 'e2e', '.auth', 'state.json'),
      },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npx tsx packages/server/src/index.ts',
    url: 'http://localhost:3000/api/health',
    timeout: 120000,
    reuseExistingServer: false,
    env: {
      DATA_DIR: path.join(__dirname, 'data-e2e'),
      UPLOAD_DIR: path.join(__dirname, 'uploads-e2e'),
      PORT: '3000',
    },
  },
});
