# TicketSupport API Backend

The TicketSupport API is a NestJS enterprise backend powering authentication, ticket lifecycle state machines, staff invitations, in-app notifications, real-time push streams, and customer satisfaction tracking.

---

## Core Purpose

- **Zero-Knowledge Architecture**: Secure pre-signed URL issuance and streaming endpoints for client-encrypted attachments.
- **Fair Workload Balancing**: Automated round-robin dispatch matching incoming incidents with active engineers by department.
- **Deflection & Self-Service**: Database-backed knowledge base management with keyword deflection analytics.
- **Real-Time Push Stream**: Low-latency Server-Sent Events (SSE) broadcast for instant ticket updates and notifications.

---

## Technology Stack

| Layer | Technologies |
|:---|:---|
| **Framework** | NestJS 12 (Node.js ESM) |
| **Authentication** | Passport JWT, rotating refresh cookies, bcryptjs |
| **ORM & Database** | Prisma ORM 7 (`@prisma/adapter-pg`), PostgreSQL 16 |
| **Cache & Throttling** | Redis 7, `@nestjs/throttler`, ioredis |
| **Storage SDK** | AWS SDK v3 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`) |
| **Validation** | Zod, nestjs-zod |
| **Documentation** | Swagger OpenAPI 3.1.0 |
| **Testing** | Vitest 4, Supertest |

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

## API Documentation (Swagger)

All backend endpoints, payloads, query parameters, and response schemas are documented interactively:

- **Swagger UI**: [http://localhost:3001/api/docs](http://localhost:3001/api/docs)
- **OpenAPI 3.1 Spec**: [http://localhost:3001/api-json](http://localhost:3001/api-json)

---

## Environment Variables

The backend relies on the root `.env` configuration:

- `DATABASE_URL`: PostgreSQL connection string.
- `REDIS_URL`: Redis connection URL for throttler storage.
- `JWT_SECRET`: Secret key for access token signing (min 32 characters).
- `JWT_EXPIRES_IN`: Access token validity duration (`15m`).
- `REFRESH_TOKEN_EXPIRES_IN`: Refresh token cookie lifespan (`7d`).
- `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET_NAME`: S3/MinIO attachment storage parameters.
- `CORS_ORIGIN`: Allowed frontend origin (`http://localhost:3000`).

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
