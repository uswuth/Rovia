# IntellMeet — Task Tracker

Tracks real progress against the 28-day plan. Nothing here is aspirational.

Legend: ✅ done & verified · 🟡 built, not verified · ⬜ not started · ❌ planned but deliberately not used

---

## Where we are

**Backend is well ahead of the plan. Frontend is behind. WebRTC and chat are the two big gaps.**

---

## Status by feature

| ID | Feature | State | Notes |
|---|---|---|---|
| F01 | Auth & profiles | ✅ | JWT + refresh cookie, bcrypt, org creation, roles. Tested live. |
| F06 | Team & project mgmt | ✅ | Projects, members, hosts, invite codes. Tested live. |
| — | **Meetings (backend)** | ✅ | Schedule, roster, join modes, per-member mic/cam/screen/chat permissions. **Not runtime-tested.** |
| — | **Q&A + Polls (backend)** | ✅ | Ask/answer/dismiss; create/vote/close. Not runtime-tested. |
| — | **Recording** | ✅ | Browser → presigned PUT → Floci/R2 → HeadObject. **Verified end-to-end.** |
| — | **Local AI pipeline** | 🟡 | FFmpeg + local Whisper + Ollama wired. **Never actually run.** |
| — | Meeting UI | 🟡 | Room + create page built. Video tiles are static. |
| F02 | **WebRTC video** | ❌ | Not started. **This is the critical path.** |
| F04 | In-meeting chat | ⬜ | Deferred by choice. |
| F03 | Live transcription | ⬜ | Blocked on WebRTC. |
| F03 | AI summary | 🟡 | Built, untested. Post-meeting works in design. |
| F05 | Post-meeting dashboard | ⬜ | Not started. |
| F07 | Analytics | ⬜ | Not started. |
| — | Tests | ❌ | **Zero. No test framework installed.** |
| — | CI/CD (GitHub Actions) | ⬜ | Not started. |
| — | Monitoring | ⬜ | Health endpoint exists; no Prometheus/Grafana. |
| — | Rate limiting | ⬜ | Not started. |
| — | Kubernetes / Helm | ❌ | Skipped — user chose Docker Compose only. |
| — | Redis | ❌ | Skipped — no queue/caching needed at this scale. |

---

## Deliberate deviations from the plan

The doc proposes some things this build does **not** use. Worth stating so the deviation looks intentional:

| Plan says | We use | Why |
|---|---|---|
| OpenAI / Hugging Face (paid) | **Local Whisper + Ollama** | Zero API cost, privacy, works offline |
| Cloudinary | **S3-compatible (Floci local → R2 prod)** | No vendor lock-in; R2 is cheaper |
| Redis | **None** | No queue or cache needed for 1-min recordings |
| Kubernetes + Helm | **Docker Compose** | Not needed for the demo scale |
| shadcn/ui | **Hand-rolled primitives** | Already existed in the repo |

---

## Priority order — what actually blocks the demo

The evaluation weighs a **live public demo (30%)**. That changes the order.

### P0 — without these, there is no demo
- [ ] **Wire WebRTC into `MeetingRoom.tsx`** — two tabs, real video + audio
- [ ] **Replace the `Meetings.tsx` mock** with real API data
- [ ] **Link `/meetings/new`** from Meetings and Projects pages
- [ ] **Wire Q&A + Poll mutations** (currently `async () => undefined` stubs)
- [ ] **Run the AI pipeline once** and confirm a real transcript + summary

### P1 — needed for the docs/score
- [ ] **Add tests** — even 30% coverage signals intent
- [ ] **CI workflow** (build + lint + test on push)
- [ ] **README** with architecture diagram + screenshots
- [ ] **Rate limiting** on auth routes
- [ ] **Seed script** so a judge can see data without signing up

### P2 — nice to have
- [ ] Live captions (needs WebRTC first)
- [ ] In-meeting chat
- [ ] Post-meeting dashboard (F05)
- [ ] Analytics (F07)
- [ ] Prometheus + Grafana

---

## Known issues to fix

- [ ] `Meetings.tsx` still uses local state, not the API
- [ ] `MeetingRoom.tsx` Q&A/Poll callbacks are no-op stubs
- [ ] AI pipeline never executed — models never downloaded
- [ ] Meeting/Q&A/Poll backends compile and lint but have **never run**
- [ ] Meeting join from a link has no frontend page yet

---

## Two deadlines, one risk

**The plan lists Day 23 as Kubernetes and Day 15 as OpenAI Whisper — both are now wrong.** This tracker is the source of truth; update it when scope changes.

**Biggest risk: WebRTC.** Everything downstream (live captions, real chat, multi-participant video) is blocked on it. Days 10–14 of the plan assume it lands early; nothing else in the demo matters as much.