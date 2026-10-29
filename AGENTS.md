# Agent Guidelines & Repository Standards: TicketSupport

## 1. Branch Protection & Git Workflow (MANDATORY)

- **Protected `main` Branch**: The `main` branch is protected. **Never push directly to `main`** unless explicitly instructed by the user.
- **Branching Strategy**: Always work on dedicated branches off `main`:
  - Features: `feat/<feature-name>`
  - Bug fixes: `fix/<issue-name>`
  - Maintenance / Chores: `chore/<task-name>`
- **Pre-Merge Verification**: Before pushing or creating pull requests, always execute local verification commands to ensure GitHub Actions CI status checks pass:
  - `npm run lint` — Linting across monorepo
  - `npm run typecheck` — TypeScript compiler checks across all workspaces
  - `npm run test` — Unit & integration test suites
- **Pull Request Delivery**: Push feature branches and create Pull Requests for merging into `main`. Do not force-push (`--force`) to `main`.

## 2. Project Architecture

This monorepo is managed with Turborepo and npm workspaces:
- `apps/web`: Next.js 16 (App Router), Tailwind CSS v4, Zustand, TanStack Query, Orval API client.
- `apps/api`: NestJS enterprise backend, Prisma 7 ORM, PostgreSQL, Passport JWT, Swagger/OpenAPI.

## 3. Engineering Quality & Standards

- **TDD & Invariant Testing**: Write failing tests before introducing production changes.
- **Fail-Fast & Zero Fallbacks on Secrets**: Never use default or fallback values for credentials, JWT secrets, or encryption keys in code.
- **Theme Hydration & FOUC**: In `apps/web/src/app/layout.tsx`, maintain the synchronous `<script>` in `<head>` to initialize `localStorage` theme preferences before paint without flickering.
