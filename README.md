# TicketSupport Platform

TicketSupport is an enterprise IT service desk and incident response platform built with **Next.js 16**, **NestJS 12**, **Prisma 7**, **PostgreSQL 16**, **Redis 7**, and **Turborepo**.

It provides dedicated workspaces for both end-user customers and IT support personnel, featuring role-scoped ticket triage, rotating session tokens, server-side Edge route protection, client-side encrypted attachments, an in-app notification center, 5-star customer satisfaction (CSAT) ratings, categorized canned responses, a database-backed Knowledge Base with real-time ticket deflection, and invite-only staff provisioning.

---

## Key Features

### 1. Workspaces & Role-Based Access Control
- **Customer Support Portal (`/portal`)**: Allows registered customers to submit support tickets, select department routing (`Technical Support` or `General Inquiry`), attach encrypted diagnostic screenshots, monitor live resolution progress, respond to engineer follow-up requests, and rate completed service.
- **IT Service Desk Console (`/admin`)**: Command center for support engineers and administrators to monitor real-time SLA metrics, triage unassigned tickets, claim incidents, update priorities, trigger automated round-robin assignments, author/publish self-service guides, and append resolution notes.
- **Strict Role Authorization**: Custom `@Roles('ADMIN', 'AGENT', 'CUSTOMER')` decorator and global `RolesGuard` strictly validate permissions on every endpoint. Sensitive operations (personnel directory, report metrics, auto-assignment, ticket deletion, article publishing) enforce role requirements.
- **Staff Ownership & Closed Immutability**: Only assigned support engineers or administrators can update ticket status or post notes. Once marked `CLOSED`, incidents are permanently locked from modifications unless explicitly reopened.
- **Invite-Only Staff Provisioning (`/admin` &rarr; Team & Invites)**: Public registration is strictly restricted to customer accounts. IT Support Engineers (`AGENT`) and Administrators (`ADMIN`) must be invited by an existing administrator via cryptographically secure single-use claim tokens.

### 2. Enterprise Authentication & Security Lockdown
- **Dual-Token Session Architecture**:
  - **Access Token**: Short-lived 15-minute Bearer JWT kept strictly in client runtime memory (never written to `localStorage` or `sessionStorage` in plaintext).
  - **Rotating Refresh Token**: Long-lived 7-day cryptographically random token stored in an `httpOnly`, `sameSite=lax` cookie (`rt`).
  - **Token Family & Reuse Detection**: Refresh tokens are stored as SHA-256 hashes in PostgreSQL. If a previously rotated token is presented again (indicating token theft), the entire token family is immediately revoked, forcing re-authentication.
- **Transparent Refresh Interceptor**: The frontend Axios client automatically catches `401 Unauthorized` responses on expired access tokens, silently calls `POST /auth/refresh` using the `httpOnly` cookie, updates the Zustand auth store, and replays the original request without user interruption.
- **Redis-Backed Rate Limiting**: Built on `@nestjs/throttler` with a custom `RedisThrottlerStorage` adapter (and in-memory fallback). Protects login, registration, invite verification, and token refresh endpoints against brute-force attacks.
- **Tenant Isolation**: Realtime SSE streams (`COMMENT_ADDED`, `TICKET_UPDATED`, `TICKET_DELETED`) and ticket read operations are strictly scoped to staff and the owning customer ID, preventing cross-tenant data leaks.
- **Security Headers & Hardening**: API is protected with Helmet HTTP headers, dynamic CORS origin verification, and trust-proxy support.

### 3. Next.js Edge Proxy & Route Protection (`proxy.ts`)
- **Server-Side Route Guarding**: Native Next.js 16 Edge proxy intercepts direct page requests to `/admin` and `/portal`. If the user does not possess an active `rt` session cookie, they are redirected to `/` (with `?redirect=/path`) before page HTML renders, eliminating visual flashes of unauthenticated content.
- **Edge Security Headers**: Automatically injects enterprise security headers across all matched routes:
  - `X-Frame-Options: DENY` (anti-clickjacking)
  - `X-Content-Type-Options: nosniff` (anti-MIME sniffing)
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()`

### 4. Database-Backed Knowledge Base & Ticket Deflection Engine
- **PostgreSQL Persistence**: Managed via Prisma models `KnowledgeArticle`, `ArticleFeedback` (composite key `[articleId, userId]`), and `ArticleDeflection`.
- **Full Editorial Lifecycle**: Articles progress through `DRAFT`, `PUBLISHED`, and `ARCHIVED` statuses. Support Agents and Admins can draft guides; only Administrators can publish guides to the public portal or archive them.
- **Admin Knowledge Base Manager (`/admin` &rarr; Knowledge Base)**:
  - Live KPI metrics: Total articles, Technical Support volume, General Scope volume, Helpful votes, and Deflections.
  - Interactive Article Composer with Title, Department, Category, Summary, Tags, Keywords, and dynamic numbered Resolution Steps.
  - Markdown content editor featuring tabbed **Write** and live **Preview** powered by `react-markdown` and `remark-gfm`.
  - Publishing, archiving, and permanent deletion controls.
- **Proactive Ticket Deflection**: As customers draft a ticket title in `/portal`, the deflection engine scores keywords and symptoms in real time. If a match is found, an expandable preview banner offers the solution immediately.
- **1-Click Self-Resolution**: A `"✓ This Solved My Problem"` action increments deflection analytics in PostgreSQL and safely clears the ticket draft without entering the queue.
- **Customer Feedback**: In-app `👍 Helpful` and `👎 No` voting. Changing a vote replaces the previous response and atomically recalculates article feedback totals.

### 5. Department Routing & Round-Robin Assignment
- **Focused Department Scoping**: Tickets are categorized into two primary service domains:
  - `TECHNICAL_SUPPORT`: Dedicated technical troubleshooting, hardware/software outages, and system errors.
  - `GENERAL`: Account questions, licensing, operational requests, and general customer inquiries.
- **Automated Round-Robin Dispatch**:
  - Automatically matches unassigned incoming tickets with active frontline support engineers (`role: 'AGENT'`) based on department specialty.
  - Rotates workload fairly according to `lastAssignedAt ASC, createdAt ASC`, ensuring balanced assignment across the support team.
  - Staff can run on-demand round-robin reassignment via `POST /tickets/:id/auto-assign` or through the interactive Admin Console queue item button.

### 6. Data Export & Reporting Studio (`/admin` &rarr; Reports & CSAT)
- **Executive Metric Dashboards**: Live service desk KPIs featuring total volume, overall resolution rates, unassigned backlogs, and real-time department allocation split (`Technical Support` vs `General Scope`).
- **Customer Satisfaction (CSAT) Breakdown**: Average ratings, review counts, and 1–5 star distribution progress telemetry.
- **Support Engineer Performance Leaderboard**: Per-agent audit view showing active tickets assigned, total resolved incidents, CSAT averages, and round-robin assignment rotation turns.
- **RFC 4180 CSV Export**: Instant downloads of raw incident archives and customer satisfaction feedback with export filter presets (department, status, priority). All exported fields are safely escaped per RFC 4180 standards.

### 7. In-App Notification Center
- **Role-Filtered Dispatch**: Real-time popover notification feed with unread count indicators.
- **IT Administrators**: Strictly receive notifications for new incoming customer tickets (`TICKET_CREATED`) to keep queue triage actionable without operational noise.
- **Support Engineers**: Receive alerts for ticket assignments (`TICKET_ASSIGNED`), customer replies (`TICKET_CUSTOMER_AMENDED`), and satisfaction ratings (`TICKET_STATUS_CHANGED`).
- **Customers**: Receive alerts when staff request follow-up info (`TICKET_FOLLOW_UP_REQUESTED`), post resolution notes (`TICKET_NOTE_POSTED`), or resolve/close incidents (`TICKET_STATUS_CHANGED`).

### 8. Customer Satisfaction (CSAT) Rating Engine
- **5-Star Interactive Rating**: Rendered on resolved and closed tickets with optional text reviews.
- **Strict Anti-Tampering Rules**: Satisfaction ratings can only be submitted by the customer who reported the ticket. Support staff and administrators attempting to self-rate are blocked with `403 Forbidden`.
- **Live Sentiment Telemetry**: Aggregated CSAT averages and review counts displayed on the IT Admin Console dashboard.

### 9. Categorized Canned Responses
- Quick-reply template library embedded in the resolution note composer for fast, standardized incident triage:
  - **Troubleshooting**: Hardware power cycles, VPN/DNS cache flushes, browser data resets, and clean app reinstalls.
  - **Investigation & Follow-Up**: Additional details requests, bug reproduction notices, engineering escalations, and maintenance advisories.
  - **Resolution & Closure**: Verified fix confirmations, knowledge-base references, and inactivity warnings.

### 10. Client-Side Image Encryption & Lightbox
- **Zero-Knowledge Attachments**: Customer screenshots and logs are compressed via the HTML Canvas API and encrypted in-browser using AES-GCM 256-bit cryptography before uploading to the server.
- **In-Browser Decryption**: Decrypted on-demand only in authenticated staff and customer sessions.
- **Integrated Lightbox**: Full-screen inspect modal with zoom, rotation, and file metadata inspection.

### 11. Real-Time Push Events (Server-Sent Events / SSE)
- **Zero-Latency Dispatch**: Replaces aggressive background polling with HTTP/2 Server-Sent Events (`/realtime/stream`), pushing instant ticket mutations, follow-up notes, and role-filtered notification alerts.
- **Reactive Cache Invalidation**: The Next.js frontend invalidates TanStack Query caches the millisecond a mutation is committed on PostgreSQL.
- **Live Stream Telemetry**: Dynamic visual indicators in both `/admin` and `/portal` show active socket health (`Live Connected`, `Connecting...`, `Offline`) with exponential reconnect backoff.

---

## Monorepo Architecture

```
TicketSupport/
├── apps/
│   ├── web/                     # Next.js 16 (App Router, React 19, Turbopack, Tailwind CSS v4)
│   │   ├── src/
│   │   │   ├── app/             # Application routes (/, /portal, /admin)
│   │   │   ├── proxy.ts         # Edge middleware: server-side route guards & security headers
│   │   │   ├── hooks/           # useRealtimeEvents SSE hook & cache sync
│   │   │   ├── components/      # Domain components, modals, UI primitives
│   │   │   │   ├── admin/       # Service desk console, KPI grid, KB manager, Reports Studio
│   │   │   │   ├── forms/       # React Hook Form + Zod ticket composer & live deflection
│   │   │   │   ├── portal/      # Customer portal & self-service knowledge base
│   │   │   │   └── ui/          # Accessible UI primitives & ContextualLoader
│   │   │   ├── lib/             # API client, transparent refresh interceptor, AES encryption
│   │   │   └── store/           # Zustand stores (auth, tickets, admin, portal)
│   │   └── package.json
│   │
│   └── api/                     # NestJS 12 (Node.js, Express, Passport JWT, Zod)
│       ├── prisma/
│       │   ├── schema.prisma    # PostgreSQL entities (User, Ticket, RefreshToken, KnowledgeArticle)
│       │   └── migrations/      # Historical SQL migrations
│       ├── prisma.config.ts     # Prisma 7 centralized datasource configuration
│       ├── src/
│       │   ├── auth/            # JWT auth, rotating refresh token lifecycle, staff invites
│       │   ├── common/          # @Roles() decorator, RolesGuard, RedisThrottlerStorage
│       │   ├── knowledge-base/  # DB-backed troubleshooting guides, deflection, feedback
│       │   ├── tickets/         # State machines, round-robin dispatch, CSAT ratings
│       │   ├── reports/         # Executive reporting KPIs, RFC 4180 CSV export
│       │   ├── notifications/   # Role-filtered in-app notification service
│       │   ├── realtime/        # Scoped SSE event stream & heartbeat service
│       │   └── database/        # PrismaService using @prisma/adapter-pg
│       ├── test/
│       │   ├── unit/            # Vitest unit test suites (161 passing)
│       │   └── e2e/             # Supertest API integration test suites (24 passing)
│       └── package.json
│
├── docker-compose.yml           # PostgreSQL 16 & Redis 7 container definitions
├── turbo.json                   # Turborepo build and pipeline cache rules
└── package.json                 # Monorepo dependencies and workspace scripts
```

---

## Role Permissions Matrix

| Capability | CUSTOMER | AGENT | ADMIN |
|:---|:---:|:---:|:---:|
| Submit support ticket with department routing & encrypted attachment | Yes | Yes | Yes |
| View own submitted tickets | Yes | Yes | Yes |
| Amend own ticket description / upload extra files | Yes | No | No |
| Rate resolved ticket (CSAT 1–5 stars) | Yes | No (403) | No (403) |
| Access IT Admin Console (`/admin`) | No (Redirect) | Yes | Yes |
| View global incident queue & SLA metrics | No | Yes | Yes |
| Claim unassigned ticket / assign to self | No | Yes | Yes |
| Reassign ticket to any engineer | No | No | Yes |
| Trigger automated round-robin ticket auto-assignment | No | Yes | Yes |
| Post resolution notes on assigned ticket | No | Yes | Yes |
| Change status (`OPEN` &rarr; `IN_PROGRESS` &rarr; `RESOLVED` &rarr; `CLOSED`) | No | Yes | Yes |
| Reopen closed ticket | Yes (Own) | Yes | Yes |
| Access Data Export & Reporting Studio (`/admin` &rarr; Reports) | No | Yes | Yes |
| Export incident logs & CSAT feedback as RFC 4180 CSV | No | Yes | Yes |
| Draft knowledge base troubleshooting articles | No | Yes | Yes |
| Publish / archive / delete knowledge base articles | No | No | Yes |
| Generate staff invitations (AGENT/ADMIN) | No | No | Yes |
| Receive `TICKET_CREATED` notifications | No | No | Yes |
| Receive assignment & operational alerts | No | Yes | No |

---

## Technology Stack

- **Frontend**: Next.js 16.4 (Turbopack, App Router, React 19), Tailwind CSS v4, TanStack Query v5, Zustand, Axios, react-markdown, remark-gfm, Radix UI.
- **Backend**: NestJS 12, Node.js (ESM), Passport JWT, `@nestjs/throttler`, ioredis, helmet, cookie-parser, nestjs-zod, Zod, bcryptjs.
- **Database & Cache**: PostgreSQL 16, Redis 7, Prisma ORM 7 (`@prisma/adapter-pg` pool adapter).
- **Monorepo Tools**: Turborepo 2.4, Docker Compose.
- **Testing & Verification**: Vitest 4, Supertest, Playwright MCP.

---

## Quick Start Guide

### 1. Prerequisites
- **Node.js**: v20 or v22 LTS (v24 supported)
- **Docker Desktop**: for PostgreSQL 16 & Redis 7
- **npm**: v10+

### 2. Environment Configuration
Copy the sample environment file to the project root:

```bash
cp .env.example .env
```

Ensure the root `.env` contains the required keys:

```ini
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ticketsupport?schema=public"
REDIS_URL="redis://localhost:6379"
PORT=3001
NODE_ENV=development
JWT_SECRET="your_jwt_secret_min_32_characters_here"
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3000
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

### 3. Start Database & Cache Services
Start the PostgreSQL 16 and Redis 7 Docker containers:

```bash
docker compose up -d
```

### 4. Database Setup & Migrations
From the project root:

```bash
npm --prefix apps/api run db:push
npm --prefix apps/api run db:generate
```

### 5. Launch Development Servers
Run the full monorepo pipeline using Turborepo:

```bash
npm run dev
```

* **Frontend Web Application**: [http://localhost:3000](http://localhost:3000)
* **Backend API**: [http://localhost:3001](http://localhost:3001)
* **Swagger OpenAPI Documentation**: [http://localhost:3001/api/docs](http://localhost:3001/api/docs)
* **OpenAPI JSON Spec**: [http://localhost:3001/api-json](http://localhost:3001/api-json)

---

## Testing & Verification

Run all test suites across the monorepo (250+ passing tests):

```bash
# Run all unit test suites across monorepo (API: 161 tests, Web: 65 tests)
npm test

# Run backend unit tests specifically (161 tests across 23 suites)
npm --prefix apps/api test

# Run frontend unit tests and strict TypeScript compiler check (65 tests across 7 suites)
npm --prefix apps/web test

# Run backend end-to-end integration tests (24 tests)
npm --prefix apps/api run test:e2e

# Run frontend production build (Turbopack standalone build)
npm --prefix apps/web run build
```
