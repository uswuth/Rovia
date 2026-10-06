# syntax=docker/dockerfile:1.7
# ==========================================
# IntellMeet API Server
# Stage 1: compile TypeScript  |  Stage 2: production runtime
# ==========================================

# ---------- Stage 1: compile TypeScript ----------
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

# The pnpm workspace lockfile lives at the repository root, so the build context
# must be the root (see docker-compose.yml). server/pnpm-workspace.yaml is only
# needed to resolve the local "server" package, not its dependencies.
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/
RUN pnpm install --frozen-lockfile --filter ./server...

COPY server/tsconfig.json ./server/
COPY server/src ./server/src
RUN pnpm --filter ./server run build

# ---------- Stage 2: production runtime ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

# FFmpeg is a runtime dependency of the local AI pipeline: the AudioExtractor
# adapter shells out to it to remux the WebM recording to 16 kHz mono WAV.
RUN apk add --no-cache ffmpeg

RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/
RUN pnpm install --prod --frozen-lockfile --filter ./server...

# dist must sit beside server/node_modules: pnpm installs into
# /app/server/node_modules, and Node resolves packages by walking up from the
# importing file. Putting dist at /app/dist would hide every dependency.
COPY --from=builder /app/server/dist ./server/dist

# Secrets are mounted read-only at /run/secrets by Docker, never baked into the image
ENV MONGO_URI_FILE=/run/secrets/mongo_uri \
    JWT_ACCESS_SECRET_FILE=/run/secrets/jwt_access_secret \
    JWT_REFRESH_SECRET_FILE=/run/secrets/jwt_refresh_secret

USER node
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:5000/api/v1/health || exit 1

CMD ["node", "server/dist/server.js"]
