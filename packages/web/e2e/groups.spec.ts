import { test, expect } from '@playwright/test';

// ATDD: E2E Tests for Group Expansion
// Covers G023-G026 UI flows

test.describe('E2E: Groups Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/groups');
  });

  test('TC-G023-001: displays group page title', async ({ page }) => {
    await expect(page.getByText('Groups')).toBeVisible();
  });

  test('TC-G023-002: can open create group modal', async ({ page }) => {
    await page.getByRole('button', { name: /New/i }).click();
    await expect(page.getByText('Create Group')).toBeVisible();
  });
});

test.describe('E2E: Authorizations Page', () => {
  test('TC-G025-001: shows pending authorization requests', async ({ page }) => {
    await page.goto('/authorizations');
    await expect(page.getByText('Authorization Requests')).toBeVisible();
  });
});
