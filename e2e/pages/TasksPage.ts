import { Page, expect } from '@playwright/test';
import type { MockTask } from '../fixtures/seed-data';

export class TasksPage {
  constructor(private page: Page) {}

  async gotoTasksList() {
    await this.page.goto('/tasks');
    await expect(this.page.locator('h1, h2, h3').filter({ hasText: /Tasks/i }).first()).toBeVisible({ timeout: 10000 });
  }

  async gotoCreateTask() {
    await this.page.goto('/tasks/new');
    await expect(this.page.locator('input[name="taskTitle"]')).toBeVisible({ timeout: 10000 });
  }

  async createTask(task: MockTask) {
    await this.gotoCreateTask();

    await this.page.locator('#task-title, input[name="taskTitle"]').fill(task.title);

    if (task.description) {
      await this.page.locator('#task-description, textarea[name="taskDescription"]').fill(task.description);
    }

    // Select project if dropdown is available
    const projectTrigger = this.page.locator('button').filter({ hasText: /Select.*project|Project/i }).first();
    if (await projectTrigger.isVisible().catch(() => false)) {
      await projectTrigger.click();
      const option = this.page.locator(`[role="option"]`).filter({ hasText: task.projectName }).first();
      if (await option.isVisible().catch(() => false)) {
        await option.click();
      }
    }

    // Select assigned members from member roster
    for (const email of task.assignedMemberEmails) {
      const memberEntry = this.page.locator(`text=${email}`).first();
      if (await memberEntry.isVisible().catch(() => false)) {
        await memberEntry.click();
      }
    }

    const submitBtn = this.page.locator('button[type="submit"]');
    await submitBtn.click();

    await expect(this.page).toHaveURL(/tasks/, { timeout: 15000 });
  }

  async createTasksBatch(tasks: MockTask[]) {
    for (const task of tasks) {
      await this.createTask(task);
      await this.page.waitForTimeout(300);
    }
  }
}
