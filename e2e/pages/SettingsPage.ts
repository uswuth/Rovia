import { Page, expect } from '@playwright/test';

export class SettingsPage {
  constructor(private page: Page) {}

  async gotoSettings() {
    await this.page.goto('/settings');
    await expect(this.page.locator('h1').filter({ hasText: 'Settings' })).toBeVisible({ timeout: 10000 });
  }

  async switchTab(tabName: 'Profile Details' | 'Appearance' | 'Security & Password') {
    const tabBtn = this.page.locator('button').filter({ hasText: tabName }).first();
    await tabBtn.click();
    await this.page.waitForTimeout(500);
  }
}
