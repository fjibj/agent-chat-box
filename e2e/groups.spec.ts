import { test, expect } from '@playwright/test';

// ATDD: E2E Tests for Group Expansion
// Covers G023-G026 UI flows
//
// Run through the repo-root Playwright harness (`npm run test:e2e`): it boots the central
// server on :3000, which also serves the built Web UI.

test.describe('E2E: Groups Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/groups');
  });

  test('TC-G023-001: displays group page title', async ({ page }) => {
    // Role-scoped: the sidebar heading and the top nav link both say "Groups".
    await expect(page.getByRole('heading', { name: 'Groups' })).toBeVisible();
  });

  test('TC-G023-002: can open create group modal', async ({ page }) => {
    await page.getByRole('button', { name: /New/ }).click();
    await expect(page.getByRole('heading', { name: 'Create Group' })).toBeVisible();
  });
});

test.describe('E2E: Authorizations Page', () => {
  test('TC-G025-001: shows pending authorization requests', async ({ page }) => {
    await page.goto('/authorizations');
    await expect(page.getByRole('heading', { name: 'Authorization Requests' })).toBeVisible();
  });
});
