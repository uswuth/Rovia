# IntellMeet — Technology Stack

Every item below is taken from the actual `package.json` files, Docker/Compose
configuration and CI workflows in this repository — not from the original plan
document.

---

## Overview

| Layer | Technology | Version (pinned/declared) |
| --- | --- | --- |
| Frontend framework | React | ^19.2.8 |
| Frontend build | Vite + `@vitejs/plugin-react` | ^8.3.0 / ^6.1.1 |
| Frontend language | TypeScript | ~6.0.2 (`tsc -b`) |
| Styling | Tailwind CSS (Vite plugin) | ^4.3.3 |
| Component primitives | Base UI (`@base-ui/react`), shadcn-style hand-rolled UI, Emotion | alpha ^1.0.0 |
| Design system extras | MUI (`@mui/material`) | ^9.4.0 |
| Icons | Lucide (`lucide-react`) | ^1.47.0 |
| Routing | React Router (`react-router-dom`) | ^7.18.4 |
| Server state | TanStack Query (+ devtools) | ^5.90.2 |
| Tables | TanStack Table | ^8.21.3 |
| Forms | React Hook Form + `@hookform/resolvers` | ^7.88.0 / ^5.9.1 |
| Validation | Zod | ^4.6.5 |
| HTTP client | Axios | ^1.20.0 |
| Real-time client | `socket.io-client` | ^4.8.1 |
| Dates | `date-fns`, `react-day-picker` | ^4.1.0 / ^10.0.2 |
| Backend runtime | Node.js | 22 (CI + Docker) |
| Backend framework | Express | ^4.21.2 |
| Backend language | TypeScript (ESM) | ^5.7.3 (`tsx` in dev) |
| Database | MongoDB + Mongoose | mongodb ^7.6.0, mongoose ^8.9.5 |
| ODM | Typegoose (`@typegoose/typegoose`) | ^12.12.0 |
| Real-time server | Socket.io | ^4.8.1 |
| Auth | `jsonwebtoken` + `bcryptjs` (access JWT, rotating refresh in httpOnly cookie) | ^9.0.2 / ^2.4.3 |
| Object storage | S3-compatible via AWS SDK v3 (`@aws-sdk/client-s3`, presigner) — LocalStack/Floci locally, Cloudflare R2 in prod | 3.716.0 |
| AI pipeline (local) | FFmpeg (audio extract) + Whisper (local STT) + Ollama (local LLM) | run-time installed, wired in `recording-post-processing.service.ts` |
| API docs | `swagger-jsdoc` + `swagger-ui-express` (`/api/docs`) | ^6.2.8 / ^5.0.1 |
| Security middleware | `helmet`, `cors`, `cookie-parser`, 16 kb JSON body limit | helmet ^8.0.0 |
| Monorepo | pnpm workspaces | pnpm 11.9.0 |
| Linting | ESLint + `typescript-eslint` | ^10.x / ^8.x |
| Containerization | Docker multi-stage + Docker Compose | — |
| Web server (client) | nginx:alpine — SPA fallback, immutable assets, `/api` reverse proxy | — |
| CI | GitHub Actions (`client-ci.yml`, `server-ci.yml`: lint + build on push/PR) | — |

---

## Repository Layout

```
Intellmeet-debug-ui/
├── client/          # React 19 SPA (Vite, Tailwind v4, TanStack Query)
│   └── docs/        # frontend-specific docs (capture contract, auth)
├── server/          # Express 4 + Socket.io API (TypeScript ESM)
│   ├── src/
│   │   ├── config/      # env (secret-file resolution), cors, db, swagger, cookies
│   │   ├── controllers/ # request → service → ApiResponse
│   │   ├── services/    # business rules, tenant scoping, caps
│   │   ├── models/      # Typegoose classes with explicit toJSON transforms
│   │   ├── routes/      # routers + inline @openapi annotations
│   │   ├── middlewares/ # auth (JWT scope), errorHandler, notFound, tolerantJson
│   │   ├── socket/      # typed Socket.io: signaling relay + presence
│   │   └── utils/       # ApiResponse, ApiError, pagination, codes, logger
│   ├── scripts/         # generate-secrets.mjs
│   └── floci/           # local S3-compatible storage helper (browser upload)
├── bruno/           # runnable API collection (auth → projects → meetings → …)
├── docs/            # API_ROUTES.md, STACK.md, ARCHITECTURE.md
└── .github/workflows/  # client + server CI
```

---

## Key Design Choices

### Auth
- **Access token**: 15-minute JWT carrying `id` + `organizationId`, sent as
  `Authorization: Bearer`. The same token authenticates Socket.io handshakes,
  so a socket is exactly as trusted as an HTTP request.
- **Refresh token**: opaque JWT stored on the user record and returned only in
  an `httpOnly`, `sameSite=strict` cookie; rotated on every refresh, cleared on
  logout.
- **Passwords**: bcrypt (salt rounds 10) via a Mongoose `pre('save')` hook;
  `password` is `select: false` and never serialized.

### Tenancy
- Every query is scoped by `organization_id` taken from the **verified JWT**,
  never from the payload. Another tenant's row resolves to `404`.
- Roles: org-level `SuperAdmin` / `Member` (+`Admin` for job titles) and
  project-scoped `Host` / `Member`, with meeting-level `HOST` / `MODERATOR` /
  `MEMBER` / `VISITOR` participants and per-member capability flags.

### Response contract
- Success: `{ success, statusCode, message, data, timestamp }` (`ApiResponse`).
- Error: `{ success: false, statusCode, message, errors[], timestamp }`
  (`errorHandler`); stack traces are logged, never returned.
- Lists: `{ items, pagination: { page, limit, total, totalPages, hasNextPage,
  hasPreviousPage } }` from a single shared `findPaginated` helper.

### Media & AI (all local, zero API cost)
- **Recordings**: the browser records (max 60 s), fetches a presigned PUT URL,
  uploads **directly to S3-compatible storage** (LocalStack/Floci locally,
  Cloudflare R2 in prod), then `complete()` verifies the object with
  `HeadObject` — the client's declared type/size is never trusted.
- **Post-processing** (`recording-post-processing.service.ts`): FFmpeg extracts
  audio → local Whisper transcribes → local Ollama generates the summary +
  action items. Runs inline today behind a single `runPostProcessing` seam that
  can be swapped for a queue later.
- **Video**: WebRTC peer mesh (Google STUN); Socket.io relays SDP/ICE only —
  media never touches the server.

### Secrets
- No secret ever has a code fallback. `server/src/config/env.ts` reads
  `<NAME>_FILE` (Docker/K8s mount) then `<NAME>` (env var) and **exits on a
  missing value**. Compose mounts `server/secrets/*` (generated by
  `pnpm secrets:generate`, git-ignored) read-only under `/run/secrets`.

---

## Deliberate Deviations from the Original Plan

| Plan proposed | This build uses | Why |
| --- | --- | --- |
| OpenAI / Hugging Face APIs | Local Whisper + Ollama | Zero API cost, privacy, works offline |
| Cloudinary | S3-compatible storage (Floci local → R2 prod) | No vendor lock-in; R2 cheaper |
| Redis | None | No queue or cache needed at this scale |
| Kubernetes + Helm | Docker Compose | Not needed at demo scale (user decision) |
| shadcn/ui | Hand-rolled primitives + Base UI/MUI | Already existed in the repo |

