import { defineConfig } from 'vitest/config';
import { mkdtempSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';

const testDir = mkdtempSync(join(tmpdir(), 'acb-test-'));

export default defineConfig({
  resolve: {
    alias: {
      '@agent-chat-box/shared': resolve(__dirname, 'packages/shared/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 15000,
    hookTimeout: 10000,
    env: {
      DATA_DIR: join(testDir, 'data'),
    },
  },
});
