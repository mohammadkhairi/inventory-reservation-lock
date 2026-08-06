# Inventory Reservation System

A TypeScript service that prevents overselling of limited-stock products under
high-concurrency flash-sale traffic — the Everest Engineering backend coding
challenge.

The system supports the three progressive levels in the brief:

1. **Basic reservation** — reserve an item when stock is available, reject when not.
2. **Lifecycle & expiry** — `ACTIVE → CONFIRMED | CANCELLED | EXPIRED`, with a 2-minute hold.
3. **Concurrency** — 500 simultaneous reservations against `stock = 1` produce
   exactly **1 success** and **499 failures**, deterministically.

---

## Quickstart

```bash
# Requires Node >= 20
npm install
npm test              # run the full Vitest suite
npm run typecheck     # strict TypeScript check
npm run build         # emit to ./dist
npm run dev           # tsx watch mode on http://localhost:3000
```

### Try the HTTP API

```bash
# Seed a product
curl -X POST http://localhost:3000/api/products \
  -H 'content-type: application/json' \
  -d '{"id":"sku-1","name":"T-Shirt","totalStock":1}'

# Reserve
curl -X POST http://localhost:3000/api/reservations \
  -H 'content-type: application/json' \
  -d '{"productId":"sku-1","userId":"user-A","quantity":1}'

# Confirm (use the returned id)
curl -X POST http://localhost:3000/api/reservations/<RESERVATION_ID>/confirm

# Check availability
curl http://localhost:3000/api/products/sku-1/availability
```

---

## Architecture

```
src/
├── domain/           # Pure business types: Product, Reservation, states, errors
├── repositories/     # Storage contracts + in-memory implementations
├── infrastructure/   # Cross-cutting: AsyncMutex, KeyedMutex, Clock, IdGenerator
├── services/         # InventoryService orchestrates the lifecycle
├── http/             # Express routes + Zod validation + error mapping
├── config/           # Constants (hold duration, etc.)
├── composition.ts    # Composition root (wires the default in-memory stack)
└── index.ts          # HTTP entry point + optional expiry sweeper
```

**Dependency direction:** `http → services → repositories/infrastructure → domain`.
The domain has no outward dependencies; the service depends only on interfaces,
so swapping the in-memory store for Postgres/Redis is a composition-root change,
not a service change.

### SOLID at a glance

- **Single Responsibility.** `InventoryService` owns the invariant; repositories
  own storage; the mutex owns concurrency; the clock owns time.
- **Open/Closed.** Adding a new persistence backend means implementing
  `ProductRepository` / `ReservationRepository` and rewiring `composition.ts`
  — no service edits.
- **Liskov.** `ManualClock` / `SystemClock` and `SequentialIdGenerator` /
  `UuidGenerator` are freely substitutable.
- **Interface Segregation.** Repository interfaces expose only the methods the
  service actually needs.
- **Dependency Inversion.** The service receives collaborators through its
  constructor; no `new` inside business logic.

---

## Concurrency strategy

Node.js is single-threaded, but async operations interleave at every `await`.
The classic race is:

```
async reserve():
  available = compute()   // ── await ──┐
  if available >= qty:                  ├── another coroutine can slip in here
    save(reservation)     // ── await ──┘
```

Between the check and the save, another `reserve` call for the same product can
read the same `available` and also decide to save. Two writes, one item — that's
oversell.

**Solution — per-product `KeyedMutex`.** Every read-then-write path
(`reserve`, `confirm`, `cancel`, `sweepExpired`) runs inside
`mutex.runExclusive(productId, ...)`. The critical section re-reads state and
re-checks the invariant *inside* the lock, then writes. Because the lock is
keyed by `productId`, operations on different products run in parallel — the
lock's granularity matches the invariant's granularity.

The underlying `AsyncMutex` chains critical sections on a single promise so the
event loop cannot enter a second section until the first releases. It is
strictly FIFO and releases even when the section throws.

### Why not `Promise.allSettled` + retry, atomic counters, or "just decrement"?

- **Atomic counter tricks** (e.g. `Atomics` on `SharedArrayBuffer`) only work
  for scalar stock and lose the ability to represent reservations as first-class
  entities with expiry and audit trails.
- **Optimistic retry** (CAS loop) would work, but it's much harder to reason
  about, adds latency spikes under contention, and provides no back-pressure —
  a single hot SKU could burn CPU spinning. A per-key mutex gives us FIFO
  fairness and O(1) coordination cost per attempt.
- **A single global mutex** would serialize all traffic across all products.
  The keyed mutex parallelizes across SKUs, which is the whole point.

### Scaling beyond one process

Everything above is in-process. For a horizontally-scaled deployment, replace
the `KeyedMutex` and repositories with distributed equivalents that preserve
the same contract:

| Component | Single-process now | Multi-process option |
| --- | --- | --- |
| `KeyedMutex` | in-memory promise chain | Redis `SET NX PX` / Redlock, or Postgres advisory locks |
| `ReservationRepository` | `Map` | Postgres with a `SELECT ... FOR UPDATE` inside a transaction, or DynamoDB with conditional writes |
| Availability check | recompute in-lock | same, but inside the DB transaction so the row-level lock is atomic with the write |

The domain and service layers stay identical — that's the payoff for depending
on interfaces.

---

## Expiry model — lazy, not timer-driven

Correctness of `getAvailability` **never depends on a background timer**. Every
reservation carries an `expiresAt`; the `effectiveState` function treats an
ACTIVE reservation past its expiry as EXPIRED for availability math, regardless
of what is persisted. This means:

- Timers, restarts, and clock skew can never cause a phantom hold to block a sale.
- Tests use a `ManualClock` and `clock.advance(TWO_MINUTES + 1)` to make expiry
  behavior fully deterministic — no `setTimeout`, no flakiness.

`sweepExpired()` is a *materialization* step: it persists the ACTIVE → EXPIRED
transition so audit queries see the terminal state. It is safe to call at any
cadence (the default `index.ts` runs it every 30 s) and is idempotent because it
re-checks each candidate inside the product lock.

---

## Business rules encoded

| Rule (from the brief) | Where it lives |
| --- | --- |
| `available = totalStock − confirmed − activeReservations` | `InventoryService.snapshot` |
| Reservations exceeding available stock must fail | `InventoryService.reserve` (in-lock check) |
| Confirmed purchases cannot be reversed | `InventoryService.cancel` rejects non-ACTIVE |
| Only one user can reserve the last item | Enforced by the per-product mutex + invariant check |
| Expired reservations release inventory automatically | `effectiveState` (lazy) + `sweepExpired` (materialization) |

---

## Testing

```
tests/
├── AsyncMutex.test.ts             — FIFO + mutual exclusion + throw safety
├── KeyedMutex.test.ts             — per-key isolation + GC of idle keys
├── InventoryService.level1.test.ts — basic reserve success/fail, validation
├── InventoryService.level2.test.ts — full lifecycle, expiry, illegal transitions
├── InventoryService.level3.test.ts — the 500-request flash sale + variations
└── http.test.ts                    — end-to-end HTTP contract via supertest
```

The Level 3 suite is the load-bearing test. It fires 500 `reserve` calls in
parallel against `stock = 1` and asserts **exactly one** `ACTIVE` reservation
and **exactly 499** `InsufficientStockError` failures — the acceptance criterion
from the brief.

Run with coverage:

```bash
npm run test:coverage
```

---

## Assumptions

- **In-memory storage is sufficient** for the challenge; the interfaces are
  designed so a real DB is a drop-in replacement.
- **Single Node.js process.** For multiple processes the mutex and repositories
  would move to Redis/Postgres — see the table above.
- **`quantity` is a positive integer.** Fractional units and negative amounts
  are rejected with `InvalidQuantityError`.
- **Users are identified by opaque strings.** No auth layer — the challenge is
  about inventory correctness, not identity.
- **Reservations are per-line-item.** A single reservation covers one product +
  one quantity; multi-product carts would compose several reservations, each
  under its own product lock (ordered by `productId` to avoid deadlock).
- **The system clock is monotonic enough** for expiry to be meaningful. In
  production the `Clock` abstraction lets us swap in an NTP-disciplined or
  monotonic source.

---

## Trade-offs I made deliberately

- **Chose a mutex over CAS/retry.** Simpler to reason about, deterministic
  latency, no thundering herd. Under extreme contention on a single hot SKU
  the queue could grow — mitigation is a bounded queue + fast-fail once the
  invariant will clearly fail (not required for the challenge's scale).
- **Lazy expiry + optional sweeper**, not a per-reservation `setTimeout`. Timers
  don't survive restarts and add scheduling overhead at scale. Lazy evaluation
  is stateless and always correct.
- **In-memory repositories, not SQLite/lowdb.** The challenge asks for in-memory
  state at Level 1. Adding a real DB would obscure the concurrency story that
  is the whole point of Level 3.
- **Express + Zod, no framework magic.** Fastify would be faster but the code
  under test is the service, not the HTTP layer.
- **No `retryAfterMs` in the 409 response.** A production system would include
  one so the client backs off; skipped here for scope.

---

## What I'd add with more time

- **Distributed locking** (Redis + Redlock or Postgres advisory locks) with the
  same `KeyedMutex` interface so the swap is a single-line change in
  `composition.ts`.
- **Postgres repository** with `SELECT ... FOR UPDATE` inside a transaction —
  this collapses the mutex + repository into a single DB primitive and scales
  horizontally.
- **Idempotency keys** on `reserve` so retries from a network-flaky client
  don't double-book.
- **Structured logging + metrics** (pino + prom-client): reservation success
  rate, availability query latency, mutex queue depth per SKU.
- **Load test harness** (autocannon or k6) reproducing the 500-concurrent-buyer
  scenario against the HTTP layer, not just the service.
- **Property-based tests** (fast-check) around the invariant
  `available >= 0 && confirmed + active <= totalStock` under random operation
  sequences.
- **Reservation extension** (`PATCH /reservations/:id/extend`) for slow-checkout
  UX, subject to a hard cap.
- **Product mutation guardrails** — e.g. lowering `totalStock` below the sum of
  active + confirmed must fail.

---

## AI usage disclosure

- **Tool used:** Claude Code (Anthropic's Claude Opus 4.7 CLI).
- **How I used it:** I described the challenge and asked Claude to help scaffold
  a clean SOLID TypeScript project. I reviewed and directed every file — the
  design decisions (per-key mutex vs global, lazy expiry vs timers, interface
  layout, error taxonomy, test structure) were made together and I signed off
  on each. The code was not one-shot; it went through revision to remove
  premature abstractions, tighten naming, and align with the challenge brief.
- **AI-assisted portions:**
  - File scaffolding and boilerplate (package.json, tsconfig, vitest config).
  - First-draft implementations of `AsyncMutex`, `KeyedMutex`,
    `InventoryService`, and the test suites — all reviewed and hand-edited.
  - README structure and prose.
- **Human-owned portions:**
  - Choice of architecture and layering.
  - The concurrency strategy (per-key mutex, lazy expiry model).
  - The trade-offs and assumptions above.
  - Every test scenario, especially the Level 3 acceptance test.
- **Workflow:** Two-phase — a short design/planning pass to lock the approach,
  then implementation in reviewable chunks (config → domain → infra → service
  → HTTP → tests → docs), running the test suite continuously.

I take full responsibility for the submission as production-quality code.
