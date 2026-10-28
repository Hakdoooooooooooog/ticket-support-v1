# TicketSupport API Backend

Enterprise REST API built with **NestJS 12**, **Node.js (ESM)**, **Prisma ORM 7**, and **PostgreSQL**.

The API handles authentication, ticket lifecycle state machines, staff invitations, in-app notifications, and customer satisfaction (CSAT) reviews.

---

## Architecture & Modules

```
apps/api/src/
├── app.module.ts                   # Core application root module
├── main.ts                         # Bootstrap entry point, Swagger docs, PII interceptor
├── prisma.config.ts                # Prisma 7 centralized datasource configuration
│
├── auth/                           # Authentication & Staff Management Module
│   ├── auth.controller.ts          # Endpoints for register, login, me, agent listings, invites
│   ├── auth.service.ts             # Password hashing, JWT issuance, invite verification
│   ├── jwt.strategy.ts             # Passport JWT Bearer token authentication strategy
│   ├── dto/                        # Zod schemas for credentials, tokens, invite payloads
│   └── mappers/                    # Entity-to-DTO sanitization (stripping passwordHash)
│
├── tickets/                        # Incident Management & Triage Module
│   ├── tickets.controller.ts       # CRUD endpoints, note appending, CSAT rating
│   ├── tickets.service.ts          # State machines, ownership enforcement, SLA tracking
│   ├── dto/                        # Validation schemas for tickets, notes, and CSAT
│   └── mappers/                    # Database-to-response DTO transformations
│
├── notifications/                  # In-App Notification Engine
│   ├── notifications.controller.ts # Endpoints for user notification feed & read status
│   ├── notifications.service.ts    # Role-based notification routing & admin filtering
│   └── dto/                        # Notification response schemas
│
├── realtime/                       # Server-Sent Events (SSE) Live Stream Module
│   ├── realtime.controller.ts      # GET /realtime/stream live push endpoint
│   ├── realtime.service.ts         # RxJS Subject event bus, role filtering & heartbeats
│   └── realtime.module.ts          # Global realtime broadcast module
│
├── database/                       # Data Persistence Layer
│   ├── prisma.service.ts           # PrismaClient configured with @prisma/adapter-pg
│   └── prisma.module.ts            # Global database injection module
│
└── common/                         # Shared Cross-Cutting Utilities
    ├── interceptors/               # PII-redacting logging interceptor & serialization
    ├── pipes/                      # Global ZodValidationPipe
    └── schemas/                    # Common pagination and date transformer schemas
```

---

## Security & Domain Rules

### 1. Role-Based Access Control
- `CUSTOMER`: Can register publicly, create support tickets, view own reported incidents, submit amendment replies, and rate resolved tickets.
- `AGENT`: Can access the IT Admin Console, claim unassigned tickets, post resolution notes on assigned tickets, and progress statuses. Cannot self-rate CSAT.
- `ADMIN`: Has full administrative visibility, can reassign tickets across engineers, generate staff invite tokens, and manage team accounts.

### 2. Strict CSAT Anti-Tampering (`POST /tickets/:id/csat`)
- Customer satisfaction ratings can only be submitted for tickets in `RESOLVED` or `CLOSED` status.
- Only the specific customer who reported the ticket (`creatorId`) can submit a rating.
- Support engineers and administrators attempting to rate tickets are blocked with `403 Forbidden`.

### 3. Closed Ticket Immutability
- Tickets marked `CLOSED` cannot have resolution notes appended or status changed.
- Customers or staff must explicitly reopen a closed incident back to `OPEN` before adding notes.

### 4. Admin Notification Filtering
- Administrators strictly receive `TICKET_CREATED` notifications when new customer tickets arrive for triage.
- Operational noise (customer satisfaction ratings, resolution comments, customer replies) is suppressed for administrators and routed only to assigned support engineers.

### 5. PII Redaction
- `PiiRedactingLoggingInterceptor` intercepts all incoming requests and outgoing payloads, masking emails, passwords, auth tokens, and encrypted ciphertext from server console logs.

---

## API Endpoints Reference

### Authentication & Invitations (`/auth`)
| Method | Endpoint | Access | Description |
|:---|:---|:---:|:---|
| `POST` | `/auth/register` | Public | Register new customer account |
| `POST` | `/auth/login` | Public | Authenticate user and receive JWT Bearer token |
| `GET` | `/auth/me` | Authenticated | Retrieve current user profile and role |
| `GET` | `/auth/agents` | Staff | Retrieve active support engineers for ticket assignment |
| `POST` | `/auth/invites` | ADMIN | Generate single-use invitation token for AGENT or ADMIN |
| `GET` | `/auth/invites` | ADMIN | List all staff invitations and claim status |
| `GET` | `/auth/invites/verify/:code`| Public | Verify invitation token validity before onboarding |
| `DELETE`| `/auth/invites/:id` | ADMIN | Revoke pending staff invitation |

### Tickets & Incidents (`/tickets`)
| Method | Endpoint | Access | Description |
|:---|:---|:---:|:---|
| `GET` | `/tickets` | Authenticated | List tickets (filtered by role scope: own for customer, all for staff) |
| `POST` | `/tickets` | Authenticated | Create new support ticket with encrypted attachment |
| `GET` | `/tickets/:id` | Authenticated | Retrieve single ticket details, comments, and attachments |
| `PATCH`| `/tickets/:id` | Staff / Owner | Update ticket status, priority, or assignee |
| `POST` | `/tickets/:id/comments` | Staff / Owner | Append resolution note or customer follow-up message |
| `POST` | `/tickets/:id/csat` | Customer Only | Submit 1–5 star CSAT rating and review comment |
| `DELETE`| `/tickets/:id` | Staff | Delete support ticket |

### In-App Notifications (`/notifications`)
| Method | Endpoint | Access | Description |
|:---|:---|:---:|:---|
| `GET` | `/notifications` | Authenticated | Retrieve user notification feed and unread count |
| `PATCH`| `/notifications/:id/read` | Authenticated | Mark a single notification as read |
| `PATCH`| `/notifications/mark-all-read` | Authenticated | Mark all notifications as read for current user |

### Real-Time Live Stream (`/realtime`)
| Method | Endpoint | Access | Description |
|:---|:---|:---:|:---|
| `GET` | `/realtime/stream` | Authenticated | Server-Sent Events (SSE) live stream for instant ticket mutations, notes, and role-scoped notifications (Bearer header or `?token=<jwt>`) |

### System & Health
| Method | Endpoint | Access | Description |
|:---|:---|:---:|:---|
| `GET` | `/` | Public | Health check endpoint |
| `GET` | `/version` | Public | Returns system release version metadata |
| `GET` | `/api/docs` | Public | Interactive Swagger OpenAPI UI |
| `GET` | `/api-json` | Public | OpenAPI specification JSON document |

---

## Development & Testing

```bash
# Start backend in watch mode
npm run start:dev

# Run full Vitest unit test suite (112 tests across 15 suites)
npm test

# Run full Supertest E2E integration test suite (22 tests)
npm run test:e2e

# Run linter
npm run lint
```
