import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, '.auth', 'state.json');

setup('authenticate', async ({ page }) => {
  await page.goto('/');
  // Set username in localStorage to skip NamePrompt modal
  await page.evaluate(() => {
    localStorage.setItem('acb-username', 'E2ETestUser');
  });
  await page.reload();

  // Wait for header to show the username
  await expect(page.locator('header')).toContainText('E2ETestUser');

  await page.context().storageState({ path: authFile });
});
