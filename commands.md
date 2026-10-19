# Commands

Every command used in this repo, with a one-line explanation. Run workspace
commands from the repository root.

## Setup

| Command | What it does |
| --- | --- |
| `pnpm install` | Installs dependencies for all workspace packages |
| `cp .env.example .env` | Creates the root env file from the template |
| `cp server/.env.example server/.env` | Creates the server env file from the template |
| `pnpm docker:up` | Starts local MongoDB and the S3 store (see Docker below) |

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

## Docker

Docker is **not used for deployment.** Production builds from source: Vercel
builds the client, Render runs the API with its native Node runtime. Docker runs
the third-party services you need locally so you do not have to stand up a real
database or a real S3 account.

| Command | What it does |
| --- | --- |
| `pnpm docker:up` | Starts local MongoDB and the S3-compatible store |
| `pnpm docker:down` | Stops and removes those containers |
| `pnpm docker:logs` | Follows container logs |
| `pnpm docker:tools` | Also starts the optional MongoDB and S3 web UIs |
| `docker compose --profile tools up -d` | Same as `pnpm docker:tools` |
| `docker compose down -v` | Stops everything and deletes the database volume |

| Service | URL |
| --- | --- |
| Web client (pnpm dev) | http://localhost:5173 |
| API + Swagger (pnpm dev) | http://localhost:5000 |
| MongoDB (container) | mongodb://localhost:27017 |
| S3 store (container) | http://localhost:4566 |
| S3 web UI (optional) | http://localhost:9000 |

The client and API always run on the host with `pnpm dev`, never in a
container, so a broken container is never mistaken for a broken application.

There is no AI profile: transcription and summarisation are hosted (Groq and
OpenRouter), so nothing is downloaded or built for them.

`ffmpeg` must be on the server's PATH (or set `FFMPEG_PATH`). It prepares each
speaker's audio before transcription.

## Per-package

Run from inside `client/` or `server/`:

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server with hot reload |
| `pnpm build` | Production build |
| `pnpm lint` | Lint the package |
