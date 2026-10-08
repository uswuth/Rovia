# IntellMeet — Codebase Quality Audit & Scorecard

> Senior-level review of the **current codebase** (rev `319b3ef`, branch `rovia-test`).
> Scope: `server/src/**`, `client/src/**` — classic bugs, edge cases, hardcoded values,
> abstraction leaks, and error-flow quality in both server and client flows.
> Method: static review of every service, route, middleware, socket handler, and the
> client auth/API/RTC layers. No runtime tests were executed for this pass.
>
> Severity: **P0** blocker · **P1** high · **P2** medium · **P3** low/polish.

---

## 1. Scorecard

| # | Category | Score | Grade | Verdict |
| --- | --- | --- | --- | --- |
| 1 | Backend architecture & tenancy | 8.0 | B+ | Consistent service/controller/route layering; every lookup tenant-scoped |
| 2 | Abstraction & code design | 8.5 | B+ | Storage/AI pipelines behind interfaces; pagination & scope helpers reused everywhere |
| 3 | Server error handling | 7.5 | B | Central `errorHandler` + `asyncHandler` everywhere; CastError/CORS gaps remain |
| 4 | Client error handling (UX) | 7.0 | B- | `parseApiError`, `role="alert"`, refresh queue; silent swallows and hangs remain |
| 5 | Auth & session | 6.0 | C | Solid JWT+bcrypt+httpOnly design, but **signup never issues the refresh cookie** |
| 6 | Security | 6.0 | C | Secrets/helmet/cookies good; **no rate limiting**, public roster leak, regex injection |
| 7 | Real-time / WebRTC | 4.0 | D | Presence & roster checks good; **signalling relay targets a room nobody joins (P0)** |
| 8 | Validation & edge cases | 7.0 | B- | Strong input validation; races (join, slug), ReDoS, unguarded `JSON.parse` remain |
| 9 | Hardcoded / configuration | 7.0 | B- | Env-driven core; ICE server, dev URL fallbacks, token key hardcoded in client |
| 10 | Testing & verification | 2.0 | F | No unit/integration/E2E tests in the repo (only `tsc` + eslint in CI) |
| 11 | Documentation | 9.0 | A | README/commands/API_ROUTES/STACK/ARCHITECTURE accurate and current |
| | **Overall** | **6.7/10** | **C+** | ~60% feature coverage, but the shipped core (RTC signalling, signup refresh) has blockers |

---

## 2. What we already cover (verified solid)

### Server
- ✅ Uniform envelope `{ success, message, data, meta?, errors? }`; `asyncHandler` on every async route; central `notFoundHandler` + `errorHandler` with stack-trace sanitization and Mongoose validation / duplicate-key / JSON-syntax mapping.
- ✅ Secrets never defaulted (`config/env.ts` `resolveSecret`, `process.exit` on missing, `_FILE` mount support); `helmet`, credentials CORS, 16 kb body limit.
- ✅ Tenancy discipline: `requireOrganizationId` guard + scoped finders (`findScopedRecording`, `findScopedMeeting`) — id-alone never grants access.
- ✅ Authorization: host/moderator gates (`assertCanManageMeeting`), project-roster checks for participants, SuperAdmin bypasses explicit, per-participant capability flags, invite-only join enforcement.
- ✅ Auth hygiene: `password` and `refresh_token` are `select: false`; `toJSON` transform strips them; refresh cookie `httpOnly + sameSite: strict + secure` in prod; refresh rotation on every refresh.
- ✅ Pagination clamped (`page≥1`, `limit≤100`, malformed → defaults); shared `findPaginated` so list shapes cannot drift.
- ✅ Recording pipeline: private bucket + short-lived presigned URLs, `HeadObject`-authoritative `complete()`, MIME allowlist, pending-upload cap, soft delete with lifecycle timestamps.
- ✅ AI post-processing: extractor/transcriber/summarizer injected via interfaces, per-stage failure isolation (own record → FAILED, earlier success preserved), temp files cleaned in `finally`.
- ✅ Socket handshake verifies the same JWT as REST; meeting-room join re-checks org + roster.

### Client
- ✅ Single Axios instance with Bearer injection, **single-flight refresh with request queue**, `_retry` guard, auth-endpoint exclusions.
- ✅ TanStack Query envelope unwrapping in one place (`useApi`), sane defaults (`retry: 1`, `staleTime 30s`, `gcTime 5m`).
- ✅ `parseApiError` maps network failure / 5xx / field errors to human messages; `AuthContext` derives signed-out state from query error with single-clear ref (no cascading renders).
- ✅ Consistent `role="alert"` inline errors in forms, modals, Q&A and polls; guest session state in `sessionStorage` (not `localStorage`).
- ✅ WebRTC hook: single initiator rule avoids glare, tracks added before offer, cleanup stops tracks/closes peers/disconnects socket on unmount.

---

## 3. Findings — change needed

### P0 / P1 — fix before any demo or release

| ID | Sev | Finding (bug / edge / hardcoded) | Where | Suggested change | Change needed |
| --- | --- | --- | --- | --- | --- |
| F-01 | **P0** | **WebRTC signals are relayed to a room that never exists.** Client sends `to: <userId>` for offer/answer/ICE, server relays with `io.to(payload.to)`, but sockets only ever join `meeting:<id>` — there is no per-user room join anywhere. SDP/ICE are never delivered → peer tiles appear but **no media ever flows** (F02 cannot work at runtime as written). | `server/src/socket/socket.ts` (relay ~L115-126, join ~L97) · `client/src/hooks/useWebRtcMeeting.ts` L80, L98, L163 | After identity resolution do `socket.join(\`user:${userId}\`)`, and relay to `io.to(\`user:${payload.to}\`)`. Alternatively keep a `userId → socketId` map. Add a 2-device smoke test so this can never silently regress again. | ✅ Yes |
| F-02 | **P1** | **Signup never issues the refresh cookie.** `loginUser` sets the httpOnly cookie; `registerUser` does not, and `registerUserService` never returns a refreshToken. A user who signs up (and never logs in again) gets a 401 from `/auth/refresh-token` the moment the access token expires (15 min in prod) → forced logout. | `server/src/controllers/auth.controller.ts` L16-25 · `server/src/services/auth.service.ts` (both register cases) | Return `refreshToken` from the register service and `res.cookie(...)` it with the same options as login. | ✅ Yes |
| F-03 | **P1** | **Refresh failure hangs queued requests forever.** In the 401 interceptor, requests parked in `refreshQueue` are dropped (`refreshQueue = []`) on refresh error but their Promises are never rejected → UI spinners never resolve, no error ever surfaces. | `client/src/api/client.ts` L54-79 | Queue `{resolve, reject}` and reject all entries with the refresh error (then let `AuthContext` clear the session / show "session expired"). | ✅ Yes |
| F-04 | **P1** | **Public meeting preview leaks the full roster.** `GET /meetings/join/:code` runs *before* `authenticateUser` and returns every participant's `userId`, role, capability flags and join/leave timestamps to anyone holding the link — no auth, no org scope. Violates the stated invariant "a join code alone never grants access". | `server/src/routes/meeting.routes.ts` L25-42 · `server/src/services/meeting.service.ts` L257-286 | Public payload = `{title, description, status, scheduledAt, duration, joinMode, participantCount, participantLimit}` only. Roster detail only for authenticated org members via the normal detail endpoint. | ✅ Yes |
| F-05 | **P1** | **Regex injection / ReDoS.** `getMeetingsService` builds `new RegExp(userInput, 'i')` unescaped → a search of `(` throws (500), nested quantifiers can hang the event loop, and wildcards let any member probe join codes. Same pattern in job-title duplicate check (`^${title}$` unescaped → `.*` bypass, `(` → 500). | `server/src/services/meeting.service.ts` L240-247 · `server/src/services/job-title.service.ts` L20 | Add `escapeRegExp()`, cap input length (e.g. 100 chars); prefer a Mongo text index for the meeting search long term. | ✅ Yes |
| F-06 | **P1** | **Anonymous visitor in the meeting room can never connect, and hangs silently.** Socket handshake requires a JWT and disconnects token-less clients, yet `MeetingRoom` enables RTC for `isVisitor` sessions. No ack timeout exists, so a visitor sits on `status: 'connecting'` forever with no error. | `server/src/socket/socket.ts` L63-69 · `client/src/pages/meetings/MeetingRoom.tsx` L177 · `client/src/hooks/useWebRtcMeeting.ts` L180-188 | Either add a server-side *spectator* role (view-only, no emit rights) or disable RTC for visitors and render an explicit "view-only mode" state. Also add a 10 s join-ack timeout → `status:'failed'` with message. | ✅ Yes |
| F-07 | **P1** | **Unguarded `JSON.parse` during render crashes the room.** `sessionStorage.getItem(...)` is parsed without try/catch — one corrupted byte → white screen of the meeting room. | `client/src/pages/meetings/MeetingRoom.tsx` L114-115 | Wrap in try/catch → treat as `null` (and clear the bad key). | ✅ Yes |



### P2 — medium (correctness, concurrency, graceful-error gaps)

| ID | Sev | Finding | Where | Suggested change | Change needed |
| --- | --- | --- | --- | --- | --- |
| F-08 | P2 | **Signal relay has no authorization.** Relays never check that sender and target are in the same meeting room, and `meeting:state` is broadcast without membership check → any authenticated user can inject SDP/ICE toward any user id or spoof mute/screen state into any meeting. | `server/src/socket/socket.ts` L115-135 | Require `socket.data.meetingId === payload.meetingId`, verify target is on that meeting's roster, reject otherwise. | ✅ Yes |
| F-09 | P2 | **Refresh rotation is single-slot.** One `refresh_token` field: a second device's refresh logs out the first, and a *stolen* token presents no reuse detection (no session family/jti). | `server/src/services/auth.service.ts` L172-199 | Per-device sessions (`jti` list or `sessions[]` subdocs); on reuse of a rotated token, revoke the whole family. | ✅ Yes |
| F-10 | P2 | **`JWT_ACCESS_EXPIRY` defaults to `24h`** while docs/compose say 15 min — a dev server mints day-long tokens, and logout only clears the refresh token, so a copied access token stays valid until expiry. | `server/src/config/env.ts` L85 · `auth.service.ts` L201-205 | Default `15m` (compose already sets it); document that logout does not revoke access tokens (stateless JWT limitation). | ✅ Yes |
| F-11 | P2 | **Join race can exceed the participant limit.** `joinMeetingService` does check-then-`save()` — two concurrent joins both read the same array; Mongoose writes both, last one wins, limit can be passed or a join silently lost. Same pattern in `addMeetingParticipantsService`. | `server/src/services/meeting.service.ts` L296-330, L352-384 | Atomic conditional update (`findOneAndUpdate` with `$expr: {$lt: [{$size: ...}, limit]}`) or enable `optimisticConcurrency` on the Meeting schema. | ✅ Yes |
| F-12 | P2 | **Signup org creation is not atomic + slug collision handled once.** User is saved before `Organization.create` (org failure → orphan user without org, retry then hits "email exists"); slug suffix is a single random attempt (repeat collision → 500 dup-key). | `server/src/services/auth.service.ts` L34-92 | Wrap in a transaction (replica set) or compensating delete; loop slug suffix generation until free (with cap). | ✅ Yes |
| F-13 | P2 | **ICE/SDP async races on the client.** Socket `async` handlers are not serialized: an ICE candidate can be processed before `setRemoteDescription` finishes → `addIceCandidate` throws, candidate lost; no try/catch → unhandled rejections. | `client/src/hooks/useWebRtcMeeting.ts` L158-178 | Buffer remote candidates until the remote description is set; wrap all handlers in try/catch. | ✅ Yes |
| F-14 | P2 | **`meeting:state` handler overwrites missing flags with defaults.** An event carrying only `audioEnabled` resets that peer's `videoEnabled → true` / `screenSharing → false`, corrupting the UI badges. | `client/src/hooks/useWebRtcMeeting.ts` L150-156 | Merge only the keys present in `state` (build patch conditionally). | ✅ Yes |
| F-15 | P2 | **Socket reconnect reuses a stale JWT.** `getMeetingSocket()` captures the token once at creation; when it expires (15 min) Socket.IO's automatic reconnect fails the handshake silently → connection dies mid-meeting with no user message. | `client/src/api/meeting/meeting-socket.ts` L16-25 | Pass `auth` as a callback (or refresh `socket.auth` before `connect()`), listen for `disconnect` and surface a reconnection banner. | ✅ Yes |
| F-16 | P2 | **Q&A and poll actions swallow errors.** `handleAskQuestion` / `handleAnswerQuestion` / `handleDismissQuestion` / `handleCreatePoll` use `try/finally` without `catch` → a 403/500 becomes an unhandled rejection; the user sees no feedback at all. | `client/src/pages/meetings/MeetingRoom.tsx` L283-320 | Add `catch (err) { showToast(parseApiError(err).message) }` (graceful server-flow message per client AGENTS.md §10). | ✅ Yes |
| F-17 | P2 | **Error-mapping gaps in `errorHandler`.** No `CastError` branch → a malformed ObjectId that slips past `assertObjectId` returns **500** instead of 400; CORS rejection is passed as `callback(new Error(...))` → surfaces as 500, not 403. | `server/src/middlewares/errorHandler.ts` · `server/src/config/cors.ts` L32 | Add `err.name === 'CastError'` → 400 with field name; return `callback(null, false)` (or map the CORS error to a 403 ApiError). | ✅ Yes |
| F-18 | P2 | **No rate limiting anywhere.** `/auth/login`, `/auth/refresh-token`, `/auth/signup`, and the public `/meetings/join/:code` preview are open to credential brute force and join-code enumeration. | `server/src/app.ts` (no `express-rate-limit`) | Global limiter (e.g. 100 req/15 min/ip) + strict auth limiter (e.g. 10/15 min) and preview limiter; return `Retry-After`. | ✅ Yes |
| F-19 | P2 | **`showToast` leaks timers.** `setTimeout` is never cleared on unmount → `setState` after unmount warnings and stale toasts. | `client/src/pages/meetings/MeetingRoom.tsx` L148-151 | Store the timer in a ref, clear in a `useEffect` cleanup. | ⚠️ Optional |

### P3 — low / polish

| ID | Sev | Finding | Where | Suggested change | Change needed |
| --- | --- | --- | --- | --- | --- |
| F-20 | P3 | **Email regex rejects valid addresses.** `(\.\w{2,3})+$` allows only 2–3 letter TLDs → `user@company.info` / `.museum` are rejected with 400 at signup. | `server/src/models/user.model.ts` L69 | Use a modern pattern (or just `zod`/validator `isEmail`) allowing TLD ≥ 2. | ✅ Yes |
| F-21 | P3 | **ICE servers hardcoded, no TURN.** Single Google STUN constant; no env override, no TURN → peers behind symmetric NAT can never connect, and the value is unconfigurable per environment. | `client/src/hooks/useWebRtcMeeting.ts` L5 | Read `VITE_ICE_SERVERS` (JSON) with this as dev default; plan TURN with short-lived credentials served by the API. | ✅ Yes |
| F-22 | P3 | **Socket URL ignores API base config.** `io('/')` hardcodes same-origin, while REST honours `VITE_API_BASE_URL` — deployments with a separate API origin break signalling only. Also the storage key `intellmeet_token` is a magic string. | `client/src/api/meeting/meeting-socket.ts` L20 · `client/src/api/client.ts` L4 | Derive socket URL from the same base-URL helper; export a `TOKEN_STORAGE_KEY` constant. | ✅ Yes |
| F-23 | P3 | **Dev fallbacks leak into prod config paths.** `CLIENT_URL \|\| 'http://localhost:5173'` in the join redirect; Swagger server URL is localhost; `CORS_ORIGIN` unset → `cors.ts` silently falls back to the localhost allowlist **in production** instead of failing fast. | `server/src/routes/meeting.routes.ts` L29 · `server/src/config/swagger.ts` L24-27 · `server/src/config/cors.ts` L4-17 | In production, require `CLIENT_URL` and `CORS_ORIGIN` (exit like other required config); keep localhost fallbacks dev-only. | ✅ Yes |
| F-24 | P3 | **Stale comment + unvalidated `meetingId`.** "no Meeting collection exists yet" is false (Meeting model exists); recording creation validates `meetingId` only as an id, never against the tenant's meetings → recordings can point at nonexistent meetings. | `server/src/services/recording.service.ts` L66-70 | Resolve the meeting scoped to the org (404 if absent) or explicitly document the opaque-link design and fix the comment. | ✅ Yes |
| F-25 | P3 | **Double query on recording detail.** Scoped existence check, then a second *unscoped* `findById` for population — two round trips and a needless pattern (the file's own rule says unscoped `findById` should never appear). | `server/src/services/recording.service.ts` L209-219 | Populate inside the scoped `findOne` and return it. | ⚠️ Optional |
| F-26 | P3 | **Optional-org lookup helper is a footgun.** `findScopedMeetingByJoinCode(joinCode, organizationId?)` silently drops tenant scoping when called without an org; only the public preview relies on that today. | `server/src/services/meeting.service.ts` L50-63 | Split into `findGlobalByJoinCode` (explicitly public) and `findScopedByJoinCode` (org required). | ⚠️ Optional |
| F-27 | P3 | **Envelope contract drift:** `ApiError` carries `errorCode`, but `errorHandler`'s response never emits it — clients cannot rely on the documented field. | `server/src/utils/apiError.ts` · `server/src/middlewares/errorHandler.ts` L51-57 | Emit `errorCode` in the error envelope (or drop it from the contract/docs). | ⚠️ Optional |
| F-28 | P3 | **Interceptor auth-endpoint detection by substring.** `url.includes('/auth/login')` etc. — brittle (matches any URL containing the string; misses `/auth/logout` semantics). | `client/src/api/client.ts` L46-49 | Match on exact path (`config.url === '/auth/login'`) or an explicit flag per request (`skipAuthRefresh`). | ⚠️ Optional |
| F-29 | P3 | **Meeting search also regex-matches `meeting_join_code`** — within-tenant, but lets any member wildcard-probe codes via search (compounds F-05). | `server/src/services/meeting.service.ts` L244 | After escaping (F-05), consider dropping join-code from the searchable fields. | ⚠️ Optional |
| F-30 | P3 | **No meeting lifecycle worker.** `MEETING_MAX_DURATION_MINUTES` and `meeting_scheduled_at` exist, but nothing ever auto-ends an over-running meeting or flips SCHEDULED → MISSED; expired recordings are never swept despite `recording_expires_at`. | `server/src/services/meeting.service.ts` · `server/src/models/recording.model.ts` | Add a lightweight interval sweeper now; move to a real queue/cron with F12 of the roadmap. | ✅ Yes (roadmap) |



---

## 4. Hardcoded / non-dynamic inventory

| Value | Location | Status | Suggested change |
| --- | --- | --- | --- |
| `stun:stun.l.google.com:19302` | `client/src/hooks/useWebRtcMeeting.ts:5` | ⚠️ Change needed | Env-driven `VITE_ICE_SERVERS`; add TURN |
| `io('/')` socket origin | `client/src/api/meeting/meeting-socket.ts:20` | ⚠️ Change needed | Derive from the shared API base URL |
| `'intellmeet_token'` storage key | `client/src/api/client.ts:4,10` | ⚠️ Change needed | Named constant (shared with AuthContext) |
| `'http://localhost:5173'` join redirect fallback | `server/src/routes/meeting.routes.ts:29` | ⚠️ Change needed | Require `CLIENT_URL` in production |
| CORS fallback → localhost allowlist | `server/src/config/cors.ts:11-16` | ⚠️ Change needed | Fail fast in production when `CORS_ORIGIN` empty |
| `JWT_ACCESS_EXPIRY \|\| '24h'` | `server/src/config/env.ts:85` | ⚠️ Change needed | Default `15m` to match docs/compose |
| Swagger `http://localhost:${PORT}` | `server/src/config/swagger.ts:26` | ⚠️ Dev-only | Set server URL from `CLIENT_URL` in production |
| `AWS_ENDPOINT_URL \|\| localhost:4566`, bucket `\|\| 'intellmeet-bucket'` | `server/src/config/env.ts:93-99` | ✅ Acceptable | Non-secret defaults are documented; required in prod by convention — consider a prod assertion |
| `WHISPER/OLLAMA` docker hostnames & model sizes | `server/src/config/env.ts:104-113` | ✅ Acceptable | Deliberate compose defaults, fully overridable |
| `'Visitor'`, `pId.slice(-4)` display heuristics, `meeting_guest_${id}` key | `client/src/pages/meetings/MeetingRoom.tsx:114-174` | ⚠️ Minor | Fine for now; centralise guest-session helper |
| Bruno/floci emulator credentials (`test`) | `server/floci/browser/index.html` | ✅ Acceptable | Explicitly emulator-only, never deployed |

---

## 5. Error-flow assessment (graceful degradation)

### Server flow — grade B-
- ✅ Every async route goes through `asyncHandler` → central `errorHandler`; responses never leak stacks; field-level `errors[]` enables per-field UI.
- ✅ Domain errors thrown as `ApiError` with correct 400/401/403/404/503 semantics; AI providers map to 503/500 with logged context.
- ❌ Gaps: `CastError` → 500 (F-17), CORS error → 500 (F-17), `errorCode` never emitted (F-27), no rate-limit 429s at all (F-18), socket handlers ACK errors but REST-equivalent socket actions do not.
- ❌ Multi-step writes (signup→org, join→save) have no transaction/rollback story (F-11, F-12).

### Client flow — grade B-
- ✅ `parseApiError` covers network / 5xx / validation with `role="alert"` rendering; react-query retries once with backoff; mutations don't retry.
- ✅ Refresh flow single-axes concurrency correctly *on success*; AuthContext cleans session on dead profile exactly once.
- ❌ Gaps: refresh failure hangs the queue (F-03) and never tells the user "session expired"; Q&A/poll failures are silent (F-16); RTC join failure/timeout shows a permanent spinner (F-06); visitor `JSON.parse` can crash the route (F-07).

---

## 6. Recommended fix order (current codebase, before new features)

| Wave | Items | Effort | Why first |
| --- | --- | --- | --- |
| Wave 1 — blockers | F-01 (relay rooms), F-02 (signup cookie), F-03 (queue hang), F-06 + F-07 (visitor/room crash) | Small (each is a few lines) | Core flows are broken at runtime today |
| Wave 2 — security | F-04 (roster leak), F-05 (ReDoS), F-18 (rate limits), F-08 (relay authz), F-10 (token expiry default) | Small–medium | Exploitable without auth effort |
| Wave 3 — correctness | F-09, F-11, F-12, F-13, F-14, F-15, F-16, F-17 | Medium | Race/lifecycle hardening |
| Wave 4 — polish | F-19 … F-30 | Small | Cleanup + roadmap items |

---

## 7. Future implementation list (not yet in codebase)

1. **In-meeting real-time chat** over Socket.io (roster-gated, `can_use_chat` enforced) — F03 half-done.
2. **Post-meeting dashboard** — recording player, transcript, AI summary, action items (F04 ⬜).
3. **Execute the local AI pipeline for real** (Whisper + Ollama) and evaluate output quality; add prompt versioning.
4. **TURN server + ICE env config** and SFU migration path (mediasoup/LiveKit) when > ~8 peers (mesh caps out).
5. **Recording lifecycle worker**: auto-end over-running meetings, sweep `recording_expires_at`, retry FAILED post-processing, move inline `runPostProcessing` to a queue (design already queue-ready).
6. **Session management UI** ("active devices", revoke session) on top of F-09 per-device tokens.
7. **Observability**: request ids, structured audit log for authz decisions, `/metrics`, error alerting.
8. **Test suite**: unit tests for services (auth, meeting join races, recording states), socket integration tests, Playwright E2E for signup→join→record; this is the single biggest scorecard gap (2/10).
9. **Analytics & org dashboard** (F11/F12/F13/F14 of the 28-day plan).
10. **i18n, dark/light parity, accessibility pass, meeting hand raise/reactions, waiting room, breakout rooms** — product-tier features beyond current scope.

---

## 8. Verification & limitations of this audit

- Static review only: every file referenced above was read at rev `319b3ef`; no server was started and no runtime repro was executed for this pass (`pnpm lint` / `pnpm build` were green as of the previous documentation pass).
- **F-01 is verified by code path, not by execution** — the fix is one join line, but please confirm with a two-device/tab media test before and after.
- Not reviewed in depth (low risk, pattern-identical to reviewed code): `organization.service.ts`, `meeting-qa.service.ts`, `meeting-poll.service.ts`, dashboard presentation components.
- Counts: **30 findings — 7 P0/P1, 12 P2, 11 P3**; **24 marked ✅ change needed** (incl. 1 roadmap-linked), **6 ⚠️ optional**.

*Regenerate this file after each hardening wave; keep §2 (what's covered) in sync with `TASKS.md`.*

---

## 9. Fix log — 2026-10-06 hardening pass

| ID | Wave | Status | Change |
| --- | --- | --- | --- |
| F-01 | B | ✅ Fixed | Socket joins `user:<userId>` on connect; relay targets that room (`socket.ts`) |
| F-02 | A | ✅ Fixed | Signup now returns `refreshToken` and sets the httpOnly cookie exactly like login |
| F-03 | A | ✅ Fixed | Refresh queue holds `{resolve, reject}`; failure rejects every parked request |
| F-06 | B | ⚠️ Partial | 10 s join-ack timeout → clear error instead of eternal spinner; spectator mode still open |
| F-07 | B | ✅ Fixed | Guest `sessionStorage` parse wrapped; corrupt entry is cleared, not a crash |
| F-08 | B | ⚠️ Partial | Relay/state now require `payload.meetingId === socket.data.meetingId`; target-roster check still open |
| F-10 | A | ✅ Fixed | `JWT_ACCESS_EXPIRY` default `24h` → `15m` |
| F-12 | A | ✅ Fixed | Org-create failure rolls back the user; slug collisions retry then fall back to a timestamp suffix |
| F-14 | C | ✅ Fixed | `meeting:state` merges only the keys present in the event |
| F-16 | C | ✅ Fixed | All Q&A/poll handlers (and chat sends) surface failures via toast instead of swallowing |
| F-20 | A | ✅ Fixed | Email regex accepts any TLD length ≥ 2 (`.info` etc.) |
| — | C | ✅ Added | Real-time chat: `meeting:message` server event (2000-char cap, per-message roster/`can_use_chat` re-check) + `MeetingChat` panel alongside Q&A and Polls |






