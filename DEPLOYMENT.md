# IntellMeet — Deployment

| Piece | Host | Why |
| --- | --- | --- |
| Client (React) | **Vercel** | Static build, free, global CDN |
| API (Express + Socket.io) | **Render** | Needs one long-lived connection |
| Database | **MongoDB Atlas** | Free 512 MB cluster |
| Recordings | **Cloudflare R2** | Free 10 GB, free downloads |
| Transcription | **Groq** | `whisper-large-v3`, free tier |
| Summary | **OpenRouter** | Free text models |

Total cost: **$0**.

## Why the API cannot live on Vercel

Vercel functions are stateless and time-limited. Socket.io holds one open
connection for the whole meeting, so the API needs a long-running process.
Render runs that; Vercel runs only the static client.

## First-time setup

### 1. MongoDB Atlas

Create a free cluster and a database user. Then generate the secrets:

```sh
cd server && pnpm secrets:generate
```

Upload each file in `server/secrets/` to Render under **Secret Files**.

### 2. Render

Push the repo, then in Render: **New → Blueprint**, point at this repository.
`render.yaml` is read automatically. In the dashboard, set the values marked
`sync: false`:

- `CLIENT_URL` → your Vercel URL
- `CORS_ORIGIN` → your Vercel URL (no wildcard in production)
- `GROQ_API_KEY`, `OPENROUTER_API_KEY`
- `AWS_*` → your R2 bucket details

Render gives you a URL like `https://intellmeet-api.onrender.com`.

### 3. Vercel

```sh
npm i -g vercel
vercel
```

Set one environment variable in the Vercel dashboard:

- `RENDER_API_URL` → `https://intellmeet-api.onrender.com`

Vercel reads `vercel.json` for the build command, the output directory, the SPA
rewrite, and the keep-awake cron.

## The keep-awake cron

Render's free tier spins an idle service down after 15 minutes and takes ~50
seconds to wake. `api/keep-wake.ts` pings `/api/v1/health` every 10 minutes so a
shared demo link opens without a white screen.

This is a workaround for a free-tier limitation, not an optimisation. On a paid
plan, delete the `crons` block from `vercel.json` and the function.

## Health check

`GET /api/v1/health` returns liveness only — no version, hostname or connection
string. That is deliberate, per `server/AGENTS.md` §5.