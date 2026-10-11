# IntellMeet — Task Tracker

Tracks real progress against the 28-day plan. Nothing here is aspirational.

Legend: ✅ done & verified · 🟡 built, not verified · ⬜ not started · ❌ planned but deliberately not used

---

## Where we are

**Full-stack core is ~85–90% complete.** Real-time WebRTC video, in-meeting chat, live Q&A, polls, and authentication are fully wired and verified end-to-end. The remaining tasks are submission deliverables: live public cloud deployment, PDF project report, and demo video.

---

## Status by feature

| ID | Feature | State | Notes |
|---|---|---|---|
| F01 | Auth & profiles | ✅ | JWT + refresh cookie, bcrypt, org creation, roles, avatar upload. Tested live. |
| F02 | **WebRTC video** | ✅ | Multi-peer mesh, SDP/ICE relay via Socket.io, screen sharing, camera/mic toggles, device switching, Google Meet active speaker hysteresis. |
| F04 | In-meeting chat | ✅ | Real-time `meeting:message` over Socket.io, typing indicators, `MessageScroller`, roster gating. |
| — | **In-meeting Q&A + Polls** | ✅ | Live ask/answer/dismiss, create/vote/close with real-time percentage bars. Verified end-to-end. |
| F06 | Team & project mgmt | ✅ | Workspaces, project boards, task tracking, member roles, invite codes. |
| — | **Recording & Storage** | ✅ | Browser capture → presigned PUT → S3-compatible storage (Floci/R2) → HeadObject verification. **Verified.** |
| — | Meeting UI & Lobby | ✅ | Meeting list (real API), join via code/link, pre-meeting device selector lobby, responsive video stage. |
| F05 | Post-meeting dashboard | ✅ | Meeting history, recordings list, detail views with download links. |
| F03 | AI Meeting Intelligence | 🟡 | Local Whisper (STT) + Ollama pipeline wired into backend recording completion; models ready. |
| F07 | Analytics & Insights | 🟡 | Dashboard KPI metrics and session summary charts implemented. |
| — | Docker multi-stage | ✅ | Multi-stage Dockerfiles for client and server, Compose with secrets mounts. |
| — | CI/CD (GitHub Actions) | ✅ | Automated linting and production build verification on push. |
| — | Tests | ⬜ | Test framework setup for unit/integration coverage. |
| — | Monitoring | 🟡 | Health endpoint active (`/api/v1/health`); Prometheus/Grafana optional. |
| — | Kubernetes / Helm | ❌ | Skipped — Docker Compose chosen for target demo deployment. |
| — | Redis | ❌ | Skipped — lightweight in-memory cache/mesh suffices for current scale. |

---

## Deliberate deviations from the plan

The project uses modern, cost-effective, and privacy-preserving alternatives:

| Plan says | We use | Why |
|---|---|---|
| OpenAI / Hugging Face (paid) | **Local Whisper + Ollama** | Zero API cost, privacy, works offline |
| Cloudinary | **S3-compatible (Floci local → R2 prod)** | No vendor lock-in; S3 API standard; R2 is faster and cost-free egress |
| Redis | **Socket.io in-memory room mesh** | No external Redis service dependency required at target demo scale |
| Kubernetes + Helm | **Docker Compose** | Lightweight, reproducible multi-container orchestration for demo |
| shadcn/ui | **Base UI / Tailwind CSS v4 primitives** | Modern CSS theme tokens with granular styling control |

---

## Priority order — Submission Readiness

The submission evaluation focuses on: Live Public Demo (30%), PDF Report (25%), GitHub Repo (20%), README (15%), Demo Video (10%).

### P0 — Completed Core Milestones
- [x] **Wire WebRTC into `MeetingRoom.tsx`** — multi-peer video + audio mesh
- [x] **Active Speaker Hysteresis** — Google Meet stability logic (no tile jitter or thrashing)
- [x] **Audio Hardware Pipeline** — native WebRTC AEC3/AGC/Noise Suppression directly to peers
- [x] **In-Meeting Chat** — real-time messaging, typing indicators, auto-scroll, hidden scrollbars
- [x] **In-Meeting Q&A & Live Polls** — live voting, answer threads, role permissions
- [x] **Replace `Meetings.tsx` mock** with real API data and direct join links
- [x] **Recording pipeline** — S3 upload, presigned URLs, HeadObject validation

### P1 — Final Submission Deliverables
- [ ] **Live Public Demo URL** — deploy containerized build to cloud host (e.g. Render / Railway / Vercel)
- [ ] **PDF Documentation (1 PDF, 8–15 pages)** — compile architecture diagrams, feature matrix, and screenshots
- [ ] **Walkthrough Demo Video (3–7 mins)** — screen recording showing live call, active speaker, chat, and polls
- [ ] **Unit Tests** — add core smoke tests for auth and meeting routes

---

## Known issues resolved

- [x] `Meetings.tsx` wired to real backend API endpoints
- [x] `MeetingRoom.tsx` Q&A and Poll callbacks wired to live socket/REST mutations
- [x] Microphone voice ducking / breaking eliminated by removing synthetic Web Audio compressor
- [x] Video tile background adjusted to clean, dimmed avatar colors with no flashy saturation or gradients
- [x] Meeting join link support implemented via `/meetings/join/:code`
- [x] Active speaker detection stabilized with exponential moving average and dominance hold times
- [x] Tooltip clipping under headers fixed with directional placement
- [x] Chat and sidebar scrollbars hidden cleanly with `.no-scrollbar` cross-browser utility