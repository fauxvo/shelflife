# Shelflife

Plex library storage manager. Users log in via Plex, see their Overseerr requests, and vote to keep or delete content. Admins see aggregate deletion candidates.

## Tech Stack

- **Framework**: Next.js 16 (App Router, React 19)
- **Language**: TypeScript (strict mode)
- **Database**: SQLite via Drizzle ORM + better-sqlite3
- **Validation**: Zod schemas
- **Styling**: Tailwind CSS v4
- **Auth**: Plex PIN-based OAuth with JWT sessions
- **Testing**: Vitest with in-memory SQLite
- **Package Manager**: `bun` for install/run, `npm test` for tests

## Project Structure

```
src/
  app/                    # Next.js App Router pages and API routes
    api/
      admin/              # Admin-only endpoints (requireAdmin)
      auth/plex/          # Plex OAuth flow (pin creation, callback)
      media/              # User media endpoints (requireAuth)
      sync/               # Data sync endpoints (requireAdmin)
      health/             # Health check (public)
  components/
    admin/                # Admin dashboard components
    auth/                 # Login button
    media/                # Media cards, grid, voting
    ui/                   # Shared UI (Pagination, MediaTypeBadge, MediaCardSkeleton)
  lib/
    auth/                 # Session management, auth middleware
    db/                   # Drizzle instance, schema, shared query helpers
    services/             # External API clients (Overseerr, Tautulli, Plex)
    validators/           # Zod schemas for request validation
    constants.ts          # Shared UI constants (colors, labels)
  test/                   # Test setup and helpers
  types/                  # TypeScript type definitions
```

## Commands

```bash
bun install              # Install dependencies
bun run dev              # Start dev server
bun run build            # Production build
bun run lint             # ESLint check
bun run lint:fix         # ESLint auto-fix
bun run format           # Prettier format all source files
bun run format:check     # Prettier check formatting
npm test                 # Run all tests (always use npm, not bun)
npm test -- --watch      # Run tests in watch mode
```

## Architecture Principles

### Sync-Based Data Model

- External APIs (Overseerr, Tautulli) are read-only data sources
- Data is synced into local SQLite -- the app works even if external services are down
- Votes and user data are stored locally, never pushed to external services
- All sync operations go through `src/lib/services/sync.ts`

### Auth Model

- Plex PIN-based OAuth (same flow as Overseerr)
- JWT sessions stored in cookies
- Middleware in `src/proxy.ts` protects all routes except public paths and static assets
- Route handlers use `requireAuth()` or `requireAdmin()` from `src/lib/auth/middleware.ts`
- First user to sign in becomes admin automatically

### Data Access

- The media endpoint supports a `scope` param: `scope=personal` (default) filters to only the current user's requests; `scope=all` shows all users' library items
- Vote and watch status data is always scoped to the current user via LEFT JOINs — users never see other users' votes
- Write endpoints (`POST /api/media/[id]/vote`) enforce ownership — non-admins can only vote on their own items
- Admins can nominate (delete/trim) ANY user's content — this is an intentional privilege for curating the library
- Admin nominations are shown separately in the UI ("Your nomination:" label) and included in community review alongside self-nominations
- The shared `getNominationCondition()` helper in `lib/db/queries.ts` encapsulates the nomination visibility rule: self-nominations OR admin nominations
- Vote/watched filtering happens in SQL WHERE clauses, not post-query in JS

## Code Conventions

### API Routes

- Always wrap handler body in try/catch with `handleAuthError(error)` in the catch
- Use `requireAuth()` for user endpoints, `requireAdmin()` for admin endpoints
- Validate query params with Zod schemas from `src/lib/validators/schemas.ts`
- Use shared query helpers from `src/lib/db/queries.ts` (`mediaQueryWithJoins`, `mediaCountWithJoins`, `mapMediaItemRow`, `buildPagination`)
- Return consistent pagination shape: `{ items: [...], pagination: { page, limit, total, pages } }`

### Components

- Use shared `<MediaTypeBadge>` for TV/Movie badges
- Use shared `<MediaCardSkeleton>` for loading states
- Use shared `<Pagination>` component (not custom pagination buttons)
- Import colors and labels from `src/lib/constants.ts` (`STATUS_COLORS`, `VOTE_COLORS`, `VOTE_LABELS`)
- Client components must have `"use client"` directive

### Database

- Use Drizzle ORM query builder -- never raw SQL strings (prevents SQL injection)
- Use `upsertUser()` from `src/lib/services/user-upsert.ts` for user creation/updates
- Schema defined in `src/lib/db/schema.ts` with 5 tables: users, media_items, watch_status, user_votes, sync_log
- All timestamps are ISO strings stored as TEXT

### TypeScript

- Strict mode enabled
- Use path alias `@/` for `src/` imports
- Define types in `src/types/index.ts`
- Use Zod for runtime validation at API boundaries
- Prefer `interface` for object shapes, `type` for unions/aliases

### Styling

- Tailwind CSS v4 with dark theme (gray-900 backgrounds, gray-200 text)
- Brand color: `#e5a00d` (amber/gold for Plex)
- Prettier auto-sorts Tailwind classes via `prettier-plugin-tailwindcss`

## Testing

- **Framework**: Vitest with globals (describe/it/expect without imports)
- **Database**: In-memory SQLite via `createTestDb()` from `src/test/helpers/db.ts`
- **Auth mocking**: `vi.mock("@/lib/auth/middleware")` with inline `AuthError` class
- **DB mocking**: `vi.mock("@/lib/db", () => ({ get db() { return testDb.db; } }))`
- **Fetch mocking**: `vi.stubGlobal("fetch", vi.fn())` for service client tests
- **Pattern**: Each test file gets a fresh DB via `beforeEach`
- Tests live in `__tests__/` directories adjacent to the code they test
- 153 tests across 12 files -- all must pass before merge

## Review Checklist

When reviewing PRs, check for:

- [ ] **Auth enforcement**: Every API route (except health and auth) uses `requireAuth()` or `requireAdmin()`
- [ ] **Data isolation**: User endpoints filter by `session.plexId` -- users must never see other users' data
- [ ] **SQL filtering**: Vote/watched filters happen in SQL WHERE clauses, not in JS post-query (pagination counts must match)
- [ ] **Zod validation**: All user input (query params, request bodies) is validated with Zod schemas
- [ ] **No raw SQL**: Use Drizzle ORM query builder, not string concatenation (SQL injection risk)
- [ ] **Error handling**: API routes use try/catch with `handleAuthError()`
- [ ] **Shared utilities**: Use existing helpers from `lib/db/queries.ts`, `lib/constants.ts`, `lib/services/user-upsert.ts` instead of duplicating
- [ ] **Consistent UI**: Use `<MediaTypeBadge>`, `<MediaCardSkeleton>`, `<Pagination>` components
- [ ] **Tests**: New features or bug fixes should include tests
- [ ] **No secrets**: `.env` files, API keys, and tokens must not be committed
- [ ] **Conventional Commits**: Commit messages follow `feat:`, `fix:`, `chore:`, `docs:` format for changelog generation

## Environment Variables

Required:

- `OVERSEERR_URL` / `OVERSEERR_API_KEY` -- Overseerr instance
- `TAUTULLI_URL` / `TAUTULLI_API_KEY` -- Tautulli instance
- `SESSION_SECRET` -- JWT signing key (min 32 chars)

Optional:

- `PLEX_CLIENT_ID` -- defaults to "shelflife"
- `ADMIN_PLEX_ID` -- force a specific admin user
- `DATABASE_PATH` -- defaults to `/app/data/shelflife.db` in Docker
