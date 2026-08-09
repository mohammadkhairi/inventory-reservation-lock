# Architecture guide for this repo

Read this before making structural changes. These are decided patterns, not suggestions.

## Layered flow

```
route → controller (thin) → service → repository → drizzle → postgres
```

Composition happens in **`src/routes/index.ts`** — nowhere else. `app.ts` only sets up express, middleware, and mounts `/api`. It does not touch repos, services, controllers, or locks.

## FP style, not OO

- **No classes, no `new`, no singletons** for repos/services/controllers.
- Every layer exports **individual functions** via `export async function` (or `export function`), not factories returning objects with methods.
- The **DB pool is the only singleton** — initialized once in `app.ts` via `initDatabase()`.
- The **locker** is a plain object literal (`export const locker: Locker = { withLock(...) { ... } }`), also effectively a singleton because it delegates to the DB pool.

### Per-layer function signatures

**Repositories** — plain async functions, no deps parameter. Use `db()` internally.
```ts
// src/repositories/productRepository.ts
export async function findById(id: string): Promise<Product | null> { ... }
export async function save(product: Product): Promise<void> { ... }
```
Callers use `import * as products from './productRepository.js'` — the namespace object structurally satisfies the `ProductRepository` interface.

**Services** — deps-first, one function per operation. No shared closure, no factory wrapper.
```ts
// src/services/inventoryService.ts
export async function reserve(deps: InventoryServiceDeps, input: ReserveInput): Promise<Reservation> { ... }
export async function confirm(deps: InventoryServiceDeps, id: string): Promise<Reservation> { ... }
```
Pure domain rules (`effectiveState`, `computeAvailability`, `withState`) live in the same file as **private helpers** — same file because they're only used by service ops, private because callers should hit the service.

**Controllers** — curried `(deps) => (req, res) => Promise<void>`. Thin: trust the middleware-validated request, call one service function, hand the payload to `sendJson`.
```ts
// src/controllers/reservationController.ts
export function reserve(deps: ReservationControllerDeps): Handler {
  return async (req, res) => {
    const body = req.body as ReserveBody;
    const reservation = await inventoryService.reserve(deps.service, body);
    sendJson(res, reservationResponse, reservation, 201);
  };
}
```

**Routes** — `validate` middleware + `asyncHandler(controller.fn(deps))`. No logic.

## Validation

- **Request body / params / query**: `validate({ body, params, query })` middleware runs before every handler. Zod schemas live in `src/schemas/`. Failures → 400 via `errorHandler`.
- **Response**: always send through `sendJson(res, schema, body, status)`. Response validation failure is a **server bug** (contract drift) and throws a plain `Error` → 500. Never 400.
- Controllers cast `req.body`/`req.params` to the schema-inferred type (`as CreateProductBody`) — trust the middleware.

## Concurrency

`locker.withLock(key, fn)` is the single concurrency primitive.

- Opens a Postgres transaction, takes `pg_advisory_xact_lock(hashtext(key))`, stashes the tx in AsyncLocalStorage, runs `fn`, commits (or rolls back on throw). Lock releases automatically at COMMIT/ROLLBACK — a crashed process can never leak.
- **Every read-then-write path takes the lock.** No exceptions. Overselling is impossible only because of this discipline.
- Repos call `db()` which returns the tx (if inside `withLock`) or the pool. Repos never take a `tx` parameter.

If you need distributed locking beyond one Postgres, replace the `locker` object — the `Locker` interface is the seam.

## Types and errors

- **Types** live in `src/types/`. Shared vocabulary. Repos, services, controllers, schemas all import from here.
- **Errors** live in `src/errors.ts` (repo root). `DomainError` subclasses carry an `ErrorCode`; `errorHandler` middleware maps codes to HTTP status. Add a new error → add the code to `ErrorCode` → add the status in `STATUS_BY_CODE`.

## Domain vs. service — the distinction

**Domain** = pure. Types + rules + calculations. No I/O, no clock reads, no locks. If you find yourself importing `db`, `locker`, or `clock` into pure code, you've put the wrong thing there.

**Service** = orchestration. All side effects. Reads clock, acquires lock, calls repos, coordinates the pure domain functions.

Pure rules live inline in `src/services/inventoryService.ts` as private helpers (not a separate folder — the domain is small). The service *file* mixes both, but the function-level split stays honest.

## Constants — no magic numbers

Every raw number goes into `src/config/constants.ts` with a named identifier. Time-unit multipliers (`MS_PER_SECOND`, `SECONDS_PER_MINUTE`) are file-private so callers see intent, not arithmetic.

## Environment

- `src/config/env.ts` uses zod. `loadEnv()` is idempotent (cached).
- `DATABASE_URL` is **required** — no fallback, no in-memory mode.
- DB pool sizing (`DB_POOL_MAX`, `DB_IDLE_TIMEOUT_S`, `DB_MAX_LIFETIME_S`, `DB_CONNECT_TIMEOUT_S`) is env-configurable with sane defaults from `constants.ts`.

## Migrations

**Not applied at app startup.** They run in CI/CD (`npm run db:migrate`) against each environment's `DATABASE_URL`. Local dev: run `npm run db:migrate` manually after `npm run db:up`.

## Testing

- Tests hit **real Postgres** via docker-compose. No mocks, no in-memory doubles.
- `tests/globalSetup.ts` creates the `inventory_test` DB + applies migrations once.
- `tests/setup.ts` inits the per-worker `db()` handle.
- `tests/helpers.ts` provides `makeHarness()` (deps-first service bound with `ManualClock`) and `truncateAll()`.
- `vitest.config.ts` sets `fileParallelism: false` — tests share one DB.
- Every `describe` calls `beforeEach(truncateAll)`.

If a test needs to isolate time-based behavior, use `ManualClock` via `makeHarness({ holdDurationMs })` and `h.clock.advance(...)`. Do not use `setTimeout` in tests.

## What not to do

- **Don't add classes** or `new SomeService()`. Factories that return objects with methods are also out — export individual functions.
- **Don't add module-level singletons for controllers/services/repos.** The DB pool is the only singleton.
- **Don't inline raw numbers.** Add to `constants.ts` first.
- **Don't validate the same data twice.** Middleware validates the request; controllers trust it. Don't re-parse.
- **Don't auto-migrate at boot.** CI/CD handles it.
- **Don't add background sweepers, timers, or setInterval jobs unless there's a proven need.** The lazy-expiry model works without them. If persisted state is needed for reporting later, a scheduled `UPDATE` statement is enough.
- **Don't mock the DB in tests.** Real Postgres or bust.
- **Don't add abstractions for hypothetical futures.** If it's not used now, delete it (see: `ReservationRepository.all` was removed with the sweeper).
