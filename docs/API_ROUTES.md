# IntellMeet — API Routes

Complete HTTP API surface of the IntellMeet server, verified against
`server/src/routes/*` and `server/src/controllers/*`. Every example below uses
the real response shapes produced by `ApiResponse`, the model `toJSON`
transforms, and `paginatedFind` — no invented fields.

- Interactive docs: `GET /api/docs` (Swagger UI)
- Machine spec: `GET /api/docs/json` (OpenAPI)
- Bruno collection for try-outs: [`bruno/`](../bruno/README.md)

---

## Conventions

### Success envelope

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Human-readable message",
  "data": {},
  "timestamp": "2026-10-06T12:00:00.000Z"
}
```

### Error envelope

```json
{
  "success": false,
  "statusCode": 400,
  "message": "What went wrong",
  "errors": [{ "field": "userEmail", "message": "User with this email already exists" }],
  "timestamp": "2026-10-06T12:00:00.000Z"
}
```

`errors` is `[]` for most failures. Stack traces are logged server-side and
never returned.

### Pagination

Every list endpoint returns:

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 0,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

`?page` defaults to `1`, `?limit` defaults to `10` and caps at `100`.

---

## Route Index

| # | Method | Path | Auth | Description |
|---|--------|------|------|-------------|
| 1 | GET | `/` | — | Welcome banner |
| 2 | GET | `/api` | — | Welcome banner |
| 3 | GET | `/api/health` | — | Legacy health (plain JSON) |
| 4 | GET | `/api/docs` | — | Swagger UI |
| 5 | GET | `/api/docs/json` | — | OpenAPI spec |
| 6 | GET | `/api/v1/health` | — | Health + memory + DB status |
| 7 | GET | `/api/v1/health/ready` | — | Readiness (503 when DB down in prod) |
| 8 | POST | `/api/v1/auth/signup` | — | Register (create org or join by invite) |
| 9 | POST | `/api/v1/auth/login` | — | Login, sets refresh cookie |
| 10 | POST | `/api/v1/auth/refresh-token` | cookie | Rotate refresh, new access token |
| 11 | POST | `/api/v1/auth/logout` | cookie | Clear refresh token |
| 12 | GET | `/api/v1/auth/me` | Bearer | Current user profile |
| 13 | GET | `/api/v1/organizations/invite/:code` | — | Verify invite code (live signup check) |
| 14 | POST | `/api/v1/organizations/invite/regenerate` | SuperAdmin | Rotate invite code |
| 15 | GET | `/api/v1/organizations/me` | Bearer | Own organization |
| 16 | GET | `/api/v1/organizations/members` | Bearer | Org members (paginated) |
| 17 | GET | `/api/v1/job-titles` | Bearer | List job titles |
| 18 | POST | `/api/v1/job-titles` | SuperAdmin/Admin | Create job title |
| 19 | PUT | `/api/v1/job-titles/:id` | SuperAdmin/Admin | Update job title |
| 20 | DELETE | `/api/v1/job-titles/:id` | SuperAdmin/Admin | Delete job title |
| 21 | POST | `/api/v1/job-titles/assign` | SuperAdmin/Admin | Assign title to a member |
| 22 | POST | `/api/v1/projects` | SuperAdmin | Create project |
| 23 | GET | `/api/v1/projects` | Bearer | List projects (paginated) |
| 24 | GET | `/api/v1/projects/:id` | Bearer | Project detail |
| 25 | PATCH | `/api/v1/projects/:id` | SuperAdmin | Update project |
| 26 | DELETE | `/api/v1/projects/:id` | SuperAdmin | Delete project |
| 27 | GET | `/api/v1/projects/:id/members` | Bearer | Project roster + caps |
| 28 | POST | `/api/v1/projects/:id/members` | SuperAdmin | Add members |
| 29 | PATCH | `/api/v1/projects/:id/members/:userId/role` | SuperAdmin | Promote/demote Host |
| 30 | DELETE | `/api/v1/projects/:id/members/:userId` | SuperAdmin | Remove member |
| 31 | GET | `/api/v1/meetings/join/:code` | optional | Public lobby preview by join code |
| 32 | POST | `/api/v1/meetings` | Bearer | Schedule meeting |
| 33 | GET | `/api/v1/meetings` | Bearer | List meetings (paginated) |
| 34 | GET | `/api/v1/meetings/:id` | Bearer | Meeting detail |
| 35 | POST | `/api/v1/meetings/:id/join` | Bearer | Join meeting |
| 36 | POST | `/api/v1/meetings/:id/leave` | Bearer | Leave meeting |
| 37 | POST | `/api/v1/meetings/:id/participants` | HOST/MODERATOR | Add participants |
| 38 | POST | `/api/v1/meetings/:id/participant-settings` | HOST/MODERATOR | Per-member mic/cam/screen/chat |
| 39 | POST | `/api/v1/meetings/:id/start` | HOST/MODERATOR | SCHEDULED → LIVE |
| 40 | POST | `/api/v1/meetings/:id/end` | HOST/MODERATOR | → ENDED |
| 41 | POST | `/api/v1/meetings/:id/questions` | roster | Ask a question |
| 42 | GET | `/api/v1/meetings/:id/questions` | roster | List questions (paginated) |
| 43 | POST | `/api/v1/meetings/:id/questions/:questionId/answers` | roster | Answer a question |
| 44 | POST | `/api/v1/meetings/:id/questions/:questionId/dismiss` | asker/host | Dismiss a question |
| 45 | POST | `/api/v1/meetings/:id/polls` | HOST/MODERATOR | Create poll |
| 46 | GET | `/api/v1/meetings/:id/polls` | roster | List polls (paginated) |
| 47 | POST | `/api/v1/meetings/:id/polls/:pollId/vote` | roster | Vote (re-vote replaces) |
| 48 | POST | `/api/v1/meetings/:id/polls/:pollId/close` | HOST/MODERATOR | Close poll |
| 49 | POST | `/api/v1/recordings` | Bearer | Create recording (PENDING) |
| 50 | GET | `/api/v1/recordings` | Bearer | List recordings (paginated) |
| 51 | GET | `/api/v1/recordings/:id` | Bearer | Recording + AI statuses |
| 52 | POST | `/api/v1/recordings/:id/upload-url` | Bearer | Presigned PUT URL |
| 53 | POST | `/api/v1/recordings/:id/complete` | Bearer | HeadObject verify → READY |
| 54 | POST | `/api/v1/recordings/:id/download-url` | Bearer | Presigned GET URL |
| 55 | DELETE | `/api/v1/recordings/:id` | owner/SuperAdmin | Delete object + soft-delete |
| 56 | GET | `/api/v1/recordings/:id/transcript` | Bearer | Local-Whisper transcript |
| 57 | GET | `/api/v1/recordings/:id/summary` | Bearer | Local-LLM summary |

---

## JSON Examples

### System & Health

`GET /api/v1/health`

```json
{
  "success": true,
  "statusCode": 200,
  "message": "IntellMeet Server is healthy",
  "data": {
    "service": "IntellMeet Backend API",
    "status": "healthy",
    "environment": "development",
    "uptimeSeconds": 120,
    "timestamp": "2026-10-06T12:00:00.000Z",
    "database": "connected",
    "memory": { "rssMB": 84, "heapUsedMB": 41 }
  },
  "timestamp": "2026-10-06T12:00:00.000Z"
}
```

`GET /api/v1/health/ready` — `200` when ready, `503` when the DB is down in production:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Server is ready",
  "data": { "ready": true, "database": "connected", "timestamp": "2026-10-06T12:00:00.000Z" },
  "timestamp": "2026-10-06T12:00:00.000Z"
}
```

`GET /api` (also `GET /`):

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Welcome to IntellMeet API",
  "data": {
    "service": "IntellMeet Backend API",
    "version": "1.0.0",
    "documentation": "/api/docs",
    "healthCheck": "/api/v1/health"
  },
  "timestamp": "2026-10-06T12:00:00.000Z"
}
```

`GET /api/health` (legacy, plain JSON, not the envelope):

```json
{ "status": "ok", "message": "IntellMeet Server is ready" }
```

---

### Authentication — `/api/v1/auth`

**`POST /api/v1/auth/signup`** — two modes: create an organization (becomes
`SuperAdmin`) or join an existing one with an invite code (becomes `Member`).

Request (create org):

```json
{
  "userName": "Alex Morgan",
  "userEmail": "alex@intellmeet.com",
  "password": "SecurePass123!",
  "isCreatingOrg": true,
  "organizationName": "Acme Corp",
  "organizationLocation": "Berlin"
}
```

Request (join by invite):

```json
{
  "userName": "Sam Lee",
  "userEmail": "sam@intellmeet.com",
  "password": "SecurePass123!",
  "isCreatingOrg": false,
  "inviteCode": "ACME-4821"
}
```

Response `201` (password and refresh token are never returned):

```json
{
  "success": true,
  "statusCode": 201,
  "message": "User registered successfully",
  "data": {
    "user": {
      "userId": "6742a1b2c3d4e5f678901234",
      "userName": "Alex Morgan",
      "userEmail": "alex@intellmeet.com",
      "userRole": "SuperAdmin",
      "isSuperAdmin": true,
      "userCode": "USR-0001",
      "avatarUrl": "",
      "jobTitle": "",
      "isDeleted": false,
      "organizationId": "6742a1b2c3d4e5f678901235",
      "createdAt": "2026-10-06T12:00:00.000Z",
      "updatedAt": "2026-10-06T12:00:00.000Z"
    },
    "accessToken": "eyJhbGciOi..."
  },
  "timestamp": "2026-10-06T12:00:00.000Z"
}
```

**`POST /api/v1/auth/login`**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Login successful",
  "data": {
    "user": { "userId": "6742a1b2c3d4e5f678901234", "userEmail": "alex@intellmeet.com", "userRole": "SuperAdmin" },
    "accessToken": "eyJhbGciOi..."
  },
  "timestamp": "2026-10-06T12:00:00.000Z"
}
```

Sets the `refreshToken` httpOnly cookie. **`POST /api/v1/auth/refresh-token`**
rotates it and returns `{ "data": { "accessToken": "eyJ..." } }`.
**`POST /api/v1/auth/logout`** returns `"data": null` and clears the cookie.
**`GET /api/v1/auth/me`** returns the same user object as signup under `data`.

---

### Organizations — `/api/v1/organizations`

**`GET /api/v1/organizations/invite/:code`** (public, used by the signup toggle):

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Invite code verified successfully",
  "data": {
    "valid": true,
    "organizationId": "6742a1b2c3d4e5f678901235",
    "organizationName": "Acme Corp",
    "organizationSlug": "acme-corp",
    "location": "Berlin"
  },
  "timestamp": "2026-10-06T12:00:00.000Z"
}
```

**`POST /api/v1/organizations/invite/regenerate`** (SuperAdmin):

```json
{
  "success": true,
  "statusCode": 200,
  "message": "New invite code generated successfully. Previous invite code has been revoked.",
  "data": {
    "organizationId": "6742a1b2c3d4e5f678901235",
    "organizationName": "Acme Corp",
    "newInviteCode": "ACME-9174",
    "previousInviteCode": "ACME-4821",
    "revokedInviteCodes": ["ACME-4821"]
  },
  "timestamp": "2026-10-06T12:00:00.000Z"
}
```

**`GET /api/v1/organizations/me`** returns the org document:

```json
{
  "data": {
    "organizationId": "6742a1b2c3d4e5f678901235",
    "organizationName": "Acme Corp",
    "organizationSlug": "acme-corp",
    "organizationLocation": "Berlin",
    "organizationDescription": "",
    "inviteCode": "ACME-9174",
    "revokedInviteCodes": ["ACME-4821"],
    "ownerId": "6742a1b2c3d4e5f678901234",
    "createdAt": "2026-10-06T12:00:00.000Z",
    "updatedAt": "2026-10-06T12:00:00.000Z"
  }
}
```

**`GET /api/v1/organizations/members?page=1&limit=10`** returns paginated
user objects (the user `toJSON` shape shown under auth).

---

### Job Titles — `/api/v1/job-titles`

**`GET /api/v1/job-titles`** — returns a plain array (not paginated) under `data`:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Job titles retrieved successfully",
  "data": [
    {
      "id": "6742a1b2c3d4e5f678901240",
      "title": "Product Manager",
      "organizationId": "6742a1b2c3d4e5f678901235",
      "createdBy": "6742a1b2c3d4e5f678901234",
      "createdAt": "2026-10-06T12:00:00.000Z",
      "updatedAt": "2026-10-06T12:00:00.000Z"
    }
  ],
  "timestamp": "2026-10-06T12:00:00.000Z"
}
```

**`POST /api/v1/job-titles`** body `{ "title": "Product Manager" }` → `201` with the
job title object. **`PUT /api/v1/job-titles/:id`** same body → `200`.
**`DELETE /api/v1/job-titles/:id`** →

```json
{ "data": { "message": "Job title removed successfully", "id": "6742a1b2c3d4e5f678901240" } }
```

**`POST /api/v1/job-titles/assign`** body `{ "userId": "…", "title": "Product Manager" }`
→ `200` with the updated user object.

---

### Projects — `/api/v1/projects`

**`POST /api/v1/projects`** (SuperAdmin):

```json
{
  "projectName": "Mobile App v2",
  "projectDescription": "Next generation mobile conferencing app",
  "projectStatus": "active",
  "hosts": ["65f000000000000000000001"],
  "members": ["65f000000000000000000002"]
}
```

Response `201` (project `toJSON`, with `project_hosts` / `project_members` /
`created_by` populated):

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Project created successfully",
  "data": {
    "projectId": "6742a1b2c3d4e5f678901250",
    "projectName": "Mobile App v2",
    "projectCode": "PRJ-0001",
    "projectDescription": "Next generation mobile conferencing app",
    "projectStatus": "active",
    "organizationId": "6742a1b2c3d4e5f678901235",
    "hosts": ["65f000000000000000000001"],
    "members": ["65f000000000000000000001", "65f000000000000000000002"],
    "createdBy": "6742a1b2c3d4e5f678901234",
    "createdAt": "2026-10-06T12:00:00.000Z",
    "updatedAt": "2026-10-06T12:00:00.000Z"
  },
  "timestamp": "2026-10-06T12:00:00.000Z"
}
```

**`GET /api/v1/projects`** → paginated `items` of the same shape (archived
projects excluded). **`GET /api/v1/projects/:id`** → one project.
**`PATCH /api/v1/projects/:id`** accepts `name` / `description` / `status` /
`hosts` / `members` (or the `project*` aliases) → updated project.
**`DELETE /api/v1/projects/:id`** → `"data": null`.

**`GET /api/v1/projects/:id/members`**:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Project members retrieved successfully",
  "data": {
    "items": [
      {
        "userId": "65f000000000000000000001",
        "projectRole": "Host",
        "user": {
          "_id": "65f000000000000000000001",
          "organization_id": "6742a1b2c3d4e5f678901235",
          "user_name": "Alex Morgan",
          "user_email": "alex@intellmeet.com",
          "avatar_url": "",
          "user_role": "SuperAdmin",
          "is_super_admin": true,
          "job_title": ""
        }
      }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 2, "totalPages": 1, "hasNextPage": false, "hasPreviousPage": false },
    "projectId": "6742a1b2c3d4e5f678901250",
    "projectName": "Mobile App v2",
    "memberCount": 2,
    "hostCount": 1,
    "limits": { "maxMembers": 50, "maxHosts": 3 }
  },
  "timestamp": "2026-10-06T12:00:00.000Z"
}
```

**`POST /api/v1/projects/:id/members`** body `{ "userIds": ["…"], "projectRole": "Member" }`
→ `200` with `{ "project": …, "members": [ … ] }`.
**`PATCH /api/v1/projects/:id/members/:userId/role`** body `{ "projectRole": "Host" }`
→ updated member state (max 3 hosts).
**`DELETE /api/v1/projects/:id/members/:userId`** → member removed.

---

### Meetings — `/api/v1/meetings`

**`GET /api/v1/meetings/join/:code`** — public lobby preview. Browser
navigations (`Accept: text/html`) are redirected to the SPA route
`/meetings/join/:code`; API calls get:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Meeting preview retrieved successfully",
  "data": {
    "meetingId": "6742a1b2c3d4e5f678901260",
    "meetingTitle": "Sprint Review",
    "meetingDescription": "Weekly review",
    "meetingStatus": "SCHEDULED",
    "meetingScheduledAt": "2026-10-07T14:00:00.000Z",
    "meetingDurationMinutes": 30,
    "meetingJoinMode": "OPEN_LINK",
    "meetingParticipantCount": 2,
    "meetingParticipantLimit": 50,
    "meetingJoinCode": "9f2c1e7a-4b6d-4e21-9a3f-11ab22cd33ef",
    "participants": [
      {
        "userId": "6742a1b2c3d4e5f678901234",
        "participantRole": "HOST",
        "participantStatus": "INVITED",
        "canSendAudio": true,
        "canSendVideo": true,
        "canShareScreen": true,
        "canUseChat": true,
        "joinedAt": null,
        "leftAt": null
      }
    ]
  },
  "timestamp": "2026-10-06T12:00:00.000Z"
}
```

**`POST /api/v1/meetings`** — schedule:

```json
{
  "projectId": "6742a1b2c3d4e5f678901250",
  "meetingTitle": "Sprint Review",
  "meetingDescription": "Weekly review",
  "meetingScheduledAt": "2026-10-07T14:00:00.000Z",
  "meetingDurationMinutes": 30,
  "meetingJoinMode": "OPEN_LINK",
  "meetingParticipantLimit": 50,
  "participantIds": ["65f000000000000000000002"]
}
```

Response `201` — meeting `toJSON`:

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Meeting created successfully",
  "data": {
    "meetingId": "6742a1b2c3d4e5f678901260",
    "meetingTitle": "Sprint Review",
    "meetingDescription": "Weekly review",
    "meetingStatus": "SCHEDULED",
    "meetingJoinMode": "OPEN_LINK",
    "meetingScheduledAt": "2026-10-07T14:00:00.000Z",
    "meetingDurationMinutes": 30,
    "meetingParticipantLimit": 50,
    "meetingJoinCode": "9f2c1e7a-4b6d-4e21-9a3f-11ab22cd33ef",
    "organizationId": "6742a1b2c3d4e5f678901235",
    "projectId": "6742a1b2c3d4e5f678901250",
    "createdBy": "6742a1b2c3d4e5f678901234",
    "startedAt": null,
    "endedAt": null,
    "participants": [
      {
        "userId": "6742a1b2c3d4e5f678901234",
        "participant_role": "HOST",
        "participant_status": "INVITED",
        "can_send_audio": true,
        "can_send_video": true,
        "can_share_screen": true,
        "can_use_chat": true,
        "joined_at": null,
        "left_at": null
      }
    ],
    "createdAt": "2026-10-06T12:00:00.000Z",
    "updatedAt": "2026-10-06T12:00:00.000Z"
  },
  "timestamp": "2026-10-06T12:00:00.000Z"
}
```

Rules enforced server-side: participants must be on the project roster, the
participant limit can only be lowered (max 50), duration 1–480 min, and
archived/completed projects reject new meetings.

Other meeting routes:

- **`GET /api/v1/meetings?projectId=&status=&mine=true&search=&page=&limit=`**
  → paginated meeting objects (see above).
- **`GET /api/v1/meetings/:id`** → one meeting.
- **`POST /:id/join`** → `200` meeting with your participant row flipped to
  `JOINED` (403 for invite-only non-roster, 400 when finished or full).
- **`POST /:id/leave`** → participant row set to `LEFT`.
- **`POST /:id/participants`** body `{ "participantIds": ["…"] }` → updated
  meeting (host/moderator only).
- **`POST /:id/participant-settings`** body:

  ```json
  {
    "participantId": "65f000000000000000000002",
    "canSendAudio": false,
    "canSendVideo": true,
    "canShareScreen": false,
    "canUseChat": true
  }
  ```

- **`POST /:id/start`** → `meetingStatus: "LIVE"`, `startedAt` stamped.
- **`POST /:id/end`** → `meetingStatus: "ENDED"`, `endedAt` stamped.

---

### Meeting Q&A — `/api/v1/meetings/:id/questions`

**`POST /questions`** body `{ "questionText": "What is the ETA?" }` → `201`:

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Question asked successfully",
  "data": {
    "questionId": "6742a1b2c3d4e5f678901270",
    "questionText": "What is the ETA?",
    "questionStatus": "OPEN",
    "answers": [],
    "answerCount": 0,
    "organizationId": "6742a1b2c3d4e5f678901235",
    "meetingId": "6742a1b2c3d4e5f678901260",
    "askedBy": "65f000000000000000000002",
    "createdAt": "2026-10-06T12:05:00.000Z",
    "updatedAt": "2026-10-06T12:05:00.000Z"
  },
  "timestamp": "2026-10-06T12:05:00.000Z"
}
```

- **`GET /questions?status=OPEN&page=&limit=`** → paginated, oldest first.
- **`POST /questions/:questionId/answers`** body `{ "answerText": "Two weeks" }`
  → `200` same question object with `questionStatus: "ANSWERED"` and the new
  answer pushed into `answers` (`{ userId, answerText, createdAt }`).
- **`POST /questions/:questionId/dismiss`** → `questionStatus: "DISMISSED"`
  (asker or host/moderator only).

Roster membership and `canUseChat` are re-checked on every call.

---

### Meeting Polls — `/api/v1/meetings/:id/polls`

**`POST /polls`** (host/moderator) body:

```json
{ "pollQuestion": "Ship this week?", "options": ["Yes", "No", "Needs more time"], "multipleChoice": false }
```

Response `201` (vote counts only — voter ids are never exposed):

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Poll created successfully",
  "data": {
    "pollId": "6742a1b2c3d4e5f678901280",
    "pollQuestion": "Ship this week?",
    "pollStatus": "OPEN",
    "pollMultipleChoice": false,
    "pollOptions": [
      { "optionId": "opt-1", "optionText": "Yes", "voteCount": 0 },
      { "optionId": "opt-2", "optionText": "No", "voteCount": 0 },
      { "optionId": "opt-3", "optionText": "Needs more time", "voteCount": 0 }
    ],
    "organizationId": "6742a1b2c3d4e5f678901235",
    "meetingId": "6742a1b2c3d4e5f678901260",
    "createdBy": "6742a1b2c3d4e5f678901234",
    "createdAt": "2026-10-06T12:06:00.000Z",
    "updatedAt": "2026-10-06T12:06:00.000Z"
  },
  "timestamp": "2026-10-06T12:06:00.000Z"
}
```

- **`GET /polls?status=OPEN`** → paginated polls, oldest first.
- **`POST /polls/:pollId/vote`** body `{ "optionIds": ["opt-1"] }` → `200` poll
  with updated `voteCount`s. Re-voting replaces the previous selection;
  single-choice polls reject more than one id; closed polls reject votes.
- **`POST /polls/:pollId/close`** → `pollStatus: "CLOSED"` (host/moderator).

---

### Recordings — `/api/v1/recordings`

Upload flow: `POST /` → `POST /:id/upload-url` → browser `PUT` straight to
S3-compatible storage → `POST /:id/complete` (HeadObject verifies type/size;
post-processing runs inline).

**`POST /api/v1/recordings`** body:

```json
{ "contentType": "video/webm;codecs=vp8,opus", "projectId": "6742a1b2c3d4e5f678901250" }
```

Response `201` (recording `toJSON`; `storage_key` is never exposed):

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Recording created successfully",
  "data": {
    "recordingId": "6742a1b2c3d4e5f678901290",
    "recordingStatus": "PENDING",
    "recordingMimeType": "video/webm;codecs=vp8,opus",
    "recordingSizeBytes": 0,
    "recordingDurationMs": 0,
    "organizationId": "6742a1b2c3d4e5f678901235",
    "projectId": "6742a1b2c3d4e5f678901250",
    "meetingId": null,
    "createdBy": "6742a1b2c3d4e5f678901234",
    "recordingExpiresAt": "2026-11-05T12:00:00.000Z",
    "createdAt": "2026-10-06T12:10:00.000Z",
    "updatedAt": "2026-10-06T12:10:00.000Z"
  },
  "timestamp": "2026-10-06T12:10:00.000Z"
}
```

- **`GET /?status=&projectId=&meetingId=&page=&limit=`** → paginated recordings
  (createdBy populated).
- **`GET /:id`** → recording plus AI pipeline state:

  ```json
  { "data": { "recordingId": "…", "recordingStatus": "READY", "transcriptionStatus": "READY", "summaryStatus": "PROCESSING" } }
  ```

- **`POST /:id/upload-url`** → repeatable while `PENDING`:

  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Upload URL generated successfully",
    "data": { "uploadUrl": "http://localhost:4566/…?X-Amz-Signature=…", "expiresIn": 900, "maxSizeBytes": 52428800 },
    "timestamp": "2026-10-06T12:10:30.000Z"
  }
  ```

- **`POST /:id/complete`** optional body `{ "durationMs": 60210 }` → `200`
  recording with `recordingStatus: "READY"` (authoritative mime/size from
  HeadObject; empty/oversized/wrong-type objects are deleted → `FAILED`).
  Triggers the local FFmpeg → Whisper → Ollama pipeline inline.
- **`POST /:id/download-url`** → `{ "downloadUrl": "…", "expiresIn": 900 }`
  (READY only).
- **`DELETE /:id`** → object deleted, record soft-deleted, `"data": null`.
- **`GET /:id/transcript`** → `404` until READY:

  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Transcript retrieved successfully",
    "data": {
      "transcriptId": "6742a1b2c3d4e5f678901300",
      "transcriptStatus": "READY",
      "transcriptText": "Hello everyone, let's start the sprint review…",
      "transcriptLanguage": "en",
      "transcriptDurationMs": 60210,
      "transcriptSegmentCount": 14,
      "organizationId": "6742a1b2c3d4e5f678901235",
      "recordingId": "6742a1b2c3d4e5f678901290",
      "createdAt": "2026-10-06T12:12:00.000Z",
      "updatedAt": "2026-10-06T12:12:00.000Z"
    },
    "timestamp": "2026-10-06T12:12:00.000Z"
  }
  ```

- **`GET /:id/summary`** → `404` until READY:

  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Summary retrieved successfully",
    "data": {
      "summaryId": "6742a1b2c3d4e5f678901310",
      "summaryStatus": "READY",
      "summaryText": "The team reviewed sprint 14 and agreed to ship on Friday.",
      "summaryKeyPoints": ["Sprint 14 accepted", "Ship Friday"],
      "summaryActionItems": [
        { "text": "Prepare release notes", "assignee": "Sam Lee" },
        { "text": "Verify the hotfix on staging", "assignee": null }
      ],
      "organizationId": "6742a1b2c3d4e5f678901235",
      "recordingId": "6742a1b2c3d4e5f678901290",
      "transcriptId": "6742a1b2c3d4e5f678901300",
      "createdAt": "2026-10-06T12:13:00.000Z",
      "updatedAt": "2026-10-06T12:13:00.000Z"
    },
    "timestamp": "2026-10-06T12:13:00.000Z"
  }
  ```

---

## Socket.io Events

Namespace: default. Auth: `handshake.auth.token` = the same JWT access token;
connections without a valid token are disconnected immediately.

| Direction | Event | Payload |
|-----------|-------|---------|
| C → S | `meeting:join` | `meetingId` (ack: `{ ok, peers?, error? }`) |
| C → S | `meeting:leave` | `meetingId` |
| C → S | `webrtc:offer` / `webrtc:answer` / `webrtc:ice` | `{ meetingId, to, …SDP/ICE }` |
| C → S | `meeting:state` | `{ meetingId, state: { mute?, camera?, screen?, hand? } }` |
| C → S | `meeting:message` | `{ meetingId, text }` (ack: `{ ok, error? }`; max 2000 chars) |
| S → C | `meeting:peer-joined` | `{ userId }` |
| S → C | `meeting:peer-left` | `{ userId }` |
| S → C | `webrtc:offer` / `webrtc:answer` / `webrtc:ice` | `{ from, meetingId, to?, description?/candidate? }` (relayed flat) |
| S → C | `meeting:state` | `{ userId, state }` |
| S → C | `meeting:message` | `{ messageId, meetingId, from, text, at }` |

The server only relays SDP/ICE — media never touches it. `meeting:join`
re-checks tenant scope and INVITE_ONLY roster rules before admitting the
socket to the `meeting:<id>` room. Every socket also joins `user:<userId>`,
which is the room signalling messages are addressed to. Chat re-checks roster
membership and `can_use_chat` against the database on every message.

### Authentication

- Access token: `Authorization: Bearer <accessToken>` (15 min JWT).
- Refresh token: `refreshToken` httpOnly cookie, rotated on every refresh
  (`sameSite=strict`).
- Socket.io uses the same access token in `handshake.auth.token`.
- Role gates: `SuperAdmin`, `Admin` (job titles), plus meeting-scoped
  `HOST` / `MODERATOR` roles checked against the meeting roster.
- Tenant scope always comes from the verified JWT — never from the payload.
