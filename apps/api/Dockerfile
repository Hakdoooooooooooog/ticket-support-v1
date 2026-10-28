# ==============================================================================
# TicketSupport Backend API Dockerfile (NestJS + Prisma)
# Multi-stage build for minimal, hardened production container
# ==============================================================================

# Base image with libc6-compat and openssl for Prisma engines
FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Dependency resolution stage
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN npm ci

# Build stage
FROM deps AS builder
COPY apps/api ./apps/api

# Generate Prisma Client & compile NestJS application
RUN npm run db:generate --workspace=api
RUN npm run build --workspace=api

# Production Runner stage
FROM base AS runner
WORKDIR /app/apps/api

ENV NODE_ENV=production
ENV PORT=3001

# Create non-root unprivileged service account
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy runtime node_modules, build output and Prisma assets
COPY --from=builder --chown=nestjs:nodejs /app/node_modules /app/node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/package.json /app/package.json

USER nestjs

EXPOSE 3001

CMD ["node", "dist/main.js"]
