import { Page, expect } from '@playwright/test';

export class AuthPage {
  constructor(private page: Page) {}

  async gotoLogin() {
    await this.page.goto('/login');
    await expect(this.page.locator('input[type="email"], input[name="userEmail"]')).toBeVisible();
  }

  async loginAsTenant(email: string, password: string) {
    const emailInput = this.page.locator('#userEmail, input[name="userEmail"]').first();
    const passwordInput = this.page.locator('#password, input[name="password"]').first();

    await emailInput.fill(email);
    await passwordInput.fill(password);

    const submitBtn = this.page.locator('button[type="submit"]').first();
    await submitBtn.click();

    // Verify navigation to dashboard
    await expect(this.page).toHaveURL(/dashboard/, { timeout: 15000 });
  }

  async logout() {
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await this.page.goto('/login');
  }
}
