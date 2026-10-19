import { Page, expect } from '@playwright/test';
import type { MockUser } from '../fixtures/seed-data';

export class MembersPage {
  constructor(private page: Page) {}

  async gotoMembersList() {
    await this.page.goto('/organization/members');
    await expect(this.page.locator('h1, h2, h3').filter({ hasText: /Members|Organization/i }).first()).toBeVisible({ timeout: 10000 });
  }

  async gotoCreateMember() {
    await this.page.goto('/organization/members/new');
    await expect(this.page.locator('input[name="userName"]')).toBeVisible({ timeout: 10000 });
  }

  async createMember(user: MockUser, defaultPassword = 'password123') {
    await this.gotoCreateMember();

    await this.page.locator('#user-name, input[name="userName"]').fill(user.name);
    await this.page.locator('#user-email, input[name="userEmail"]').fill(user.email);

    // Fill password if password input exists
    const passInput = this.page.locator('#user-password, input[name="password"]');
    if (await passInput.isVisible().catch(() => false)) {
      await passInput.fill(defaultPassword);
    }

    if (user.jobTitle) {
      const titleInput = this.page.locator('#job-title, input[name="jobTitle"]');
      if (await titleInput.isVisible().catch(() => false)) {
        await titleInput.fill(user.jobTitle);
      }
    }

    // Role selection
    if (user.role === 'Admin') {
      const roleTrigger = this.page.locator('#user-role, button:has-text("Member")').first();
      if (await roleTrigger.isVisible().catch(() => false)) {
        await roleTrigger.click();
        const adminOption = this.page.locator('[role="option"]:has-text("Admin")').first();
        if (await adminOption.isVisible().catch(() => false)) {
          await adminOption.click();
        }
      }
    }

    const submitBtn = this.page.locator('button[type="submit"]');
    await submitBtn.click();

    // Verify redirected back to member list or details page
    await expect(this.page).toHaveURL(/organization\/members/, { timeout: 15000 });
  }

  async createMembersBatch(users: MockUser[], defaultPassword = 'password123') {
    for (const user of users) {
      await this.createMember(user, defaultPassword);
      // Give React query and animation a brief tick
      await this.page.waitForTimeout(300);
    }
  }
}
