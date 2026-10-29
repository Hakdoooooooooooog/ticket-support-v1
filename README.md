# TicketSupport Platform

TicketSupport is an enterprise IT service desk and incident triage platform. It provides dedicated, role-scoped workspaces for customer support requests and IT engineering operations—featuring real-time push updates, client-side zero-knowledge encrypted attachments, database-backed ticket deflection, and automated dispatch.

---

## Core Purpose & Architecture

- **End-to-End Incident Lifecycle**: Structured triage from customer ticket submission to automated round-robin assignment, staff resolution notes, and customer CSAT reviews.
- **Proactive Ticket Deflection**: Reduces support load by matching incoming inquiries against self-service knowledge base articles in real time before submission.
- **Zero-Knowledge Security**: Diagnostic attachments and screenshots are compressed and encrypted client-side (AES-GCM 256-bit) before transmission.
- **Real-Time Push Updates**: Server-Sent Events (SSE) keep queue statuses, in-app notifications, and outage banners synchronized across all connected clients without polling.

---

## Key Features

- **Role-Based Workspaces**: Customer Portal (`/portal`) for submitting tickets and tracking resolutions; IT Service Desk Console (`/admin`) for queue triage, workload balancing, and SLA tracking.
- **Automated Routing & Escalation**: Fair round-robin assignment across active engineers and automated urgency escalation for high-severity incidents.
- **Self-Service Knowledge Base**: Full editorial lifecycle (`DRAFT`, `PUBLISHED`, `ARCHIVED`) with customer feedback voting and deflection analytics.
- **Dual-Token Authentication**: In-memory JWT access tokens, rotating HTTP-only refresh cookies with token family reuse detection, and invite-only staff provisioning.
- **Reporting & Analytics**: Real-time KPI dashboards, interactive 5-star customer satisfaction (CSAT) ratings, agent leaderboards, and RFC 4180 CSV exports.
- **Global Incident Banners**: Live broadcast banners for ongoing service disruptions and scheduled maintenance.
- **Canned Responses**: Pre-built troubleshooting templates embedded in the resolution note composer.
- **Edge Route Protection**: Server-side route guarding with instant redirection for unauthenticated visitors and pre-paint theme hydration.

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
| Post resolution notes with canned responses | — | ✓ | ✓ |
| Reassign tickets across engineers | — | — | ✓ |
| Publish, archive, or delete Knowledge Base articles | — | — | ✓ |
| Generate staff invitations (Agent / Admin) | — | — | ✓ |
| Manage global incident & outage banners | — | — | ✓ |
| Access executive reports & export CSV data | — | ✓ | ✓ |

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

### 3. Setup & Code Generation
```bash
# Install dependencies across monorepo
npm install

# Initialize database schema and Prisma Client
npm --prefix apps/api run db:push
npm --prefix apps/api run db:generate

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
# Run all test suites across the monorepo
npm test
```
