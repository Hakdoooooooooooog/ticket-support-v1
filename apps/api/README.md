# TicketSupport API Backend

The TicketSupport API is a NestJS enterprise backend powering authentication, ticket lifecycle state machines, staff invitations, in-app notifications, real-time push streams, and customer satisfaction tracking.

---

## Core Purpose

- **Zero-Knowledge Architecture**: Secure pre-signed URL issuance and streaming endpoints for client-encrypted attachments.
- **Fair Workload Balancing**: Automated round-robin dispatch matching incoming incidents with active engineers by department.
- **Deflection & Self-Service**: Database-backed knowledge base management with keyword deflection analytics.
- **Real-Time Push Stream**: Low-latency Server-Sent Events (SSE) broadcast for instant ticket updates and notifications.

---

## Features

- **Authentication & Authorization**: Passport JWT authentication with rotating refresh token cookies, SHA-256 token family reuse detection, and role-based guards (`ADMIN`, `AGENT`, `CUSTOMER`).
- **Ticket Lifecycle State Machine**: Controlled status progression (`OPEN` → `IN_PROGRESS` → `RESOLVED` → `CLOSED`) with immutable closed ticket locks and reopening workflows.
- **Automated Round-Robin Dispatch**: Fair workload rotation across active support engineers scoped by department specialty (`Technical Support` and `General Inquiry`).
- **Urgency Auto-Escalation**: Signal-based detection engine that automatically analyzes incident descriptions and escalates critical production outages to urgent priority.
- **Real-Time Event Stream**: Server-Sent Events (SSE) broadcast service delivering instant ticket mutations, follow-up comments, outage banners, and role-scoped notifications.
- **In-App Notification Service**: Granular, role-filtered notification dispatch ensuring administrators receive triage alerts while engineers receive assigned ticket updates.
- **Knowledge Base & Deflection API**: Full article lifecycle management (`DRAFT`, `PUBLISHED`, `ARCHIVED`), keyword deflection search, and customer feedback voting.
- **Customer Satisfaction (CSAT)**: Verified 5-star customer ratings with anti-tampering enforcement restricting reviews to ticket creators.
- **Reporting & Data Export**: Department KPIs, SLA metrics, and RFC 4180 CSV export endpoints for incident logs and customer satisfaction feedback.
- **S3 & Object Storage Integration**: Pre-signed direct upload and proxy streaming endpoints for client-encrypted file attachments.
- **Security & Hygiene**: Redis-backed rate limiting, Helmet HTTP security headers, CORS verification, and automatic PII redaction on sensitive logs.

---

## How to Run

```bash
# 1. From workspace root, ensure Docker containers are active
docker compose up -d

# 2. Push schema and generate Prisma Client
npm run db:push
npm run db:generate

# 3. Start development server with hot-reload
npm run start:dev

# 4. Run unit and integration tests
npm test
npm run test:e2e
```
