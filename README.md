# IntellMeet

**AI-Powered Enterprise Meeting & Collaboration Platform**

Real-time video meetings, AI transcription, summaries, action items, and team collaboration — built with the MERN stack.

[Live Demo](https://roviameet.vercel.app) · [Architecture Diagram](https://uswuth.github.io/Rovia/architecture-diagram.html) · [API Docs](https://rovia-u8h1.onrender.com/api/docs)

---

## What It Is

IntellMeet is a production-grade platform that turns meetings into actionable outcomes. Every participant is transcribed on a separate track, the meeting is summarised automatically, and action items are extracted with assignees.

## What It Can Do

- **Real-Time Video Meetings** — WebRTC peer mesh with screen sharing, Q&A, polls, and up to 50+ participants
- **AI Meeting Intelligence** — Per-speaker transcription (Groq Whisper), summaries with action items (OpenRouter)
- **Real-Time Chat** — In-meeting chat, Q&A upvoting, live polls with instant results
- **Post-Meeting Dashboard** — Recording playback, transcript viewer, AI summary card, action item tracking
- **Team & Project Management** — Workspaces, project boards, task assignment, role management
- **Analytics** — Meeting frequency, productivity metrics, engagement reports
- **Server Admin** — Multi-tenant org management, telemetry, security audits

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, React Router 7 |
| UI | Base UI, shadcn-style primitives, MUI, Lucide icons |
| State | TanStack Query, React Hook Form, Zod |
| Backend | Node.js 22, Express 4, TypeScript |
| Database | MongoDB (Mongoose 8, Typegoose) |
| Real-Time | Socket.io 4 + WebRTC peer mesh |
| Storage | S3-compatible (Backblaze B2), presigned URLs |
| AI | FFmpeg + Groq Whisper (STT) + OpenRouter (summary) |
| Auth | JWT + bcryptjs, httpOnly refresh cookie |
| Deployment | Vercel (client) + Render (API) + MongoDB Atlas |
| CI | GitHub Actions |

## Architecture

Interactive diagram: [docs/architecture-diagram.html](./docs/architecture-diagram.html)

Full architecture reference: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)

Technology stack details: [docs/STACK.md](./docs/STACK.md)

## Getting Started

```bash
pnpm install
pnpm dev            # server + client together
pnpm dev:server     # API only
pnpm dev:client     # web client only
pnpm build
pnpm lint
```

Environment configuration: `server/.env.example`

## Docker (Local Services Only)

```bash
pnpm secrets:generate   # writes server/secrets/*.txt (git-ignored)
pnpm docker:up          # starts MongoDB + S3 emulator
pnpm docker:down
```

| URL | Service |
| --- | --- |
| http://localhost:3000 | Web client (nginx, proxies `/api`) |
| http://localhost:5000 | API + Swagger UI (`/api/docs`) |

## API

75 REST operations across 53 documented paths plus 24 typed Socket.io events. Browse the interactive Swagger UI at `GET /api/docs` (non-production).

## License

Zidio Development
