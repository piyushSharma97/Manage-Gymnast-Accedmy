import { test, expect } from '@playwright/test';

test.describe('Sign in page', () => {
  test('loads sign in page successfully', async ({ page }) => {
    await page.goto('/signin');
    await expect(page).toHaveURL(/\/signin/);
    await expect(page.locator('text=Sign in to')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });
});
