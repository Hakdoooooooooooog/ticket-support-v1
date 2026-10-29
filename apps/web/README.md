# TicketSupport Web Frontend

The TicketSupport web application is a Next.js customer support portal and IT service desk console featuring role-scoped workspaces, live push updates, and zero-knowledge client-side encryption.

---

## Core Purpose

- **Isolated Role Workspaces**: Distinct interfaces tailored for end-user customers (`/portal`) and IT support personnel (`/admin`).
- **Client-Side Security**: Offscreen Canvas compression and AES-GCM 256-bit encryption before file upload to ensure private diagnostic sharing.
- **Instant Deflection**: Interactive knowledge base suggestions while drafting tickets to deflect recurring support questions.
- **Flicker-Free Experience**: Server-side route guarding and synchronous inline theme initialization to prevent theme flickering (FOUC).

---

## Technology Stack

| Layer | Technologies |
|:---|:---|
| **Framework** | Next.js 16.4 (App Router, Turbopack) |
| **UI Library** | React 19.3 |
| **Styling** | Tailwind CSS v4 |
| **State & Cache** | Zustand 5 & TanStack Query v5 |
| **API Client** | Orval 8 (generated typed Axios client) |
| **Form Handling** | React Hook Form & Zod |
| **Cryptography** | Web Crypto API (AES-GCM 256-bit) |
| **Icons & Primitives** | Radix UI, Lucide Icons |
| **Testing** | Vitest 4, strict TypeScript compiler |

---

## Features

- **Customer Support Portal (`/portal`)**: Self-service workspace for submitting tickets with department routing, tracking resolution progress, submitting follow-up notes, and rating completed service.
- **IT Service Desk Console (`/admin`)**: Queue triage command center with department filtering, one-click ticket claiming, automated round-robin reassignment, and SLA tracking.
- **Proactive Ticket Deflection**: Real-time article recommendations scored while drafting ticket titles, allowing customers to self-resolve before entering the queue.
- **Client-Side Attachment Encryption**: In-browser image compression and AES-GCM 256-bit encryption before upload to keep diagnostic files secure.
- **Interactive CSAT Rating Widget**: 5-star customer satisfaction reviews with optional feedback text for resolved incidents.
- **Live Notifications & SSE Sync**: In-app popover notification feed with unread counters and reactive TanStack Query cache invalidation on backend changes.
- **Categorized Canned Responses**: Integrated template menu for standard troubleshooting, follow-up, and resolution notes.
- **Server-Side Route Protection**: Next.js Edge proxy route guarding with instant redirection for unauthenticated visitors.
- **Adaptive Appearance & Theme**: Dark, light, and system theme options with synchronous pre-paint hydration to eliminate theme flicker (FOUC).
- **Executive Reporting Studio**: Service desk KPI metric cards, agent workload leaderboards, and one-click RFC 4180 CSV exports.

---

## Application Workspaces & Routes

- **`/` (Auth Hub)**: Unified sign in, customer registration, and staff invitation claim flow.
- **`/portal` (Customer Portal)**: Customer ticket submission, attachment encryption, self-service deflection, and CSAT reviews.
- **`/admin` (Service Desk Console)**: Incident triage queue, agent auto-assignment, knowledge base management, outage banners, and executive reports.
- **`src/proxy.ts` (Edge Route Guard)**: Server-side route guard intercepting unauthorized navigation to `/admin` and `/portal`.

---

## Environment Variables

- `NEXT_PUBLIC_API_URL`: Backend API base URL (`http://localhost:3001`).
- `NEXT_PUBLIC_ATTACHMENT_KEY`: AES-256-GCM secret key used for client attachment transit encryption.

---

## How to Run

```bash
# 1. Generate typed API client hooks and schemas
npm run codegen

# 2. Launch Next.js with Turbopack
npm run dev

# 3. Run unit tests and typecheck validation
npm test
npm run typecheck
```
