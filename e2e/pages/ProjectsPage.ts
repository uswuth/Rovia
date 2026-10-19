import { Page, expect } from '@playwright/test';
import type { MockProject } from '../fixtures/seed-data';

export class ProjectsPage {
  constructor(private page: Page) {}

  async gotoProjectsList() {
    await this.page.goto('/projects');
    await expect(this.page.locator('h1, h2, h3').filter({ hasText: /Projects/i }).first()).toBeVisible({ timeout: 10000 });
  }

  async gotoCreateProject() {
    await this.page.goto('/projects/new');
    await expect(this.page.locator('input[name="name"]')).toBeVisible({ timeout: 10000 });
  }

  async createProject(project: MockProject) {
    await this.gotoCreateProject();

    await this.page.locator('#project-name, input[name="name"]').fill(project.name);

    if (project.description) {
      await this.page.locator('#project-description, textarea[name="description"]').fill(project.description);
    }

    // Select assigned members from roster if visible
    for (const email of project.assignedMemberEmails) {
      const memberRow = this.page.locator(`text=${email}`).first();
      if (await memberRow.isVisible().catch(() => false)) {
        await memberRow.click();
      }
    }

    const submitBtn = this.page.locator('button[type="submit"]');
    await submitBtn.click();

    // Verify redirected to projects list
    await expect(this.page).toHaveURL(/projects/, { timeout: 15000 });
  }

  async createProjectsBatch(projects: MockProject[]) {
    for (const project of projects) {
      await this.createProject(project);
      await this.page.waitForTimeout(300);
    }
  }
}
