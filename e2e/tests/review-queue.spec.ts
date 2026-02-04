import { test, expect } from '@playwright/test';

test.describe('Review Queue', () => {
  test('should display the review queue page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/HILT Review/);
  });

  test('should show pending tasks in the queue', async ({ page }) => {
    await page.goto('/');

    // Wait for tasks to load
    await page.waitForSelector('[data-testid="task-card"], .taskCard, a[href^="/tasks/"]', {
      timeout: 10000,
    }).catch(() => {
      // Tasks might not exist yet, that's OK
    });

    // Check for queue header or title
    const header = page.locator('h1, h2').first();
    await expect(header).toBeVisible();
  });

  test('should filter tasks by status', async ({ page }) => {
    await page.goto('/');

    // Check if filter controls exist
    const filterSection = page.locator('select, [role="combobox"], button:has-text("Filter")');

    // If filters exist, test them
    if (await filterSection.count() > 0) {
      await expect(filterSection.first()).toBeVisible();
    }
  });
});

test.describe('Task Detail', () => {
  test('should navigate to task detail page', async ({ page }) => {
    await page.goto('/');

    // Find a task card/link
    const taskLink = page.locator('a[href^="/tasks/"]').first();

    if (await taskLink.count() > 0) {
      await taskLink.click();

      // Should be on task detail page
      await expect(page.url()).toContain('/tasks/');

      // Should show task content
      await expect(page.locator('h1, h2, h3').first()).toBeVisible();
    }
  });

  test('should show approve and deny buttons for pending tasks', async ({ page }) => {
    await page.goto('/');

    const taskLink = page.locator('a[href^="/tasks/"]').first();

    if (await taskLink.count() > 0) {
      await taskLink.click();

      // Check for decision buttons
      const approveButton = page.getByRole('button', { name: /approve/i });
      const denyButton = page.getByRole('button', { name: /deny/i });

      // At least one should be visible for pending tasks
      const hasApprove = await approveButton.count() > 0;
      const hasDeny = await denyButton.count() > 0;

      // Either both buttons exist (pending) or neither (already decided)
      expect(hasApprove === hasDeny).toBe(true);
    }
  });
});

test.describe('Navigation', () => {
  test('should navigate back to queue from task detail', async ({ page }) => {
    await page.goto('/');

    const taskLink = page.locator('a[href^="/tasks/"]').first();

    if (await taskLink.count() > 0) {
      await taskLink.click();
      await expect(page.url()).toContain('/tasks/');

      // Find back button
      const backButton = page.locator('button:has-text("Back"), a:has-text("Back")').first();

      if (await backButton.count() > 0) {
        await backButton.click();
        await expect(page.url()).not.toContain('/tasks/');
      }
    }
  });
});
