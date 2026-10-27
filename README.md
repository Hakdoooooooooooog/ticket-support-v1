# TicketSupport Monorepo

Enterprise IT Helpdesk platform built with **Next.js 16**, **NestJS 12**, **Prisma 7**, **PostgreSQL**, and **Turborepo**.

---

## Architecture Overview

```
TicketSupport/
├── apps/
│   ├── web/                     # Next.js 16 (App Router, React 19, Turbopack)
│   │   ├── src/
│   │   │   ├── app/             # Next.js App Router (providers, layout, page)
│   │   │   ├── components/      # Domain components & forms
│   │   │   │   ├── forms/       # react-hook-form + zod forms
│   │   │   │   └── ui/          # shadcn/ui components (Tailwind CSS v4)
│   │   │   ├── lib/             # query-client, utils (cn)
│   │   │   ├── hooks/           # Custom React hooks
│   │   │   └── api/             # Orval auto-generated API hooks
│   │   ├── orval.config.ts      # OpenAPI-to-React Query codegen
│   │   └── components.json      # shadcn/ui configuration
│   │
│   └── api/                     # NestJS 12 (ESM, Fastify/Express)
│       ├── prisma.config.ts     # Prisma 7 centralized configuration
│       ├── prisma/
│       │   └── schema.prisma    # PostgreSQL domain models
│       └── src/
│           ├── database/        # PrismaService (PrismaPg driver adapter)
│           ├── tickets/         # Tickets module, DTOs & CRUD controller
│           ├── auth/            # Auth module, Passport JWT & DTOs
│           └── main.ts          # Swagger OpenAPI documentation & CORS
│
├── docker-compose.yml           # PostgreSQL 16 container setup
├── turbo.json                   # Turborepo build pipeline
└── package.json                 # Monorepo workspace configuration
```

---

## Import Aliases (`apps/web`)

Explicit folder aliases configured in `tsconfig.json`:
- `@components/*` &rarr; `src/components/*`
- `@ui/*` &rarr; `src/components/ui/*`
- `@lib/*` &rarr; `src/lib/*`
- `@hooks/*` &rarr; `src/hooks/*`
- `@api/*` &rarr; `src/api/*`
- `@app/*` &rarr; `src/app/*`

---

## Prisma 7 Configuration (`apps/api`)

Prisma 7 removes database connection strings from `schema.prisma`. All connection URLs and migration settings are declared in `apps/api/prisma.config.ts`:

```typescript
import dotenv from 'dotenv';
import path from 'path';
import { defineConfig, env } from 'prisma/config';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
```

`PrismaService` connects directly using the `@prisma/adapter-pg` driver adapter:

```typescript
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
super({ adapter });
```

---

## Quick Start

### 1. Start PostgreSQL Database

```bash
docker compose up -d
```

### 2. Generate Prisma Client & Run Migrations

```bash
# In apps/api
cd apps/api
npx prisma generate
npx prisma migrate dev --name init
```

### 3. Start Development Servers (Turbo)

From the project root:

```bash
npm run dev
```

- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:3001](http://localhost:3001)
- **Swagger Documentation**: [http://localhost:3001/api/docs](http://localhost:3001/api/docs)
- **OpenAPI JSON**: [http://localhost:3001/api-json](http://localhost:3001/api-json)

### 4. Generate Frontend Client from OpenAPI (Orval)

```bash
npm run generate:api
```
