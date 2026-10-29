# Commands

Every command used in this repo, with a one-line explanation. Run workspace
commands from the repository root.

## Setup

| Command | What it does |
| --- | --- |
| `pnpm install` | Installs dependencies for all workspace packages |
| `cp .env.example .env` | Creates the root env file from the template |
| `cp server/.env.example server/.env` | Creates the server env file from the template |
| `cp server/.env.example server/.env.local` | Creates the server env file (secrets only, git-ignored) |

## Development

| Command | What it does |
| --- | --- |
| `pnpm dev` | Runs the API server and the web client together |
| `pnpm dev:server` | Runs only the API server with hot reload |
| `pnpm dev:client` | Runs only the Vite dev server for the client |
| `pnpm build` | Builds the server and client for production |
| `pnpm build:server` | Compiles the server TypeScript to `server/dist` |
| `pnpm build:client` | Type-checks and builds the client bundle |
| `pnpm lint` | Runs ESLint across both packages |
| `pnpm lint:fix` | Runs ESLint with auto-fix |
| `pnpm lint:server` / `pnpm lint:client` | Lints one package |

## E2E Testing & Seeding (Playwright)

| Command | What it does |
| --- | --- |
| `pnpm test:e2e` | Runs end-to-end tests headless with full video demo recording |
| `pnpm test:e2e:ui` | Runs tests in interactive Playwright UI mode with time-travel debugger |
| `pnpm test:e2e:report` | Opens HTML report displaying test steps and recorded videos |
| `npx playwright test --headed` | Runs E2E tests in a visible desktop browser window |
| `npx playwright install chromium` | Installs or updates the Chromium browser binary for Playwright |

## API

| Command | What it does |
| --- | --- |
| `pnpm openapi` | Dumps the OpenAPI spec to `server/openapi.json` |
| `GET /api/v1/health` | Liveness check for the API |
| `GET /api/docs` | Swagger UI for every documented endpoint |

## Secrets

| Command | What it does |
| --- | --- |
| `pnpm secrets:generate` | Generates `server/secrets/*.txt` to upload to Render |
| `node server/scripts/generate-secrets.mjs --force` | Regenerates all secrets (invalidates existing tokens) |

Secrets live in `server/secrets/` and are git-ignored. Upload each file under
**Render → Secret Files**, or set the same values as environment variables in
local development. There are no default secret values in code — a missing one
stops the server with a named error.

## Object storage

| Command | What it does |
| --- | --- |
| `cd server && node scripts/_tmp_apply_cors.mjs` | Applies the Backblaze B2 CORS rule that browser uploads need; prompts for the account master key. |
| `cd server && node scripts/_tmp_apply_cors.mjs --check` | Verifies the rule with the app key without changing the bucket. |

The app key can upload and read files but cannot change bucket configuration,
so the first command is the only one that needs the master key. It is read with
echo off and never written to disk.



## Per-package

Run from inside `client/` or `server/`:

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server with hot reload |
| `pnpm build` | Production build |
| `pnpm lint` | Lint the package |
