# Payload CMS + PostgreSQL + Better Auth

A starter template combining [Payload CMS](https://payloadcms.com), [PostgreSQL](https://www.postgresql.org), and [Better Auth](https://www.better-auth.com) for a modern, full-featured content management setup with robust authentication.

## Features

- **Payload CMS** -- headless CMS with admin panel, rich text editing, and media management
- **PostgreSQL** -- production-ready relational database via `@payloadcms/db-postgres`
- **Better Auth** -- authentication layer with email/password and social login (Google)
- **Custom-role RBAC** -- admin-managed roles with per-collection create and scoped read/update/delete permissions (none/own/all today; collections can declare extra scopes such as team-based access)
- **Audit logs** -- authenticated and system operation tracking through `payload-auditor`
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

4. Set up the database:

   ```bash
   pnpm db:setup
   ```

5. Start the dev server:

   ```bash
   pnpm dev
   ```

6. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
  auth.ts              # Better Auth configuration (plugins, providers, hooks)
  access/              # Permission model, access helpers, and RBAC collection wrapper
  proxy.ts             # Middleware for route protection
  collections/
    Roles.ts           # Admin-managed roles and permission matrix field
    Users.ts           # Better Auth strategy, role relationship, and safe self access
    Media.ts           # Ownable upload collection
  components/
    RolePermissionsMatrix.tsx # Per-collection permission editor
  lib/
    auth-client.ts     # Better Auth React client
    utils.ts           # Shared utilities
  db/
    postgres.ts        # PostgreSQL connection pool
  seeds/               # Database seed scripts
```

## Authentication Flow

1. Better Auth handles sign-in/sign-up (email/password or Google OAuth)
2. Better Auth only creates sessions for users who already exist in the Payload `users` collection
3. On session resolution, the custom Payload auth strategy refreshes identity details on the existing Payload user
4. The Payload user is loaded with its custom role and collection permissions
5. Payload collection access is enforced by those permissions; Better Auth's own role stays separate
6. Registration is restricted -- signing in never creates a missing Payload user

## Scripts

| Script                   | Description                              |
| ------------------------ | ---------------------------------------- |
| `pnpm dev`               | Start dev server with Turbopack          |
| `pnpm build`             | Production build                         |
| `pnpm start`             | Start production server                  |
| `pnpm db:setup`          | Run database migrations and seed data    |
| `pnpm db:migrate`        | Run Payload database migrations          |
| `pnpm db:migrate:create` | Create a new Payload migration           |
| `pnpm db:migrate:fresh`  | Drop the database and run all migrations |
| `pnpm db:migrate:status` | Show migration status                    |
| `pnpm db:seed`           | Run seed data directly                   |
| `pnpm test`              | Run integration + e2e tests              |
| `pnpm lint`              | Lint with oxlint                         |
| `pnpm format`            | Format with oxfmt                        |

## Schema Changes

When you modify Payload collections, generate a new migration and re-run:

```bash
pnpm db:migrate:create
pnpm db:migrate
```

## License

MIT
