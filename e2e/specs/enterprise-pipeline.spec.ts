import { test, expect } from '@playwright/test';
import { SEED_CONFIG } from '../fixtures/seed-data';
import { ServerAdminPage } from '../pages/ServerAdminPage';
import { AuthPage } from '../pages/AuthPage';
import { MembersPage } from '../pages/MembersPage';
import { ProjectsPage } from '../pages/ProjectsPage';
import { TeamsPage } from '../pages/TeamsPage';
import { TasksPage } from '../pages/TasksPage';
import { SettingsPage } from '../pages/SettingsPage';

test.describe.serial('Full Enterprise Pipeline E2E Test Suite (Non-Meeting Surfaces)', () => {
  let serverAdminPage: ServerAdminPage;
  let authPage: AuthPage;
  let membersPage: MembersPage;
  let projectsPage: ProjectsPage;
  let teamsPage: TeamsPage;
  let tasksPage: TasksPage;
  let settingsPage: SettingsPage;

  // Generate run ID to support continuous re-runs without database unique constraint violations
  const runId = Date.now().toString(36).slice(-4);
  const tenantEmail = `admin.${runId}@apexglobal.internal`;
  let tenantPassword = SEED_CONFIG.organization.defaultPassword;

  test('Pipeline Step 1: Server Admin Cluster Auth & Telemetry Verification', async ({ page }) => {
    test.setTimeout(60_000);
    serverAdminPage = new ServerAdminPage(page);

    await serverAdminPage.gotoLogin();
    await serverAdminPage.login(
      SEED_CONFIG.serverAdmin.username,
      SEED_CONFIG.serverAdmin.password
    );

    // Verify Server Admin Analytics Dashboard
    await expect(page.locator('h1, h2, h3').filter({ hasText: /Deep Analytics|Server Admin|Organizations/i }).first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify Telemetry Sub-Dashboard
    await page.goto('/server-admin/telemetry');
    await expect(page.locator('h1, h2').filter({ hasText: /Cluster Telemetry|Telemetry/i }).first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
  });

  test('Pipeline Step 2: Tenant Provisioning & Generated Credentials Extraction', async ({ page }) => {
    test.setTimeout(60_000);
    serverAdminPage = new ServerAdminPage(page);

    // Provision new tenant organization
    const generatedPass = await serverAdminPage.createOrganization({
      name: `${SEED_CONFIG.organization.name} ${runId.toUpperCase()}`,
      location: SEED_CONFIG.organization.location,
      description: SEED_CONFIG.organization.description,
      adminName: SEED_CONFIG.organization.adminName,
      adminEmail: tenantEmail,
    });

    if (generatedPass) {
      tenantPassword = generatedPass;
    }
    await page.waitForTimeout(1000);

    // Leave the server admin portal
    await serverAdminPage.logoutAndClearSession();
  });

  test('Pipeline Step 3: Platform SuperAdmin Authentication & Dashboard Verification', async ({ page }) => {
    test.setTimeout(60_000);
    authPage = new AuthPage(page);

    await authPage.gotoLogin();
    await authPage.loginAsTenant(
      tenantEmail,
      tenantPassword
    );

    await expect(page).toHaveURL(/dashboard/);
    await expect(page.locator('h1').filter({ hasText: 'Dashboard' }).first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
  });

  test('Pipeline Step 4: Batch Provision 10 Organization Members with Roles & Titles', async ({ page }) => {
    test.setTimeout(120_000);
    membersPage = new MembersPage(page);

    const generatedMembers = SEED_CONFIG.members.map((m) => ({
      ...m,
      email: m.email.replace('@', `.${runId}@`),
    }));

    await membersPage.createMembersBatch(
      generatedMembers,
      SEED_CONFIG.organization.defaultPassword
    );

    await membersPage.gotoMembersList();
    // Verify first and last member in directory
    await expect(page.locator(`text=${generatedMembers[0].name}`).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${generatedMembers[generatedMembers.length - 1].name}`).first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
  });

  test('Pipeline Step 5: Multi-Project Creation & Dynamic Member Distribution', async ({ page }) => {
    test.setTimeout(90_000);
    projectsPage = new ProjectsPage(page);

    await projectsPage.createProjectsBatch(SEED_CONFIG.projects);

    await projectsPage.gotoProjectsList();
    for (const proj of SEED_CONFIG.projects) {
      await expect(page.locator(`text=${proj.name}`).first()).toBeVisible({ timeout: 10000 });
    }
    await page.waitForTimeout(1000);
  });

  test('Pipeline Step 6: Functional Team Formation Across Parent Projects', async ({ page }) => {
    test.setTimeout(90_000);
    teamsPage = new TeamsPage(page);

    await teamsPage.createTeamsBatch(SEED_CONFIG.teams);

    await teamsPage.gotoTeamsList();
    for (const team of SEED_CONFIG.teams) {
      await expect(page.locator(`text=${team.name}`).first()).toBeVisible({ timeout: 10000 });
    }
    await page.waitForTimeout(1000);
  });

  test('Pipeline Step 7: Comprehensive Task Board & Lifecycle Management', async ({ page }) => {
    test.setTimeout(90_000);
    tasksPage = new TasksPage(page);

    await tasksPage.createTasksBatch(SEED_CONFIG.tasks);

    await tasksPage.gotoTasksList();
    for (const task of SEED_CONFIG.tasks) {
      await expect(page.locator(`text=${task.title}`).first()).toBeVisible({ timeout: 10000 });
    }
    await page.waitForTimeout(1000);
  });

  test('Pipeline Step 8: User Profile & Security Configuration Audit', async ({ page }) => {
    test.setTimeout(60_000);
    settingsPage = new SettingsPage(page);

    await settingsPage.gotoSettings();
    await settingsPage.switchTab('Appearance');
    await settingsPage.switchTab('Security & Password');
    await settingsPage.switchTab('Profile Details');
    await page.waitForTimeout(1000);

    // Final dashboard review showcasing all newly aggregated counts
    await page.goto('/dashboard');
    await expect(page.locator('h1').filter({ hasText: 'Dashboard' }).first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);
  });
});
