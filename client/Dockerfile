# syntax=docker/dockerfile:1.7
# ==========================================
# IntellMeet Web Client
# Stage 1: build Vite bundle  |  Stage 2: nginx static runtime
# ==========================================

# ---------- Stage 1: build ----------
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

# The pnpm workspace lockfile lives at the repository root, so the build context
# must be the root (see docker-compose.yml).
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY client/package.json ./client/
RUN pnpm install --frozen-lockfile --filter ./client...

COPY client/tsconfig*.json client/vite.config.ts client/index.html ./client/
COPY client/src ./client/src

# Baked at build time (public config, never a secret)
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN pnpm --filter ./client run build

# ---------- Stage 2: static runtime ----------
FROM nginx:1.27-alpine AS runner

COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/client/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]