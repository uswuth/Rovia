import { test, expect } from '@playwright/test';
import { SEED_CONFIG } from '../fixtures/seed-data';
import { ServerAdminPage } from '../pages/ServerAdminPage';
import { AuthPage } from '../pages/AuthPage';
import { MembersPage } from '../pages/MembersPage';
import { ProjectsPage } from '../pages/ProjectsPage';
import { TeamsPage } from '../pages/TeamsPage';
import { TasksPage } from '../pages/TasksPage';

test.describe.serial('End-to-End Enterprise Tenant Onboarding & Entity Seeding Flow', () => {
  let serverAdminPage: ServerAdminPage;
  let authPage: AuthPage;
  let membersPage: MembersPage;
  let projectsPage: ProjectsPage;
  let teamsPage: TeamsPage;
  let tasksPage: TasksPage;

  // Use unique timestamp to allow rerun over and over cleanly without collision
  const runId = Date.now().toString(36).slice(-4);
  const tenantEmail = `admin.${runId}@apexglobal.internal`;
  let tenantPassword = SEED_CONFIG.organization.defaultPassword;

  test('Complete End-to-End Walkthrough: Provision, Onboard, Seed 10 Members, Projects, Teams & Tasks', async ({ page }) => {
    test.setTimeout(180_000); // 3 minutes for the full multi-entity demo

    serverAdminPage = new ServerAdminPage(page);
    authPage = new AuthPage(page);
    membersPage = new MembersPage(page);
    projectsPage = new ProjectsPage(page);
    teamsPage = new TeamsPage(page);
    tasksPage = new TasksPage(page);

    // 1. Server Admin Login
    await serverAdminPage.gotoLogin();
    await serverAdminPage.login(
      SEED_CONFIG.serverAdmin.username,
      SEED_CONFIG.serverAdmin.password
    );

    // 2. View Server Admin Dashboard
    await expect(page.locator('h1, h2, h3').filter({ hasText: /Deep Analytics|Server Admin|Organizations/i }).first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // 3. Provision new tenant organization
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

    // 4. Logout from Server Admin
    await serverAdminPage.logoutAndClearSession();

    // 5. Login as newly provisioned Tenant SuperAdmin
    await authPage.gotoLogin();
    await authPage.loginAsTenant(
      tenantEmail,
      tenantPassword
    );
    await expect(page).toHaveURL(/dashboard/);
    await page.waitForTimeout(1000);

    // 6. Create 10 Members
    await membersPage.createMembersBatch(
      SEED_CONFIG.members.map(m => ({ ...m, email: m.email.replace('@', `.${runId}@`) })),
      SEED_CONFIG.organization.defaultPassword
    );
    await membersPage.gotoMembersList();
    await page.waitForTimeout(1000);

    // 7. Create 3 Projects with Diverse Member Allocations
    await projectsPage.createProjectsBatch(SEED_CONFIG.projects);
    await projectsPage.gotoProjectsList();
    await page.waitForTimeout(1000);

    // 8. Create Teams Under Projects
    await teamsPage.createTeamsBatch(SEED_CONFIG.teams);
    await teamsPage.gotoTeamsList();
    await page.waitForTimeout(1000);

    // 9. Create Tasks Across Projects and Statuses
    await tasksPage.createTasksBatch(SEED_CONFIG.tasks);
    await tasksPage.gotoTasksList();
    await page.waitForTimeout(1500);

    // 10. Finish back at Dashboard
    await page.goto('/dashboard');
    await expect(page.locator('h1').filter({ hasText: 'Dashboard' }).first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);
  });
});
