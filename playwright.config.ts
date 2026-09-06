import { defineConfig, devices } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The single E2E harness for the repo: it boots the central server on :3000, which
// also serves the built Web UI from packages/web/dist (see packages/server/src/index.ts).
// So `npm run build:web` must run before `npm run test:e2e`.
const webDistIndex = path.join(__dirname, 'packages', 'web', 'dist', 'index.html');
if (!fs.existsSync(webDistIndex)) {
  console.warn(
    '[e2e] packages/web/dist/index.html is missing — UI assertions will fail. ' +
      'Run `npm run build:web` first.',
  );
}

// Local dev defaults to the system-installed Edge; CI sets E2E_BROWSER_CHANNEL=chromium to use
// the Playwright-managed browser.
const browserChannel = process.env.E2E_BROWSER_CHANNEL || 'msedge';
const browserUse = browserChannel === 'chromium' ? {} : { channel: browserChannel as 'msedge' };

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html']] : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], ...browserUse },
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...browserUse,
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
