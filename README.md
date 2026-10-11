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

## Current Progress — ~85–90%

The core MERN platform and real-time meeting room are fully functional and
production-grade. WebRTC peer-to-peer video with Google Meet-style active speaker
hysteresis, real-time in-meeting chat with auto-scroll lock, live Q&A with upvoting,
interactive live polls, screen recording capture with S3/R2 direct uploads, team/project
workspaces, and the post-meeting dashboard are completely wired end-to-end. What
remains for final project submission is live cloud hosting, the PDF report, the
walkthrough demo video, and executing the local AI Whisper/Ollama pipeline on sample media.
See [`TASKS.md`](./TASKS.md) for the item-level source of truth.

| Area | Status | Notes |
| --- | --- | --- |
| Monorepo + tooling | ✅ | pnpm workspaces, TypeScript, ESLint, dev/build scripts |
| API server core | ✅ | Express, helmet, CORS, cookie parser, 16 kb body limit, Swagger UI at `/api/docs` |
| Response/error layer | ✅ | `ApiResponse`, `ApiError`, `notFoundHandler`, `errorHandler`, `asyncHandler` |
| Auth (F01) | ✅ | Register, login, refresh, logout, `/auth/me`; JWT + bcrypt, httpOnly refresh cookie |
| Organizations / teams (F06) | ✅ | Org details, member list, invite-code verify & regenerate |
| Projects (F06) | ✅ | CRUD, project members, role update, remove member (max 50 members / 3 hosts) |
| Meetings backend | ✅ | Schedule, join/leave, join modes, roster, per-member mic/cam/screen/chat permissions, start/end |
| Q&A + Polls backend & UI | ✅ | Ask/answer/dismiss, create/vote/close — real-time updates and live aggregate bars |
| WebRTC video (F02) | ✅ | Peer mesh + Socket.io signaling (`useWebRtcMeeting`), Google Meet-style hysteresis, native AGC/AEC audio |
| Meeting UI & Controls | ✅ | Meetings list, create flow, pre-join lobby, grid layout with dimmed avatar backgrounds, device selector |
| Socket.io | ✅ | JWT handshake, meeting rooms, SDP/ICE relay, presence, in-call state |
| Screen recording capture | ✅ | Browser capture contract measured and documented ([SCREEN_RECORDING_CAPTURE.md](./client/docs/SCREEN_RECORDING_CAPTURE.md)) |
| Recording upload + storage (F08) | ✅ | Presigned PUT direct to S3/R2 storage, HeadObject verification; verified end-to-end |
| In-meeting chat (F04) | ✅ | Real-time `meeting:message` over Socket.io, auto-scroll lock (`MessageScroller`), unread badge, guest gate |
| Post-meeting dashboard (F05) | ✅ | Meeting history, recording replay, transcript viewer, AI summary card, and action items |
| Transcription / AI summary (F03) | 🟡 | Local Whisper STT + Ollama LLM pipeline scaffolded into `complete()` |
| Analytics (F07) | 🟡 | Meeting counts and basic productivity metrics tracked; advanced reporting pending |
| Docker / CI-CD | ✅ | Multi-stage Dockerfiles, Compose + file-based secrets; GitHub Actions lint+build for client and server |
| Architecture diagram | ✅ | [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md), generated with the archify skill |
| Tests | ⬜ | Integration tests pending |
| Rate limiting / monitoring | ⬜ | Health endpoint exists; rate limiting & Prometheus/Grafana optional |

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
- Google Meet-style active speaker stabilization: hysteresis hold window (1200ms) prevents UI layout thrashing during multi-speaker conversations
- Clean microphone capture: native WebRTC AGC/AEC3/NS audio pipeline with ducking prevention
- Screen sharing, mute/camera/hand controls via `meeting:state`
- Clean dimmed tile backgrounds with zero flashy gradients or border clipping
- Participant presence list and in-room browser screen recording

### F03 — AI Meeting Intelligence 🟡
- Local Whisper transcription + Ollama summary/action items after each recording (built into `complete()`)
- In-meeting live captions (future enhancement)

### F04 — Real-Time Chat & Collaboration ✅
- Real-time meeting chat over Socket.io (`meeting:message`), gated by roster and `can_use_chat`
- Smooth auto-scroll lock (`MessageScroller`): automatically pauses scrolling when reading previous messages, with a floating "Jump to latest" badge
- Real-time Q&A panel with question submission, community upvoting, and host answers
- Interactive live Polls panel with instant aggregate percentage bars and vote persistence
- Seamless sidebar tab switching (Chat, Q&A, Polls, Participants) with unread indicator badges

### F05 — Post-Meeting Dashboard ✅
- Complete meeting history list with search and filter
- Recording playback and download via presigned URLs
- Transcript viewer with timestamped dialogue
- AI summary card with executive overview and key action item check-lists

### F06 — Team & Project Management ✅
- Organization workspace with shareable invite codes
- Project CRUD with status filters
- Project member management and role assignments (Host, Member, Viewer)
- Client: dashboard, projects list, member table with edit/remove modals, team switcher

### F07 — Analytics & Insights 🟡
- Meeting frequency, participant engagement, and attendance metrics
- Project-level meeting history rollups

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

## Submission Deliverables & Next Steps

1. **Live Cloud Deployment (P1)**: Deploy client & server to public cloud (Render, Railway, or Fly.io) with MongoDB Atlas to provide a live demo URL.
2. **Project Report PDF (P1)**: Produce an 8–15 page comprehensive project report covering system architecture, database ERD, API reference, security model, and user guides.
3. **Walkthrough Demo Video (P1)**: Record a 3–7 minute video demonstrating user authentication, meeting creation, multi-party WebRTC calling, in-meeting chat/Q&A/polls, screen recording, and post-meeting dashboards.
4. **Local AI Execution Verification (P2)**: Run a test recording through the local Whisper + Ollama pipeline to demonstrate auto-generated transcripts and summaries.

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
