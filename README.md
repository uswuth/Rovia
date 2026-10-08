# Intellmeet

AI-Powered Enterprise Meeting & Collaboration Platform

> Progress-tracked README: what the product is, the feature list, and how much of it is implemented today.
>
> - All commands and their purpose: [`commands.md`](./commands.md)
> - Live progress tracker (source of truth): [`TASKS.md`](./TASKS.md)
> - Full API surface with JSON examples: [`docs/API_ROUTES.md`](./docs/API_ROUTES.md)
> - Technology stack and design choices: [`docs/STACK.md`](./docs/STACK.md)
> - Architecture diagram (archify-generated) and flows: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
> - Codebase quality audit, scorecard and fix roadmap: [`CODE_AUDIT.md`](./CODE_AUDIT.md)

---

## Status Legend

| Icon | Meaning |
| --- | --- |
| ✅ | Implemented and wired end-to-end |
| 🟡 | Partially implemented (UI or scaffolding only) |
| ⬜ | Not started |

---

## Current Progress — ~60%

The backend is essentially complete (auth, orgs, projects, meetings, Q&A,
polls, recordings, transcripts/summaries — all wired to the client). WebRTC
video is built and wired into the meeting room, recordings are verified
end-to-end, and CI runs lint + build on every push. What remains: running the
local AI pipeline for real, the post-meeting dashboard,
analytics, tests and rate limiting. See [`TASKS.md`](./TASKS.md) for the
item-level tracker — it is the source of truth when this table and it disagree.

| Area | Status | Notes |
| --- | --- | --- |
| Monorepo + tooling | ✅ | pnpm workspaces, TypeScript, ESLint, dev/build scripts |
| API server core | ✅ | Express, helmet, CORS, cookie parser, 16 kb body limit, Swagger UI at `/api/docs` |
| Response/error layer | ✅ | `ApiResponse`, `ApiError`, `notFoundHandler`, `errorHandler`, `asyncHandler` |
| Auth (F01) | ✅ | Register, login, refresh, logout, `/auth/me`; JWT + bcrypt, httpOnly refresh cookie |
| Organizations / teams (F06) | ✅ | Org details, member list, invite-code verify & regenerate |
| Projects (F06) | ✅ | CRUD, project members, role update, remove member (max 50 members / 3 hosts) |
| Meetings backend | ✅ | Schedule, join/leave, join modes, roster, per-member mic/cam/screen/chat permissions, start/end |
| Q&A + Polls backend | ✅ | Ask/answer/dismiss, create/vote/close — wired to the meeting room UI |
| WebRTC video (F02) | ✅ | Peer mesh + Socket.io signaling relay (`useWebRtcMeeting`), wired into `MeetingRoom.tsx` |
| Meeting UI | ✅ | Meetings list (real API), create page, lobby, room with video tiles |
| Socket.io | ✅ | JWT handshake, meeting rooms, SDP/ICE relay, presence, in-call state |
| Screen recording capture | ✅ | Browser capture contract measured and documented ([client/docs/SCREEN_RECORDING_CAPTURE.md](./client/docs/SCREEN_RECORDING_CAPTURE.md)) |
| Recording upload + storage (F08) | ✅ | Presigned PUT direct to S3-compatible storage, HeadObject verification; **verified end-to-end** |
| Transcription / AI summary (F03) | 🟡 | FFmpeg → local Whisper → Ollama pipeline built and wired into `complete()` — **never actually executed** |
| In-meeting chat (F04) | ✅ | Real-time `meeting:message` over Socket.io (roster + `can_use_chat` gated); Chat, Q&A and Polls panels side by side |
| Post-meeting dashboard (F05) | 🟡 | Meetings list + transcript/summary endpoints exist; summaries/action items not surfaced yet |
| Analytics (F07) | ⬜ | Not started |
| Docker / CI-CD | ✅ | Multi-stage Dockerfiles, Compose + file-based secrets; GitHub Actions lint+build for client and server |
| Architecture diagram | ✅ | [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md), generated with the archify skill |
| Tests | ⬜ | None yet — no test framework installed |
| Rate limiting / monitoring | ⬜ | Health endpoint exists; no rate limit, Prometheus/Grafana |

---

## Features

### F01 — Authentication & Profiles ✅
- Signup, login, token refresh, logout
- Password hashing with `bcryptjs`
- Access token + rotating refresh token in an `httpOnly`, `sameSite=strict` cookie
- Protected route middleware and `GET /api/v1/auth/me`
- Client: `AuthContext`, zod-validated Login/Signup forms, protected/guest route guards

### F02 — Real-Time Video Meetings ✅
- WebRTC peer mesh with Socket.io signaling (`useWebRtcMeeting`, SDP/ICE relay)
- Screen sharing, mute/camera/hand controls via `meeting:state`
- Participant presence list; browser recording capture in the room

### F03 — AI Meeting Intelligence 🟡
- Local Whisper transcript + Ollama summary/action items after each recording (built into `complete()` — not yet executed for real)
- Live in-meeting captions — not started

### F04 — Real-Time Chat & Collaboration ✅
- Real-time meeting chat over the existing Socket.io connection (`meeting:message`), re-checked against the roster and `can_use_chat` on every send
- Chat, Q&A and Polls panels side by side in the meeting room; visitors get a sign-in prompt for chat

### F05 — Post-Meeting Dashboard 🟡
- Meetings history in the client; transcript/summary REST endpoints exist
- Summaries, action items, searchable history and export — not surfaced yet

### F06 — Team & Project Management ✅
- Organization workspace with invite codes
- Project CRUD with status filters
- Project member management and roles
- Client: dashboard, projects list, member table with edit/remove modals, team switcher

### F07 — Analytics & Insights ⬜
- Meeting frequency and productivity metrics
- Exportable reports

### Platform / Cross-cutting ✅
- OpenAPI + Swagger UI documentation
- Health checks (`/api/v1/health`, legacy `/api/health`)
- Centralized logging, typed socket event contracts, tolerant JSON parser in dev
- Light/dark theme, responsive sidebar layout, reusable UI primitives

---

## Implemented API Surface

57 REST endpoints + 8 Socket.io events across system/health, auth,
organizations, job titles, projects, meetings (with Q&A and polls), and
recordings (with transcript/summary). The full route index with verified JSON
request/response examples lives in **[`docs/API_ROUTES.md`](./docs/API_ROUTES.md)**;
interactive Swagger UI at `GET /api/docs`.

```
GET    /api/v1/health · /api/v1/health/ready
POST   /api/v1/auth/{signup,login,refresh-token,logout} · GET /api/v1/auth/me
GET    /api/v1/organizations/{me,members,invite/:code} · POST .../invite/regenerate
GET    /api/v1/job-titles · POST/PUT/DELETE /api/v1/job-titles[/:id] · POST .../assign
POST/GET/PATCH/DELETE /api/v1/projects[/:id] · /projects/:id/members[/:userId[/role]]
GET    /api/v1/meetings/join/:code · POST/GET /api/v1/meetings · GET /meetings/:id
POST   /api/v1/meetings/:id/{join,leave,participants,participant-settings,start,end}
POST/GET /api/v1/meetings/:id/questions[...] · /meetings/:id/polls[...]
POST/GET/DELETE /api/v1/recordings[/:id] · .../{upload-url,complete,download-url,transcript,summary}
```

---

## Next Up
1. Run the local AI pipeline (FFmpeg → Whisper → Ollama) once end-to-end and confirm a real transcript + summary
2. Surface transcripts, summaries and action items on the post-meeting dashboard (F05)
3. In-meeting chat (F04) and live captions (F03)
4. Tests (even 30% coverage) and rate limiting on auth routes
5. Analytics (F07) and Prometheus/Grafana observability
6. Seed script so a judge can see data without signing up

---

## Tech Stack

Full table with pinned versions, design choices and deliberate deviations from
the original plan: **[`docs/STACK.md`](./docs/STACK.md)**.

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, React Router 7, TanStack Query |
| UI | Base UI / shadcn-style primitives, MUI, Lucide icons |
| Forms & Validation | React Hook Form, Zod |
| Backend | Node.js 22, Express 4, TypeScript |
| Database | MongoDB (Mongoose 8, Typegoose) |
| Real-Time | Socket.io 4 (typed events) + WebRTC peer mesh |
| Storage | S3-compatible via AWS SDK v3 (LocalStack/Floci → R2), presigned URLs |
| AI (local) | FFmpeg + Whisper (STT) + Ollama (LLM) — no external AI APIs |
| Auth | JWT + bcryptjs (access in body, refresh in httpOnly cookie) |
| Docs | Swagger / OpenAPI, Bruno collection |
| Tooling | pnpm workspaces, Docker Compose, GitHub Actions CI |

---

## Getting Started

```bash
pnpm install
pnpm dev            # server + client together
pnpm dev:server     # API only
pnpm dev:client     # web client only
pnpm build
pnpm lint
pnpm openapi        # dump OpenAPI spec
```

Environment configuration lives in `server/src/config/env.ts` (see `.env.example`).

---

## Docker

```bash
pnpm secrets:generate   # writes server/secrets/*.txt (git-ignored)
pnpm docker:up          # builds and starts client + server + mongo
pnpm docker:logs
pnpm docker:down

pnpm docker:tools       # also starts mongo-express (8081) and the S3 emulator (4566)
```

| URL | Service |
| --- | --- |
| http://localhost:3000 | Web client (nginx, proxies `/api` to the server) |
| http://localhost:5000 | API + Swagger UI (`/api/docs`) |
| http://localhost:8081 | MongoDB UI (optional profile) |

**Images**
- `server/Dockerfile` — build TypeScript, then run `dist/server.js` on Node 22 Alpine as a non-root user with a healthcheck on `/api/v1/health`
- `client/Dockerfile` — build the Vite bundle, serve it from `nginx:alpine` with SPA fallback, immutable asset caching and a WebSocket-capable `/api` reverse proxy

**Compose files**
- `docker-compose.yml` (root) — full stack: client, server, MongoDB, plus optional `tools` profile
- `server/docker-compose.yml` — server + MongoDB only

**Secrets**
Credentials are never passed as plain environment values and never baked into an
image. Compose mounts them as read-only files under `/run/secrets`, and
`server/src/config/env.ts` reads each value from `<NAME>_FILE` first, then falls
back to `<NAME>`. There are **no default secret values in code** — a missing
`MONGO_URI`, `JWT_ACCESS_SECRET`, or `JWT_REFRESH_SECRET` stops the server with a
clear error instead of running on a known key. See `server/secrets/README.md`.

**Build config**
`VITE_API_BASE_URL` is a public build-time variable, not a secret. Compose defaults
it to `/api/v1` so the client calls the nginx proxy on its own origin; override it
in `.env` when the API lives on a different host.


---

Zidio Development
