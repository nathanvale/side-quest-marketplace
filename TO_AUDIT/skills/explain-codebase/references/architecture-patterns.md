# Architecture Patterns to Recognize

When exploring a codebase, these patterns tell you a lot about how the system thinks.

---

## Structural Patterns

### Layered Architecture

```
┌─────────────────┐
│  Presentation   │  ← UI, API endpoints, CLI
├─────────────────┤
│    Business     │  ← Domain logic, use cases
├─────────────────┤
│     Data        │  ← Repositories, queries
├─────────────────┤
│ Infrastructure  │  ← DB, external services
└─────────────────┘
```

**Signs:** Folders like `controllers/`, `services/`, `repositories/`, `models/`
**Story:** "We wanted clear boundaries between what the app does and how it does it."
**Gotcha:** Layers can become bureaucracy—watch for pass-through methods that add no value.

---

### Hexagonal (Ports & Adapters)

```
              ┌─────────────────────┐
   Adapters   │                     │   Adapters
  (Driving)   │      Domain         │   (Driven)
    ───────►  │       Core          │  ◄───────
              │                     │
              └─────────────────────┘
```

**Signs:** `ports/`, `adapters/`, interfaces for everything external
**Story:** "We want to swap databases, APIs, UIs without touching business logic."
**Gotcha:** Can be overkill for simple apps—you pay abstraction tax on every external call.

---

### Modular Monolith

```
┌─────────────────────────────────────────┐
│               Monolith                   │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ Orders  │  │  Users  │  │Products │ │
│  │ Module  │  │ Module  │  │ Module  │ │
│  └────┬────┘  └────┬────┘  └────┬────┘ │
│       └────────────┼───────────┘       │
│               Shared DB                 │
└─────────────────────────────────────────┘
```

**Signs:** Feature folders with internal structure, shared database, explicit module boundaries
**Story:** "Microservices complexity without microservices benefits—we'll split if/when needed."
**Gotcha:** Module boundaries erode over time; needs active defense.

---

### Microservices

```
┌─────────┐    ┌─────────┐    ┌─────────┐
│ Orders  │    │  Users  │    │Products │
│ Service │    │ Service │    │ Service │
└────┬────┘    └────┬────┘    └────┬────┘
     │              │              │
     └──────────────┴──────────────┘
              Message Bus / API Gateway
```

**Signs:** Separate repos or deploy units, service discovery, distributed tracing
**Story:** "Teams need to ship independently; we'll pay the distributed systems tax."
**Gotcha:** Network is now a failure mode. Debugging spans 5 services. Data consistency is your problem now.

---

## Data Patterns

### Repository Pattern

```typescript
interface UserRepository {
  findById(id: string): Promise<User | null>
  save(user: User): Promise<void>
  delete(id: string): Promise<void>
}
```

**Signs:** Interfaces ending in `Repository`, implementations in `infrastructure/`
**Story:** "Business logic shouldn't know if we use Postgres, Mongo, or carrier pigeons."
**Gotcha:** Repositories can become God objects—keep them focused on aggregate roots.

---

### CQRS (Command Query Responsibility Segregation)

```
Commands (writes)          Queries (reads)
      │                          │
      ▼                          ▼
┌───────────┐              ┌───────────┐
│ Write DB  │  ──sync──►   │ Read DB   │
│(normalized)│             │(denormalized)│
└───────────┘              └───────────┘
```

**Signs:** Separate `commands/` and `queries/` folders, different models for read vs write
**Story:** "Reads and writes have different needs; we optimize each separately."
**Gotcha:** Eventual consistency means reads can be stale. Users see their own writes delayed.

---

### Event Sourcing

```
Events (source of truth):
┌─────────────────────────────────────────┐
│ UserCreated → EmailChanged → Suspended  │
└─────────────────────────────────────────┘
                    │
                    ▼ (projection)
           Current State: User{suspended: true}
```

**Signs:** Events as immutable records, projections, replay capability
**Story:** "We never lose information; any state can be reconstructed from history."
**Gotcha:** Event schema evolution is hard. Replays can be slow. Debugging requires time-travel thinking.

---

## Communication Patterns

### Request/Response (Synchronous)

```
Client ──request──► Server
       ◄──response──
```

**Signs:** REST APIs, GraphQL, gRPC
**Story:** "Caller waits for result; simple mental model."
**Gotcha:** Caller is blocked; cascading failures if server is slow.

---

### Pub/Sub (Asynchronous)

```
Publisher ──event──► Message Broker ──event──► Subscriber(s)
```

**Signs:** Message queues (RabbitMQ, Kafka, SQS), event handlers
**Story:** "Publisher doesn't need to know who cares; subscribers opt in."
**Gotcha:** Message ordering, duplicate handling, poison messages, "who's listening to this?"

---

### Saga Pattern

```
Service A ──► Service B ──► Service C
    │             │             │
    └──compensate─┴─────────────┘ (on failure)
```

**Signs:** Compensating transactions, saga orchestrators, rollback handlers
**Story:** "Distributed transactions are impossible; we choreograph with compensation."
**Gotcha:** Compensating actions might fail. Partial states exist during saga execution.

---

## Code Organization Patterns

### Feature Folders

```
features/
├── authentication/
│   ├── components/
│   ├── hooks/
│   ├── api/
│   └── types.ts
├── dashboard/
│   ├── components/
│   ├── hooks/
│   └── api/
```

**Story:** "Everything for a feature lives together; easier to understand and delete."

---

### Layer Folders

```
components/
├── Button.tsx
├── Modal.tsx
hooks/
├── useAuth.ts
├── useDashboard.ts
api/
├── auth.ts
├── dashboard.ts
```

**Story:** "Group by technical concern; easier to enforce patterns."

---

### Barrel Exports

```typescript
// components/index.ts
export { Button } from './Button'
export { Modal } from './Modal'
export { Input } from './Input'
```

**Story:** "Clean imports; hide internal structure."
**Gotcha:** Can mask circular dependencies; bundlers may struggle with tree-shaking.

---

## Error Handling Patterns

### Result Types

```typescript
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }

function parse(input: string): Result<Data, ParseError> {
  // Caller must handle both cases
}
```

**Story:** "Make errors explicit in the type system; no surprise exceptions."

---

### Error Boundaries

```typescript
try {
  riskyOperation()
} catch (e) {
  // Convert to domain error, log, maybe retry
  throw new DomainError('Operation failed', { cause: e })
}
```

**Story:** "Errors from external systems get translated at the boundary."

---

### Retry with Backoff

```typescript
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn()
    } catch (e) {
      if (i === maxAttempts - 1) throw e
      await sleep(Math.pow(2, i) * 100)  // Exponential backoff
    }
  }
}
```

**Story:** "Transient failures are normal; automated retry handles them."
**Gotcha:** Don't retry non-idempotent operations. Know when to give up.

---

## Questions to Ask

When you recognize a pattern, ask:

1. **Why this pattern?** What problem does it solve here?
2. **What's the cost?** Every pattern has trade-offs.
3. **Is it applied consistently?** Inconsistency is a smell.
4. **Where does it break down?** Every pattern has limits.
5. **What would you do differently?** Learn from their choices.
