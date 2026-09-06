import { defineConfig } from 'vitest/config';
import path from 'path';

// The web package owns its own frontend toolchain (react, react-router-dom, vitest and
// testing-library all live under packages/web/node_modules). Aliasing react/react-dom to the
// local copy keeps exactly ONE React in the test graph — pointing these at the repo root instead
// pulls in a second copy and breaks every component that goes through react-router.
export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      '@agent-chat-box/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: ['node_modules/', 'dist/', '**/*.d.ts'],
    },
  },
});
