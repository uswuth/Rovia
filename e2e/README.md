# IntellMeet E2E Automated Test & Seeding Suite

Production-grade Playwright E2E suite that models the entire tenant provisioning, organization onboarding, and workspace seeding lifecycle with automated video recording.

---

## Architecture & Modular Folder Structure

The suite is abstracted into a clean Page Object Model (POM) and modular architecture under [`e2e/`](file:///c:/zidio/Intellmeet-debug-ui/e2e):

```
e2e/
├── fixtures/
│   └── seed-data.ts           # Production-level mock datasets (10 users, 3 projects, teams, tasks)
├── pages/
│   ├── ServerAdminPage.ts     # Server admin authentication & tenant organization provisioning
│   ├── AuthPage.ts            # Platform user login & session management
│   ├── MembersPage.ts         # User provisioning (10 members with distinct roles & job titles)
│   ├── ProjectsPage.ts        # Project creation with varying member roster assignments
│   ├── TeamsPage.ts           # Team creation associated with projects & members
│   └── TasksPage.ts           # Task creation across projects, teams, & workflow statuses
└── specs/
    └── onboarding-and-seeding.spec.ts  # Master sequential E2E test execution flow
```

---

## Configuration & Video Capture

- Configured in [`playwright.config.ts`](file:///c:/zidio/Intellmeet-debug-ui/playwright.config.ts).
- `video: 'on'` is enabled by default to automatically record and output video demos into `playwright-report/` or `test-results/`.
- Viewport is set to `1440x900` standard desktop display.

---

## How to Run

### 1. Run all E2E tests headless (with video recording)
```bash
pnpm test:e2e
```

### 2. Run with interactive Playwright UI mode
```bash
pnpm test:e2e:ui
```

### 3. Open test report and video recordings
```bash
pnpm test:e2e:report
```
