# TicketSupport Platform

TicketSupport is an enterprise IT service desk and incident triage platform. It provides dedicated, role-scoped workspaces for customer support requests and IT engineering operations—featuring real-time push updates, client-side zero-knowledge encrypted attachments, database-backed ticket deflection, and automated dispatch.

---

## Core Purpose & Architecture

- **End-to-End Incident Lifecycle**: Structured triage from customer ticket submission to automated round-robin assignment, staff resolution notes, internal collaboration, and customer CSAT reviews.
- **Proactive Ticket Deflection**: Reduces support load by matching incoming inquiries against self-service knowledge base articles in real time before submission.
- **Zero-Knowledge Security**: Diagnostic attachments and screenshots are compressed and encrypted client-side (AES-GCM 256-bit) before transmission.
- **Real-Time Push Updates**: Server-Sent Events (SSE) keep queue statuses, in-app notifications, and outage banners synchronized across all connected clients without polling.
- **Database-Level Immutability**: Critical audit records are protected by PostgreSQL triggers that reject unauthorized updates or deletions.

---

## Key Features

- **Role-Based Workspaces**: Customer Portal (`/portal`) for submitting tickets and tracking resolutions; IT Service Desk Console (`/admin`) for queue triage, workload balancing, and SLA tracking.
- **Staff-Only Internal Notes**: Private collaboration notes on tickets exclusively visible to support engineers and administrators. Internal notes are filtered at the database query level for customers and do not reset SLA response timers.
- **Immutable Audit Trail & Retention**: System-wide audit logging tracks ticket lifecycle events, authentication anomalies, and administrative mutations. An explicit PostgreSQL trigger (`protect_audit_logs()`) prevents unauthorized modifications or deletions, with configurable retention policies and sensitive PII/credential sanitization.
- **Configurable SLA Policies & Philippine Calendars**: Tiered SLA targets (First Response & Resolution) configured per priority and department. Business hours are calculated against the Philippine Standard Time calendar (`Asia/Manila`, UTC+8, Mon–Fri 08:00–12:00 & 13:00–17:00) with automatic suspension during official 2026 Philippine public holidays (Proclamation No. 1006). Timers automatically pause when a ticket enters `NEEDS_INFO` and resume when the customer responds.
- **Automated SLA Sweeper & Alerting**: A background cron sweeper evaluates active tickets every minute, triggering warnings at 75% elapsed duration and breach notifications to assignees and administrators via real-time WebSocket events.
- **Automated Routing & Escalation**: Fair round-robin assignment across active engineers and automated urgency escalation for high-severity incidents.
- **Self-Service Knowledge Base**: Full editorial lifecycle (`DRAFT`, `PUBLISHED`, `ARCHIVED`) with customer feedback voting and deflection analytics.
- **Dual-Token Authentication**: In-memory JWT access tokens, rotating HTTP-only refresh cookies with token family reuse detection, and invite-only staff provisioning.
- **Reporting & Analytics**: Real-time KPI dashboards, interactive 5-star customer satisfaction (CSAT) ratings, agent leaderboards, and RFC 4180 CSV exports.
- **Global Incident Banners**: Live broadcast banners for ongoing service disruptions and scheduled maintenance.
- **Canned Responses**: Pre-built troubleshooting templates embedded in the resolution note composer.
- **Edge Route Protection**: Server-side route guarding with instant redirection for unauthenticated visitors and pre-paint theme hydration.

---

## Technology Stack

| Layer | Technologies |
|:---|:---|
| **Frontend** | Next.js 16 (App Router, Turbopack, React 19), Tailwind CSS v4, TanStack Query v5, Orval, Zustand, Radix UI, Lucide Icons |
| **Backend** | NestJS 12 (Node.js ESM), Passport JWT, Prisma ORM 7 (`@prisma/adapter-pg`), AWS SDK v3, `@nestjs/throttler`, `@nestjs/schedule`, Zod |
| **Database & Cache** | PostgreSQL 16, Redis 7 (rate limiting & cache) |
| **Object Storage** | S3 / MinIO (`pgsty/silo`) for encrypted diagnostic attachments |
| **Tooling & Monorepo** | Turborepo, Docker Compose, Orval OpenAPI code generator |
| **Testing & Quality** | Vitest 4, Supertest, ESLint 9, Oxlint, strict TypeScript |

---

## Monorepo Structure

```
TicketSupport/
├── apps/
│   ├── web/                 # Next.js frontend (Customer Portal, Admin Console, Edge Proxy)
│   └── api/                 # NestJS backend API (Auth, Tickets, SLA, Audit, SSE, KB, Reports)
├── docker-compose.yml       # Local container services (PostgreSQL 16, Redis 7, MinIO/S3)
├── turbo.json               # Turborepo task pipeline configuration
└── AGENTS.md                # Repository engineering standards & branch protection rules
```

---

## Role Permissions Matrix

| Capability | Customer | Agent | Admin |
|:---|:---:|:---:|:---:|
| Submit support tickets & attach encrypted files | ✓ | ✓ | ✓ |
| View & manage own submitted tickets | ✓ | ✓ | ✓ |
| Submit ticket follow-up replies & extra files | ✓ | — | — |
| Rate resolved tickets (1–5 Star CSAT) | ✓ | — | — |
| Access IT Service Desk Console (`/admin`) | — | ✓ | ✓ |
| Claim unassigned tickets & update statuses | — | ✓ | ✓ |
| Trigger automated round-robin assignment | — | ✓ | ✓ |
| Post public resolution notes with canned responses | — | ✓ | ✓ |
| Post staff-only internal notes | — | ✓ | ✓ |
| Reassign tickets across engineers | — | — | ✓ |
| Publish, archive, or delete Knowledge Base articles | — | — | ✓ |
| Generate staff invitations (Agent / Admin) | — | — | ✓ |
| Manage global incident & outage banners | — | — | ✓ |
| View & filter security audit logs | — | — | ✓ |
| Configure audit log retention policies | — | — | ✓ |
| View & configure SLA policies & business calendars | — | View | ✓ |
| Access executive reports & export CSV data | — | ✓ | ✓ |

---

## Environment Configuration

Copy the sample environment file to `.env`:

```bash
cp .env.example .env
```

Key environment configurations include:

| Variable | Description | Default / Example |
|:---|:---|:---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/ticketsupport?schema=public` |
| `REDIS_URL` | Redis instance for rate limiting | `redis://localhost:6379` |
| `JWT_SECRET` | Secret key for signing access tokens (min 32 chars) | Random 32+ character string |
| `S3_ENDPOINT` | Object storage endpoint for attachments | `http://localhost:9000` (MinIO) |
| `NEXT_PUBLIC_API_URL` | Backend API URL for frontend client | `http://localhost:3001` |
| `NEXT_PUBLIC_ATTACHMENT_KEY` | Client transit encryption key for files | 32-character AES key |

---

## API Documentation (Swagger)

All REST API endpoints, request schemas, DTOs, and error responses are documented interactively:

- **Swagger UI**: [http://localhost:3001/api/docs](http://localhost:3001/api/docs)
- **OpenAPI 3.1 Spec**: [http://localhost:3001/api-json](http://localhost:3001/api-json)

---

## Quick Start

### 1. Prerequisites
- **Node.js**: v20+ & **npm**: v10+
- **Docker Desktop**: for PostgreSQL 16, Redis 7, and MinIO/S3

### 2. Environment & Services
```bash
# Copy environment configuration
cp .env.example .env

# Start database, cache, and object storage containers
docker compose up -d
```

### 3. Setup & Database Seeding
```bash
# Install dependencies across monorepo
npm install

# Run database migrations and seed default dev accounts, Philippine calendar, and default SLAs
npm run db:setup

# (Optional) Standalone database commands:
# npm run db:migrate       # Apply pending migrations (prisma migrate deploy)
# npm run db:migrate:dev   # Create and apply migrations in development (prisma migrate dev)
# npm run db:seed          # Seed/upsert dev accounts, Philippine calendar, and SLA policies

# Generate typed API client hooks (Orval + TanStack Query v5)
npm run codegen
```

### 4. Run Development Servers
```bash
npm run dev
```

- **Frontend Web App**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:3001](http://localhost:3001)
- **Swagger OpenAPI Docs**: [http://localhost:3001/api/docs](http://localhost:3001/api/docs)

### 5. Running Tests
```bash
# Run all unit and integration test suites across monorepo
npm test

# Typecheck and lint validation
npm run typecheck
npm run lint
```
