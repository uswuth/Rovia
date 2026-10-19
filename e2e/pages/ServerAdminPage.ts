import { Page, expect } from '@playwright/test';

export class ServerAdminPage {
  constructor(private page: Page) {}

  async gotoLogin() {
    await this.page.goto('/server-admin/login');
    await expect(this.page.locator('input#adminUsername, input[type="text"]')).toBeVisible({ timeout: 10000 });
  }

  async login(username: string, password: string) {
    const usernameInput = this.page.locator('input#adminUsername').first();
    const passwordInput = this.page.locator('input#adminPassword').first();

    await usernameInput.fill(username);
    await passwordInput.fill(password);

    const submitBtn = this.page.locator('button[type="submit"]');
    await submitBtn.click();

    // Verify successful authentication and landing
    await expect(this.page).toHaveURL(/server-admin\/(dashboard|organizations)/, { timeout: 15000 });
  }

  async createOrganization(org: {
    name: string;
    location?: string;
    description?: string;
    adminName: string;
    adminEmail: string;
  }) {
    await this.page.goto('/server-admin/organizations/new');
    await expect(this.page.locator('input[name="organizationName"]')).toBeVisible({ timeout: 10000 });

    await this.page.locator('input[name="organizationName"]').fill(org.name);
    if (org.location) {
      await this.page.locator('input[name="organizationLocation"]').fill(org.location);
    }
    if (org.description) {
      await this.page.locator('textarea[name="organizationDescription"]').fill(org.description);
    }
    await this.page.locator('input[name="adminName"]').fill(org.adminName);
    await this.page.locator('input[name="adminEmail"]').fill(org.adminEmail);

    const submitButton = this.page.locator('button[type="submit"]');
    await submitButton.click();

    // Wait for the generated credentials dialog / card
    const credCard = this.page.locator('text=Organization Provisioned').first();
    await expect(credCard).toBeVisible({ timeout: 15000 });

    // Extract initial cleartext password if present from the input
    const passwordInput = this.page.locator('input[type="password"][readonly], input[readonly].tracking-wider').first();
    const passwordText = await passwordInput.inputValue().catch(() => '');

    return passwordText.trim();
  }

  async logoutAndClearSession() {
    await this.page.evaluate(() => {
      localStorage.removeItem('server_admin_token');
      localStorage.removeItem('server_admin_user');
      sessionStorage.clear();
    });
    await this.page.goto('/login');
    await expect(this.page.locator('input[type="email"], input[name="userEmail"]')).toBeVisible();
  }
}
