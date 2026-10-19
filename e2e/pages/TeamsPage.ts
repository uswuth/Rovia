import { Page, expect } from '@playwright/test';
import type { MockTeam } from '../fixtures/seed-data';

export class TeamsPage {
  constructor(private page: Page) {}

  async gotoTeamsList() {
    await this.page.goto('/teams');
    await expect(this.page.locator('h1, h2, h3').filter({ hasText: /Teams/i }).first()).toBeVisible({ timeout: 10000 });
  }

  async gotoCreateTeam() {
    await this.page.goto('/teams/new');
    await expect(this.page.locator('input[name="teamName"]')).toBeVisible({ timeout: 10000 });
  }

  async createTeam(team: MockTeam) {
    await this.gotoCreateTeam();

    await this.page.locator('#team-name, input[name="teamName"]').fill(team.name);

    if (team.description) {
      await this.page.locator('#team-description, textarea[name="description"]').fill(team.description);
    }

    // Select parent project from dropdown
    const projectTrigger = this.page.locator('#parent-project, button:has-text("Select Parent Project")').first();
    if (await projectTrigger.isVisible().catch(() => false)) {
      await projectTrigger.click();
      const option = this.page.locator(`[role="option"]`).filter({ hasText: team.projectName }).first();
      if (await option.isVisible().catch(() => false)) {
        await option.click();
      }
    }

    // Select assigned members from member roster
    for (const email of team.assignedMemberEmails) {
      const memberEntry = this.page.locator(`text=${email}`).first();
      if (await memberEntry.isVisible().catch(() => false)) {
        await memberEntry.click();
      }
    }

    const submitBtn = this.page.locator('button[type="submit"]');
    await submitBtn.click();

    await expect(this.page).toHaveURL(/teams/, { timeout: 15000 });
  }

  async createTeamsBatch(teams: MockTeam[]) {
    for (const team of teams) {
      await this.createTeam(team);
      await this.page.waitForTimeout(300);
    }
  }
}
