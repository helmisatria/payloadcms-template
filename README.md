# Payload CMS + PostgreSQL + Better Auth

A starter template combining [Payload CMS](https://payloadcms.com), [PostgreSQL](https://www.postgresql.org), and [Better Auth](https://www.better-auth.com) for a modern, full-featured content management setup with robust authentication.

## Features

- **Payload CMS** -- headless CMS with admin panel, rich text editing, and media management
- **PostgreSQL** -- production-ready relational database via `@payloadcms/db-postgres`
- **Better Auth** -- authentication layer with email/password and social login (Google)
- **RBAC** -- role-based access control with Admin, Content Admin, and Viewer roles
- **Session management** -- 7-day sessions with daily refresh and cookie caching
- **Account linking** -- link multiple auth providers to a single user
- **Restricted registration** -- only pre-existing Payload users can register via Better Auth
- **Middleware protection** -- route-level auth guards for `/admin`, `/account`, and `/organization`
- **Next.js 16** -- App Router with Turbopack

## Quick Start

### Prerequisites

- Node.js >= 24.9.0
- pnpm >= 10
- PostgreSQL 17+ (or Docker)

### Setup

1. Clone the repo and install dependencies:

   ```bash
   pnpm install
   ```

2. Copy the environment file and fill in your values:

   ```bash
   cp .env.example .env
   ```

3. Start PostgreSQL (if using Docker):

   ```bash
   docker compose up -d
   ```

4. Run migrations and start the dev server:

   ```bash
   pnpm db:migrate
   pnpm dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
  auth.ts              # Better Auth configuration (plugins, providers, hooks)
  access.ts            # RBAC helper (hasRole)
  proxy.ts             # Middleware for route protection
  collections/
    Users.ts           # User collection with Better Auth strategy + RBAC fields
    Media.ts           # Upload-enabled media collection
  lib/
    auth-client.ts     # Better Auth React client
    utils.ts           # Shared utilities
  db/
    postgres.ts        # PostgreSQL connection pool
  seeds/               # Database seed scripts
```

## Authentication Flow

1. Better Auth handles sign-in/sign-up (email/password or Google OAuth)
2. On session resolution, the custom Payload auth strategy syncs the Better Auth user to the Payload `users` collection
3. Payload admin panel access is controlled by the `role` field on the user (RBAC)
4. Registration is restricted -- users must be pre-created in Payload before they can sign up via Better Auth

## Scripts

| Script                   | Description                     |
| ------------------------ | ------------------------------- |
| `pnpm dev`               | Start dev server with Turbopack |
| `pnpm build`             | Production build                |
| `pnpm start`             | Start production server         |
| `pnpm db:migrate`        | Run database migrations         |
| `pnpm db:migrate:create` | Create a new migration          |
| `pnpm test`              | Run integration + e2e tests     |
| `pnpm lint`              | Lint with oxlint                |
| `pnpm format`            | Format with oxfmt               |

## License

MIT
