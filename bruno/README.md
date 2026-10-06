# IntellMeet API — Bruno collection

Covers the tenant-scoped meeting, Q&A, poll, recording and project endpoints.
The spec these mirror is `server/openapi.json` (38 paths), served live at
`/api/docs`.

## Run order

The collection is stateful: earlier requests save variables that later ones read.

```text
1. Health / Health Check          (no auth — safe first request)
2. Auth / Sign Up (create org)    saves accessToken + organizationId
3. Projects / Create Project      saves projectId
4. Meetings / Schedule Meeting    saves meetingId + meetingJoinCode
5. Meetings / Preview by Join Link, Join, Get
6. Meetings / Set Participant Permissions
7. Meeting Q&A / Ask, Answer      saves questionId
8. Meeting Polls / Create, Vote   saves pollId + optionIds
9. Recordings / Create → Upload URL → Complete
```

`Sign Up` sets collection-level bearer auth for everything after it, so
requests do not repeat the token.

## Environment

`bruno/environments/local.bru` holds the variables. `baseUrl` defaults to
`http://localhost:5001` — the Dockerised server publishes 5001 because 5000 is
often taken by `pnpm dev:server`. If you run the API directly, change it to 5000.

## Requests that capture a real security rule

These are the ones worth running deliberately, because they encode the rules the
backend is built around:

| Request | Expected |
| --- | --- |
| Meetings / Set Participant Permissions, `canUseChat: false`, then Q&A / Ask | **403** — the chat toggle gates posting, not just talking |
| Meetings / Add Participants with a non-project member | **400** — an org invite code does not qualify someone |
| Meetings / Join on an `INVITE_ONLY` meeting while off the roster | **403** |
| Meeting Polls / Vote run twice | Count stays 1 — re-voting replaces, never accumulates |
| Meeting Polls / Create, then inspect the response | `voteCount` is present, **voter ids are not** |
| Recordings / Complete with the AI services stopped | `recordingStatus: READY`, `transcriptionStatus: FAILED` — a failed AI stage never invalidates the recording |

Cross-tenant checks need a second organization's token, so they are not encoded
as requests here. Sign up a second account, set `accessToken` to that user, and
call a resource created by the first: expect **404** everywhere, never 403,
so existence is not disclosed.
