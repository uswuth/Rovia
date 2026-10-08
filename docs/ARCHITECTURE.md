# IntellMeet — Architecture

Interactive architecture diagram generated with the
[archify](https://github.com/tt-a1i/archify) agent skill (v3.0.1), authored
from this repository's actual source, pinned at commit
`319b3efa004b329a997f195f3fb8b103f2427bff`.

**Open the diagram:** [`.archify/architecture-intellmeet-20261006-202638/intellmeet.html`](../.archify/architecture-intellmeet-20261006-202638/intellmeet.html)
— standalone HTML with inline SVG, light/dark themes, legend and source links.
Keep it next to its spec [`candidate.json`](../.archify/architecture-intellmeet-20261006-202638/candidate.json)
to regenerate or evolve the diagram.

**Delivery receipt** (all automated gates passed):

| Gate | Result |
| --- | --- |
| `validate` (showcase quality, schema + layout) | ✅ pass |
| `deliver` (render + provenance) | ✅ pass |
| `check` (strict provenance) | ✅ pass |
| `browser-check` (real browser, 1440px, no overflow) | ✅ pass |
| Visual (perceptual) review | not requested — automated checks only |

---

## Topology

The canonical diagram is the **interactive HTML** linked above — it renders the
full component map as inline SVG (light/dark themes, legend, clickable source
links) and can export PNG/SVG/WebP from its in-page menu. The map covers:

- **Main path:** Participants → Web Client → Express REST API → MongoDB
- **Meeting path:** Web Client → Meeting Room → Socket.io Signaling (rooms,
  SDP/ICE relay) → MongoDB (roster re-check on `meeting:join`)
- **Media path:** Meeting Room ↔ Participants as **peer-to-peer WebRTC**;
  STUN lookup for ICE. Media never touches the server.
- **Recording path:** API presigns a PUT URL on S3-compatible storage; the
  browser uploads directly, then `complete()` verifies the object with
  `HeadObject` and triggers the inline AI pipeline (FFmpeg → Whisper →
  Ollama), which writes transcripts and summaries to MongoDB.

| Component | Type | Responsibility | Primary source |
| --- | --- | --- | --- |
| Participants | external | Browsers of signed-in members and link guests | — |
| Web Client | frontend | React 19 SPA: auth, dashboard, projects, meetings | `client/package.json` |
| Meeting Room | frontend | WebRTC peer mesh, Q&A, polls, recording capture | `client/src/hooks/useWebRtcMeeting.ts` |
| Express REST API | backend | JWT auth, tenant scoping, all REST resources | `server/src/routes/index.ts`, `server/src/app.ts` |
| AI Post-Processing | backend | FFmpeg → local Whisper → local Ollama, runs inline after upload | `server/src/services/recording.service.ts:169` |
| Socket.io Signaling | backend | JWT handshake, meeting rooms, SDP/ICE relay, presence | `server/src/socket/socket.ts:78-126` |
| S3-Compatible Storage | cloud | Private bucket; browser uploads via presigned PUT | `server/src/services/storage.service.ts` |
| MongoDB | database | Tenant-scoped collections (users, orgs, projects, meetings, recordings, transcripts, summaries) | `server/src/models/*` |
| STUN Server | external | ICE discovery for the browser mesh (`stun.l.google.com`) | `client/src/hooks/useWebRtcMeeting.ts:5` |

**Runtime boundaries:** *Browser (client runtime)* wraps Web Client + Meeting
Room; *Node 22 server process* wraps the API, AI pipeline and signaling.
Storage and MongoDB are reached from the server process only.

---

## Request & Data Flows

### 1. Authentication (REST)
1. `POST /api/v1/auth/login` → access JWT in the body, rotating refresh token
   in an `httpOnly` cookie.
2. Every subsequent REST call sends `Authorization: Bearer <jwt>`;
   `authenticateUser` puts `userId` + `organizationId` into request scope.
3. Every Mongo query filters on that `organizationId` — a foreign tenant's row
   is a `404`, never a leak.

### 2. Real-time meeting (Socket.io + WebRTC)
1. The socket handshake carries the **same access JWT**; invalid token →
   disconnect (`server/src/socket/socket.ts:47-71`).
2. `meeting:join` re-checks org scope and INVITE_ONLY roster, joins the
   `meeting:<id>` room, acks the peer list, and broadcasts `meeting:peer-joined`.
3. Peers exchange `webrtc:offer` / `webrtc:answer` / `webrtc:ice` — the server
   **relays payloads untouched** (`socket.ts:114-126`). Audio/video flows
   peer-to-peer (Google STUN for ICE); `meeting:state` fans out mute/camera/
   screen/hand changes.
4. `meeting:leave` and disconnect emit `meeting:peer-left`.

### 3. Recording → transcript → summary
1. `POST /api/v1/recordings` creates a `PENDING` record; the storage key is
   derived server-side from org + recording id.
2. `POST /:id/upload-url` returns a presigned PUT (repeatable for retries).
3. The browser uploads the MediaRecorder blob **directly** to storage.
4. `POST /:id/complete` reads `HeadObject` — the stored object's type/size are
   authoritative; empty/oversized/wrong-type objects are deleted and the
   recording marked `FAILED`. On success: `READY`.
5. `runPostProcessing` executes inline (single seam, queue-swappable):
   FFmpeg extracts audio → local Whisper transcribes → local Ollama summarizes
   with action items. Failures are logged; they never fail the upload.
6. `GET /:id/transcript` and `GET /:id/summary` serve the results (404 until
   READY); `GET /:id` reports `transcriptionStatus` / `summaryStatus`.

---

## Security Invariants Shown in the Diagram

- **Single token trust:** one JWT authenticates REST and Socket.io alike.
- **Tenant isolation:** org id comes from the verified token, never the body.
- **Private storage:** the bucket has no public reads; presigned GET/PUT URLs
  are the capability, and `storage_key` is never serialized to clients.
- **Server-authoritative media metadata:** `HeadObject`, not the client,
  decides recording type and size.
- **Least-privilege meeting control:** host/moderator checks gate participant
  permissions, start/end, poll creation/close; per-member capability flags
  (mic/cam/screen/chat) live on the roster.

---

## Regenerating the Diagram

The archify skill is installed at [`.agents/skills/archify/`](../.agents/skills/archify/SKILL.md).
To regenerate after architecture changes:

```bash
node .agents/skills/archify/bin/archify.mjs finalize architecture \
  .archify/architecture-intellmeet-20261006-202638/candidate.json \
  .archify/architecture-intellmeet-20261006-202638/intellmeet.html \
  --repo-root . --quality showcase --json
```

Keep `candidate.json` in sync with real code and its `sources` line ranges
before regenerating.

