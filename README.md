# TicketSupport Platform

TicketSupport is an enterprise IT service desk and incident response platform built with **Next.js 16**, **NestJS 12**, **Prisma 7**, **PostgreSQL**, and **Turborepo**.

It provides dedicated workspaces for both end-user customers and IT support personnel, featuring role-scoped ticket triage, client-side encrypted attachments, an in-app notification center, 5-star customer satisfaction (CSAT) ratings, categorized canned responses, and invite-only staff provisioning.

---

## Key Features

### 1. Workspaces & Role-Based Access Control
- **Customer Support Portal (`/portal`)**: Allows registered customers to submit support tickets, select department routing (`Technical Support` or `General Inquiry`), attach encrypted diagnostic screenshots, monitor live resolution progress, respond to engineer follow-up requests, and rate completed service.
- **IT Service Desk Console (`/admin`)**: Command center for support engineers and administrators to monitor real-time SLA metrics, triage unassigned tickets, claim incidents, update priorities, trigger automated round-robin assignments, and append resolution notes.
- **Staff Ownership & Closed Immutability**: Only assigned support engineers or administrators can update ticket status or post notes. Once marked `CLOSED`, incidents are permanently locked from modifications unless explicitly reopened.
- **Invite-Only Staff Provisioning (`/admin` &rarr; Team & Invites)**: Public registration is strictly restricted to customer accounts. IT Support Engineers (`AGENT`) and Administrators (`ADMIN`) must be invited by an existing administrator via cryptographically secure single-use claim tokens.

### 2. Department Routing & Round-Robin Assignment
- **Focused Department Scoping**: Tickets are categorized into two primary service domains:
  - `TECHNICAL_SUPPORT`: Dedicated technical troubleshooting, hardware/software outages, and system errors.
  - `GENERAL`: Account questions, licensing, operational requests, and general customer inquiries.
- **Automated Round-Robin Dispatch**:
  - Automatically matches unassigned incoming tickets with active frontline support engineers (`role: 'AGENT'`) based on department specialty.
  - Rotates workload fairly according to `lastAssignedAt ASC, createdAt ASC`, ensuring balanced assignment across the support team.
  - One-click manual triage trigger: Staff can run on-demand round-robin reassignment via `POST /tickets/:id/auto-assign` or through the interactive Admin Console queue item button.

### 3. Data Export & Reporting Studio (`/admin` &rarr; Reports & CSAT)
- **Executive Metric Dashboards**: Live service desk KPIs featuring total volume, overall resolution rates, unassigned backlogs, and real-time department allocation split (`Technical Support` vs `General Scope`).
- **Customer Satisfaction (CSAT) Breakdown**: Average ratings, review counts, and 1–5 star distribution progress telemetry.
- **Support Engineer Performance Leaderboard**: Per-agent audit view showing active tickets assigned, total resolved incidents, CSAT averages, and round-robin assignment rotation turns.
- **RFC 4180 CSV Export**: Instant downloads of raw incident archives and customer satisfaction feedback with export filter presets (department, status, priority). All exported fields are safely escaped per RFC 4180 standards.

### 4. In-App Notification Center
- **Role-Filtered Dispatch**: Real-time popover notification feed with unread count indicators.
- **IT Administrators**: Strictly receive notifications for new incoming customer tickets (`TICKET_CREATED`) to keep queue triage actionable without operational noise.
- **Support Engineers**: Receive alerts for ticket assignments (`TICKET_ASSIGNED`), customer replies (`TICKET_CUSTOMER_AMENDED`), and satisfaction ratings (`TICKET_STATUS_CHANGED`).
- **Customers**: Receive alerts when staff request follow-up info (`TICKET_FOLLOW_UP_REQUESTED`), post resolution notes (`TICKET_NOTE_POSTED`), or resolve/close incidents (`TICKET_STATUS_CHANGED`).

### 5. Customer Satisfaction (CSAT) Rating Engine
- **5-Star Interactive Rating**: Rendered on resolved and closed tickets with optional text reviews.
- **Strict Anti-Tampering Rules**: Satisfaction ratings can only be submitted by the customer who reported the ticket. Support staff and administrators attempting to self-rate are blocked with `403 Forbidden`.
- **Live Sentiment Telemetry**: Aggregated CSAT averages and review counts displayed on the IT Admin Console dashboard.

### 6. Categorized Canned Responses
- Quick-reply template library embedded in the resolution note composer for fast, standardized incident triage:
  - **Troubleshooting**: Hardware power cycles, VPN/DNS cache flushes, browser data resets, and clean app reinstalls.
  - **Investigation & Follow-Up**: Additional details requests, bug reproduction notices, engineering escalations, and maintenance advisories.
  - **Resolution & Closure**: Verified fix confirmations, knowledge-base references, and inactivity warnings.

### 7. Client-Side Image Encryption & Lightbox
- **Zero-Knowledge Attachments**: Customer screenshots and logs are compressed via the HTML Canvas API and encrypted in-browser using AES-GCM 256-bit cryptography before uploading to the server.
- **In-Browser Decryption**: Decrypted on-demand only in authenticated staff and customer sessions.
- **Integrated Lightbox**: Full-screen inspect modal with zoom, rotation, and file metadata inspection.

### 8. Real-Time Push Events (Server-Sent Events / SSE)
- **Zero-Latency Dispatch**: Replaces aggressive background polling with HTTP/2 Server-Sent Events (`/realtime/stream`), pushing instant ticket mutations, follow-up notes, and role-filtered notification alerts.
- **Reactive Cache Invalidation**: The Next.js frontend invalidates TanStack Query caches the millisecond a mutation is committed on PostgreSQL.
- **Live Stream Telemetry**: Dynamic visual indicators in both `/admin` and `/portal` show active socket health (`Live Connected`, `Connecting...`, `Offline`) with exponential reconnect backoff.

### 9. Design System & Display Resilience
- **Emoji-Free Visual Hierarchy**: Incident priorities and queue health are communicated using calibrated color systems and badge borders (Critical/Urgent in Rose, Triage in Amber, Assigned to Me in Blue, CSAT Score in Gold, Resolved in Emerald).
- **1280×720 Display Optimization**: Responsive 4-column KPI grid preventing awkward badge overlaps, text wrapping, and viewport cramping on compact displays and laptops.
- **Jitter-Free Background Polling**: Layout shifts during TanStack Query polling are eliminated with fixed-width action controls (`w-32`) and structural skeleton loaders (`ContextualLoader`).
- **Prominent Navigation & Dual Sign Out**: System version badge (`v1.0.0`) in the sidebar footer and high-contrast dual sign-out actions in both the profile card and elevated bottom panel.

---

## Monorepo Architecture

```
TicketSupport/
├── apps/
│   ├── web/                     # Next.js 16 (App Router, React 19, Turbopack, Tailwind CSS v4)
│   │   ├── src/
│   │   │   ├── app/             # Application routes (/, /portal, /admin)
│   │   │   ├── hooks/           # useRealtimeEvents SSE hook & cache sync
│   │   │   ├── components/      # Domain components, modals, UI primitives
│   │   │   │   ├── admin/       # Service desk console, KPI grid, Reports Studio
│   │   │   │   ├── forms/       # React Hook Form + Zod ticket composer (dept routing)
│   │   │   │   └── ui/          # Accessible UI primitives & ContextualLoader
│   │   │   ├── lib/             # API client, AES encryption, constants, helpers
│   │   │   └── store/           # Zustand stores (auth, tickets, admin)
│   │   └── package.json
│   │
│   └── api/                     # NestJS 12 (Node.js, Express, Passport JWT, Zod)
│       ├── prisma/
│       │   ├── schema.prisma    # PostgreSQL domain entities, Department & Role enums
│       │   └── migrations/      # Historical SQL migrations (inc. round-robin)
│       ├── prisma.config.ts     # Prisma 7 centralized datasource configuration
│       ├── src/
│       │   ├── auth/            # JWT authentication, invite generation & claim
│       │   ├── tickets/         # Ticket state machines, round-robin dispatch, CSAT
│       │   ├── reports/         # Executive reporting KPIs, RFC 4180 CSV export
│       │   ├── notifications/   # Role-filtered in-app notification service
│       │   ├── realtime/        # SSE event stream & heartbeat service
│       │   └── database/        # PrismaService using @prisma/adapter-pg
│       ├── test/
│       │   ├── unit/            # Vitest unit test suites (136 passing)
│       │   └── e2e/             # Supertest API integration test suites (25 passing)
│       └── package.json
│
├── docker-compose.yml           # PostgreSQL 16 container definition
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
| Generate staff invitations (AGENT/ADMIN) | No | No | Yes |
| Receive `TICKET_CREATED` notifications | No | No | Yes |
| Receive assignment & operational alerts | No | Yes | No |
| Claim unassigned ticket / assign to self | No | Yes | Yes |
| Reassign ticket to any engineer | No | No | Yes |
| Post resolution notes on assigned ticket | No | Yes | Yes |
| Change status (`OPEN` &rarr; `IN_PROGRESS` &rarr; `RESOLVED` &rarr; `CLOSED`) | No | Yes | Yes |
| Reopen closed ticket | Yes (Own) | Yes | Yes |
| Generate staff invitations (AGENT/ADMIN) | No | No | Yes |
| Receive `TICKET_CREATED` notifications | No | No | Yes |
| Receive assignment & operational alerts | No | Yes | No |

---

## Technology Stack

- **Frontend**: Next.js 16.4 (Turbopack, App Router, React 19), Tailwind CSS v4, TanStack Query v5, Zustand, Axios, Radix UI.
- **Backend**: NestJS 12, Node.js (ESM), Passport JWT, nestjs-zod, Zod, bcryptjs.
- **Database & ORM**: PostgreSQL 16, Prisma ORM 7 (`@prisma/adapter-pg` pool adapter).
- **Monorepo Tools**: Turborepo 2.4, Docker Compose.
- **Testing**: Vitest 4, Supertest.

---

## Quick Start Guide

### 1. Prerequisites
- **Node.js**: v20 or v22 LTS (v24 supported)
- **Docker Desktop**: for PostgreSQL 16
- **npm**: v10+

### 2. Environment Configuration
Copy the sample environment file to the project root:

```bash
cp .env.example .env
```

Ensure the root `.env` contains the required keys:

```ini
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ticketsupport?schema=public"
PORT=3001
NODE_ENV=development
JWT_SECRET="your-secure-jwt-secret-here"
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

### 3. Start Database Service
Start the PostgreSQL 16 Docker container:

```bash
npm run db:up
```

### 4. Database Setup & Migrations
From the project root:

```bash
# Push Prisma schema to PostgreSQL and generate client
cd apps/api
npx prisma db push
npx prisma generate
cd ../..
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

Run all test suites across the monorepo (209 passing tests):

```bash
# Run all unit test suites across monorepo (API: 136 tests, Web: 48 tests)
npm test

# Run backend unit tests specifically (136 tests across 19 suites)
npm --prefix apps/api test

# Run frontend unit tests specifically (48 tests across 4 suites)
npm --prefix apps/web test

# Run backend end-to-end integration tests (25 tests)
npm --prefix apps/api run test:e2e

# Run frontend production build (Turbopack + TypeScript checks)
npm --prefix apps/web run build
```
