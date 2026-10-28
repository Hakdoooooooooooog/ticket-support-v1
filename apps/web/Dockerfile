# ==============================================================================
# TicketSupport Web Application Dockerfile (Next.js 16 Standalone)
# Ultra-compact, production-optimized container
# ==============================================================================

FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Dependency resolution stage
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN npm ci

# Build stage
FROM deps AS builder
COPY apps/web ./apps/web

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Public build-time environment variable declarations
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_ATTACHMENT_KEY=placeholder_attachment_key_32_bytes_long!
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_ATTACHMENT_KEY=$NEXT_PUBLIC_ATTACHMENT_KEY

RUN npm run build --workspace=web

# Production Runner stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root unprivileged service account
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output and static assets
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
