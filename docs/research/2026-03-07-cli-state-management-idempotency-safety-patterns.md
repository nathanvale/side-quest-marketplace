# CLI State Management, Idempotency, and Safety Patterns

> Deep research for AI-agent-consumed CLI tools.
> Date: 2026-03-07

---

## Table of Contents

1. [Atomic File Writes](#1-atomic-file-writes)
2. [Lock Files for CLI Tools](#2-lock-files-for-cli-tools)
3. [Idempotency Patterns](#3-idempotency-patterns)
4. [Config File Management](#4-config-file-management)
5. [Audit Trails](#5-audit-trails)
6. [Dry-Run and Preview Patterns](#6-dry-run-and-preview-patterns)
7. [Session Management](#7-session-management)

---

## 1. Atomic File Writes

### The Problem

A naive `fs.writeFileSync(path, data)` can leave a corrupted or partial file if:
- The process crashes mid-write
- Power is lost before the OS flushes to disk
- Another process reads the file during the write

### The Pattern: Temp + Fsync + Rename

```
write(tmpfile) -> fsync(tmpfile) -> rename(tmpfile, target)
```

**Why it works:** On POSIX, `rename()` is atomic at the filesystem level -- the target file either has the old content or the new content, never partial content.

### Implementation (TypeScript/Bun)

```typescript
import { writeFileSync, fsyncSync, renameSync, unlinkSync, openSync, closeSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';

/**
 * Write a file atomically using temp-fsync-rename.
 * Guarantees the target file is never partially written.
 */
function atomicWriteSync(filePath: string, data: string, options?: {
  mode?: number;       // e.g. 0o600 for secrets
  fsync?: boolean;     // default true
}): void {
  const dir = dirname(filePath);
  const tmpfile = join(dir, `.${randomBytes(8).toString('hex')}.tmp`);

  try {
    // 1. Write to temp file in the SAME directory (required for rename)
    const fd = openSync(tmpfile, 'w', options?.mode ?? 0o644);
    try {
      writeFileSync(fd, data);
      // 2. Fsync to ensure data hits disk
      if (options?.fsync !== false) {
        fsyncSync(fd);
      }
    } finally {
      closeSync(fd);
    }
    // 3. Atomic rename
    renameSync(tmpfile, filePath);
  } catch (err) {
    // Clean up temp file on failure
    try { unlinkSync(tmpfile); } catch {}
    throw err;
  }
}
```

### Critical Details

| Concern | Guidance |
|---------|----------|
| **Temp file location** | MUST be in the same directory as target. `rename()` across filesystems fails with EXDEV. |
| **Temp file naming** | Use random suffix, not PID alone. `write-file-atomic` uses SHA1(filename + PID + threadId + counter). |
| **Fsync** | Default ON for durability. Skip only for performance-critical non-essential data. |
| **Directory fsync** | For full POSIX durability, also fsync the parent directory's fd after rename. Most CLIs skip this -- it only matters if the machine loses power mid-operation. |
| **File permissions** | Set mode on `open()`, not after write. For secrets: `0o600` (owner read/write only). |
| **Windows** | `rename()` may fail if target is open by another process. `write-file-atomic` queues concurrent writes to serialize them. |
| **Cleanup on crash** | Use `signal-exit` or `process.on('exit')` to unlink temp files on unexpected termination. |

### Libraries

| Library | Notes |
|---------|-------|
| **[write-file-atomic](https://www.npmjs.com/package/write-file-atomic)** | npm's own library. Handles chown, serializes concurrent writes, signal cleanup. |
| **[atomically](https://www.npmjs.com/package/atomically)** | Zero dependencies, ~20% smaller. Same pattern. |

### Source: `write-file-atomic` internals

The library generates temp names using:
```javascript
crypto.createHash('sha1')
  .update(__filename)
  .update(String(process.pid))
  .update(String(threadId))
  .update(String(++invocations))
  .digest().readUInt32BE(0)
```

It tolerates chown ENOSYS/EINVAL/EPERM for non-root processes (platform compatibility). On process exit, it synchronously unlinks any outstanding temp files via `signal-exit`.

---

## 2. Lock Files for CLI Tools

### Why Lock

When an AI agent retries a failed CLI command, or runs two instances concurrently, you need to prevent double-mutation. A lock file ensures single-writer access.

### Strategy Comparison

| Strategy | Pros | Cons |
|----------|------|------|
| **mkdir** (proper-lockfile) | Atomic on all filesystems including NFS. | Requires periodic mtime updates. |
| **open(..., 'wx')** (O_EXCL) | Simple, no polling. | Broken on NFS. Stale detection harder. |
| **PID file** | Human-readable, easy debug. | Race condition between read-check-write. Not atomic without O_EXCL. |
| **flock/fcntl** | OS-level advisory locks. | Not portable. Released on process exit (good and bad). |

### Recommended: mkdir + mtime (proper-lockfile pattern)

```typescript
import { mkdirSync, statSync, rmdirSync, utimesSync } from 'node:fs';

interface LockOptions {
  staleMs?: number;    // Default 10000 -- lock considered stale after this
  updateMs?: number;   // Default staleMs/2 -- mtime refresh interval
  retries?: number;    // Default 0
  retryDelayMs?: number;
}

/**
 * Acquire an exclusive lock using mkdir (atomic on all filesystems).
 * Returns a release function.
 */
function acquireLock(lockPath: string, opts: LockOptions = {}): () => void {
  const staleMs = opts.staleMs ?? 10_000;
  const updateMs = Math.min(opts.updateMs ?? staleMs / 2, staleMs / 2);
  const retries = opts.retries ?? 0;

  let attempts = 0;
  while (true) {
    try {
      // mkdir is atomic -- if directory exists, this throws EEXIST
      mkdirSync(lockPath);
      break;
    } catch (err: any) {
      if (err.code !== 'EEXIST') throw err;

      // Check if existing lock is stale
      try {
        const stat = statSync(lockPath);
        if (Date.now() - stat.mtimeMs > staleMs) {
          // Stale lock -- remove and retry
          rmdirSync(lockPath);
          continue;
        }
      } catch {
        // Lock was removed between EEXIST and stat -- retry
        continue;
      }

      if (attempts >= retries) {
        throw new Error(
          `Lock "${lockPath}" is held by another process. ` +
          `If you believe this is stale, delete it manually or wait ${staleMs}ms.`
        );
      }
      attempts++;
      // Blocking wait (for CLI tools, this is acceptable)
      Bun.sleepSync(opts.retryDelayMs ?? 1000);
    }
  }

  // Periodically touch mtime to prove we're alive
  const timer = setInterval(() => {
    try {
      const now = new Date();
      utimesSync(lockPath, now, now);
    } catch {
      // Lock may have been externally removed -- stop updating
      clearInterval(timer);
    }
  }, updateMs);

  // Return release function
  return () => {
    clearInterval(timer);
    try { rmdirSync(lockPath); } catch {}
  };
}
```

### Stale Lock Detection

The mtime approach works like a heartbeat:

```
t=0s:  Lock acquired, mtime set
t=5s:  Timer fires, mtime updated to now
t=10s: Timer fires, mtime updated to now
...
Process crashes at t=12s. Timer stops.
t=22s: Another process checks: mtime is 10s old > staleMs threshold.
       Lock is stale. Safe to remove and re-acquire.
```

### Contention Error Messages (Agent-Friendly)

When a lock is held, the error should tell the agent what to do:

```typescript
const lockError = {
  code: 'LOCK_HELD',
  action: 'wait_and_retry',
  retryable: true,
  recommendedDelayMs: 5000,
  message: 'Another xero-cli process holds the lock. Retry in 5s.',
  lockPath: '/path/to/.xero-reconcile.lock',
  lockAge: '3200ms',
};
```

### Symlink Attack Prevention

- **Use `realpath()` before locking** to resolve symlinks. `proper-lockfile` does this by default.
- **Never create locks in world-writable dirs** (like `/tmp`). Use the project directory or XDG_STATE_HOME.
- **Set restrictive permissions** on lock directories if using file-based locks.

### Library: proper-lockfile

```typescript
import lockfile from 'proper-lockfile';

const release = await lockfile.lock('path/to/state.json', {
  stale: 10000,     // 10s stale threshold
  retries: 3,       // retry 3 times
  realpath: true,   // resolve symlinks (default)
});

try {
  // ... do work ...
} finally {
  await release();
}
```

---

## 3. Idempotency Patterns

### 3.1 Idempotency Keys (Request-Level Dedup)

From the [AWS Builders Library](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/):

> The service must execute an ACID operation that atomically records the idempotency
> token and completes all mutations simultaneously.

**Applied to CLI tools:** When making API calls that mutate data (e.g., reconciling a transaction), generate a deterministic idempotency key and persist it with the result.

```typescript
import { createHash } from 'node:crypto';

/**
 * Generate a deterministic idempotency key from operation inputs.
 * Same inputs always produce the same key.
 */
function idempotencyKey(parts: string[]): string {
  return createHash('sha256')
    .update(parts.join('|'))
    .digest('hex')
    .slice(0, 32);
}

// Example: reconciling a bank transaction
const key = idempotencyKey([
  'reconcile',
  bankTransactionId,
  matchedInvoiceId,
  amount.toString(),
]);
```

**Key AWS insight:** Return semantically equivalent responses for duplicate requests, not errors. If an agent retries `reconcile TX-123`, and TX-123 is already reconciled, return `{ status: 'already_reconciled', transactionId: 'TX-123' }` -- not a 409 Conflict.

### 3.2 State Files (Track "Already Processed")

Pattern used by database migration tools (Prisma, Drizzle, knex) and this project's `.xero-reconcile-state.json`:

```typescript
interface StateFile {
  schemaVersion: number;
  lastRunAt: string;              // ISO timestamp
  processedItems: Record<string, ProcessedItem>;
}

interface ProcessedItem {
  id: string;
  processedAt: string;
  checksum: string;               // Hash of input data at processing time
  result: 'success' | 'skipped' | 'error';
  error?: string;
}
```

**Checksum pattern from Prisma:** Prisma's `_prisma_migrations` table stores a checksum of each migration file. If the file changes after being applied, Prisma detects the drift and refuses to proceed. Apply this to CLI state:

```typescript
/**
 * Check if an item needs processing by comparing checksums.
 * Returns true if the item is new or has changed since last processing.
 */
function needsProcessing(
  state: StateFile,
  itemId: string,
  currentChecksum: string
): boolean {
  const existing = state.processedItems[itemId];
  if (!existing) return true;                    // Never processed
  if (existing.result === 'error') return true;  // Previous attempt failed
  if (existing.checksum !== currentChecksum) return true; // Data changed
  return false;                                  // Already processed, same data
}
```

### 3.3 Checkpoint/Resume for Long-Running Operations

Inspired by AWS Lambda Durable Functions (re:Invent 2025) and Terraform's state management:

```typescript
interface Checkpoint {
  operationId: string;           // UUID for this run
  startedAt: string;
  phase: 'fetch' | 'process' | 'commit';
  cursor: number;                // Index of last successfully processed item
  totalItems: number;
  results: ProcessingResult[];   // Accumulated results so far
}

/**
 * Resume-aware batch processor.
 * Picks up from last checkpoint on retry.
 */
async function processWithCheckpoints<T>(
  items: T[],
  processor: (item: T) => Promise<ProcessingResult>,
  checkpointPath: string,
  flushEvery = 10,
): Promise<ProcessingResult[]> {
  // Try to resume from existing checkpoint
  let checkpoint: Checkpoint;
  try {
    checkpoint = JSON.parse(await Bun.file(checkpointPath).text());
  } catch {
    checkpoint = {
      operationId: crypto.randomUUID(),
      startedAt: new Date().toISOString(),
      phase: 'process',
      cursor: 0,
      totalItems: items.length,
      results: [],
    };
  }

  // Skip already-processed items
  for (let i = checkpoint.cursor; i < items.length; i++) {
    const result = await processor(items[i]);
    checkpoint.results.push(result);
    checkpoint.cursor = i + 1;

    // Periodic flush to disk
    if ((i + 1) % flushEvery === 0) {
      atomicWriteSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
    }
  }

  // Final flush and cleanup
  atomicWriteSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
  return checkpoint.results;
}
```

### 3.4 StateBatcher Pattern

For high-frequency state updates, batch in memory and flush periodically:

```typescript
/**
 * Batches state mutations in memory, flushes to disk on interval
 * or when a threshold is reached. Prevents excessive disk I/O.
 */
class StateBatcher<T extends Record<string, unknown>> {
  private dirty = false;
  private flushTimer: Timer | null = null;

  constructor(
    private state: T,
    private filePath: string,
    private options: {
      flushIntervalMs?: number;  // Default 5000
      maxPendingWrites?: number; // Default 50
    } = {},
  ) {
    this.startFlushTimer();
  }

  /** Update state in memory. Flushes when threshold is hit. */
  update(mutator: (state: T) => void): void {
    mutator(this.state);
    this.dirty = true;
    this.pendingWrites++;
    if (this.pendingWrites >= (this.options.maxPendingWrites ?? 50)) {
      this.flush();
    }
  }

  private pendingWrites = 0;

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      if (this.dirty) this.flush();
    }, this.options.flushIntervalMs ?? 5000);
  }

  /** Write current state to disk atomically. */
  flush(): void {
    if (!this.dirty) return;
    atomicWriteSync(this.filePath, JSON.stringify(this.state, null, 2));
    this.dirty = false;
    this.pendingWrites = 0;
  }

  /** Must be called on process exit to avoid data loss. */
  dispose(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flush();
  }
}
```

---

## 4. Config File Management

### 4.1 Precedence Hierarchy

The universally accepted precedence order (highest to lowest):

```
CLI flag  >  Environment variable  >  Project config file  >  User config file  >  Default
```

```typescript
import { z } from 'zod';

const ConfigSchema = z.object({
  tenantId: z.string().uuid(),
  outputFormat: z.enum(['json', 'table', 'quiet']).default('json'),
  dryRun: z.boolean().default(false),
  apiTimeout: z.number().min(1000).max(60000).default(30000),
});

type Config = z.infer<typeof ConfigSchema>;

/**
 * Resolve configuration with explicit precedence.
 * Each source can provide partial config. Higher-priority sources override lower.
 */
function resolveConfig(
  flags: Partial<Config>,
  env: NodeJS.ProcessEnv,
  projectConfigPath: string,
  userConfigPath: string,
): Config {
  // Layer 4: Defaults (handled by Zod .default())
  // Layer 3: User config (~/.config/xero-cli/config.json)
  const userConfig = safeReadJson(userConfigPath) ?? {};
  // Layer 2: Project config (./.xero-config.json)
  const projectConfig = safeReadJson(projectConfigPath) ?? {};
  // Layer 1: Environment variables
  const envConfig = {
    tenantId: env.XERO_TENANT_ID,
    outputFormat: env.XERO_OUTPUT_FORMAT,
    dryRun: env.XERO_DRY_RUN === 'true',
  };
  // Layer 0: CLI flags (highest priority)

  const merged = {
    ...userConfig,
    ...projectConfig,
    ...stripUndefined(envConfig),
    ...stripUndefined(flags),
  };

  return ConfigSchema.parse(merged);
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}
```

### 4.2 XDG Base Directory Compliance

Where to put what:

| XDG Variable | Default | Use For |
|-------------|---------|---------|
| `XDG_CONFIG_HOME` | `~/.config` | Configuration files (`config.json`, `profiles.json`) |
| `XDG_DATA_HOME` | `~/.local/share` | Persistent data (token store, downloaded resources) |
| `XDG_STATE_HOME` | `~/.local/state` | State that persists across restarts but isn't portable (logs, history, session data, reconcile state) |
| `XDG_CACHE_HOME` | `~/.cache` | Non-essential cached data (API response cache) |
| `XDG_RUNTIME_DIR` | (no default) | Runtime files, sockets. Permissions MUST be `0700`. |

```typescript
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Resolve XDG directory with spec-compliant defaults. */
function xdgPath(
  variable: string,
  fallbackRelative: string,
  appName: string,
): string {
  const base = process.env[variable] || join(homedir(), fallbackRelative);
  return join(base, appName);
}

const paths = {
  config: xdgPath('XDG_CONFIG_HOME', '.config', 'xero-cli'),
  data:   xdgPath('XDG_DATA_HOME', '.local/share', 'xero-cli'),
  state:  xdgPath('XDG_STATE_HOME', '.local/state', 'xero-cli'),
  cache:  xdgPath('XDG_CACHE_HOME', '.cache', 'xero-cli'),
};
```

**Key rule from the spec:** All paths MUST be absolute. If the env var contains a relative path, ignore it and use the default.

### 4.3 Secure Secret Storage

| Approach | Security | Portability | Complexity |
|----------|----------|-------------|------------|
| macOS Keychain (`security` CLI) | High | macOS only | Medium |
| OS credential helpers (git-credential pattern) | High | Cross-platform | Medium |
| Encrypted file (AES-256) with user passphrase | Medium | Cross-platform | High |
| File with `0600` permissions | Low-Medium | POSIX only | Low |
| Environment variables | Low | Cross-platform | Low |

**Recommendation for CLI tools consumed by agents:** Use file-based token storage with `0o600` permissions and atomic writes. Agents can't interact with Keychain prompts. The token file should be in `XDG_DATA_HOME` (not config -- tokens are data, not configuration).

```typescript
/** Write a token file with restrictive permissions. */
function writeTokenFile(tokenPath: string, tokens: TokenSet): void {
  atomicWriteSync(
    tokenPath,
    JSON.stringify(tokens, null, 2),
    { mode: 0o600, fsync: true }
  );
}
```

### 4.4 Library: zod-config

For complex multi-source config loading with Zod validation:

```typescript
// zod-config supports multiple adapters with precedence
import { loadConfig } from 'zod-config';
import { envAdapter } from 'zod-config/env-adapter';
import { jsonAdapter } from 'zod-config/json-adapter';

const config = await loadConfig({
  schema: ConfigSchema,
  adapters: [
    jsonAdapter({ path: '.xero-config.json' }),  // Lower priority
    envAdapter({ prefixKey: 'XERO_' }),            // Higher priority
  ],
});
```

---

## 5. Audit Trails

### Why Audit Trails Matter for Agent-Consumed CLIs

When an AI agent runs `xero-cli reconcile`, you need to answer: "What did the agent do, when, and can we undo it?" This is especially important for financial operations.

### 5.1 Run Log Structure

```
~/.local/state/xero-cli/
  audit/
    2026-03-07/
      run-1709812345-abc123.json    # One file per CLI invocation
      run-1709812399-def456.json
```

```typescript
interface AuditEntry {
  /** Unique run identifier */
  runId: string;
  /** ISO timestamp */
  startedAt: string;
  completedAt: string;
  /** The command that was executed */
  command: string;
  args: string[];
  /** Who/what invoked it */
  invoker: 'human' | 'agent';
  agentCorrelationId?: string;
  /** What happened */
  outcome: 'success' | 'partial' | 'error';
  /** Before/after snapshots for mutations */
  mutations: Mutation[];
  /** Summary statistics */
  stats: {
    itemsProcessed: number;
    itemsSkipped: number;
    itemsFailed: number;
    durationMs: number;
  };
}

interface Mutation {
  entityType: string;          // e.g. 'BankTransaction'
  entityId: string;
  action: 'create' | 'update' | 'delete';
  before?: Record<string, unknown>;  // Snapshot before mutation
  after?: Record<string, unknown>;   // Snapshot after mutation
  /** Idempotency key for this specific mutation */
  idempotencyKey: string;
}
```

### 5.2 Before/After Snapshots

The NIST SP 800-12 audit trail standard recommends recording "before and after versions of records." For CLI tools:

```typescript
/**
 * Capture a before/after snapshot for audit purposes.
 * Call getBefore() before mutation, getAfter() after.
 */
function createMutationAudit(
  entityType: string,
  entityId: string,
  action: Mutation['action'],
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
): Mutation {
  return {
    entityType,
    entityId,
    action,
    before,
    after,
    idempotencyKey: idempotencyKey([entityType, entityId, action, JSON.stringify(after)]),
  };
}
```

### 5.3 Reconciliation Reports

After a batch operation, generate a human-readable (and machine-parseable) report:

```typescript
interface ReconciliationReport {
  runId: string;
  generatedAt: string;
  summary: {
    total: number;
    matched: number;
    unmatched: number;
    errors: number;
  };
  details: Array<{
    transactionId: string;
    status: 'matched' | 'unmatched' | 'error';
    matchedTo?: string;
    reason?: string;
  }>;
}
```

### 5.4 Retention and Cleanup

- Keep audit logs for a configurable period (default: 90 days for financial data).
- Use date-partitioned directories for easy cleanup: `rm -rf audit/2025-12-*`
- Never delete audit logs during normal operation -- only via explicit `audit prune` command.

---

## 6. Dry-Run and Preview Patterns

### The Terraform Model

Terraform's plan-apply workflow is the gold standard for safe mutation:

```
terraform plan -out=tfplan    # Phase 1: Preview (no mutations)
terraform apply tfplan        # Phase 2: Execute (uses saved plan)
```

Key design decisions from Terraform:
- **Plans are saved to files** -- the exact plan that was reviewed is the one that executes.
- **Auto-approve flag** for headless/automation mode: `terraform apply -auto-approve`
- **Lock during plan AND apply** -- prevents drift between preview and execution.
- **Plan output includes:** resources to add (+), change (~), and destroy (-).

### 6.1 Dry-Run Implementation

```typescript
interface DryRunResult {
  /** What would happen if this command ran for real */
  wouldDo: PlannedAction[];
  /** Warnings about potential issues */
  warnings: string[];
  /** Whether the plan can be saved and executed later */
  canSavePlan: boolean;
}

interface PlannedAction {
  action: 'create' | 'update' | 'delete' | 'skip';
  entityType: string;
  entityId: string;
  description: string;
  /** For updates: what fields would change */
  changes?: Array<{
    field: string;
    from: unknown;
    to: unknown;
  }>;
}

// CLI usage:
// xero-cli reconcile --dry-run              -> prints plan, exits
// xero-cli reconcile --dry-run --out=plan   -> saves plan to file
// xero-cli reconcile --plan=plan.json       -> executes saved plan
// xero-cli reconcile --yes                  -> auto-approve (headless)
```

### 6.2 Two-Phase Commit for CLIs

```typescript
/**
 * Execute a mutation with plan-then-commit semantics.
 * In interactive mode: shows plan, prompts for confirmation.
 * In headless mode (--yes flag): auto-approves.
 * With --dry-run: returns plan without executing.
 */
async function planAndExecute<T>(options: {
  plan: () => Promise<PlannedAction[]>;
  execute: (actions: PlannedAction[]) => Promise<T>;
  dryRun: boolean;
  autoApprove: boolean;
  planFilePath?: string;
}): Promise<{ planned: PlannedAction[]; result?: T }> {
  // Phase 1: Plan
  const planned = options.planFilePath
    ? JSON.parse(await Bun.file(options.planFilePath).text())
    : await options.plan();

  if (options.dryRun) {
    if (options.planFilePath) {
      // Save plan for later execution
      atomicWriteSync(options.planFilePath, JSON.stringify(planned, null, 2));
    }
    return { planned };
  }

  // Phase 2: Confirm
  if (!options.autoApprove) {
    printPlanSummary(planned);
    const confirmed = await promptConfirmation('Proceed with these changes?');
    if (!confirmed) {
      return { planned };
    }
  }

  // Phase 3: Execute
  const result = await options.execute(planned);
  return { planned, result };
}
```

### 6.3 Headless Mode Detection

Agents can't respond to interactive prompts. Detect headless mode:

```typescript
/**
 * Determine if the CLI is running in headless (non-interactive) mode.
 * Headless mode auto-approves confirmations and uses JSON output.
 */
function isHeadless(): boolean {
  return (
    !process.stdin.isTTY ||               // Not a terminal
    process.env.CI === 'true' ||          // CI environment
    process.env.XERO_HEADLESS === 'true'  // Explicit flag
  );
}
```

### 6.4 Rollback Capabilities

For operations that support undo:

```typescript
interface RollbackPlan {
  runId: string;
  createdAt: string;
  /** Ordered list of undo operations (reverse of apply order) */
  undoActions: Array<{
    action: 'delete' | 'restore' | 'update';
    entityType: string;
    entityId: string;
    restoreTo: Record<string, unknown>;  // The "before" snapshot
  }>;
}

// Store rollback plan alongside the audit entry
// xero-cli rollback --run-id=abc123
```

---

## 7. Session Management

### When Sessions Matter

For CLI tools consumed by agents, sessions bridge multiple invocations:
- Agent runs `xero-cli transactions --unreconciled` (fetch phase)
- Agent processes results, decides matches
- Agent runs `xero-cli reconcile --batch` (commit phase)

The session ties these invocations together for correlation and cleanup.

### 7.1 Session Types

| Type | Lifetime | Storage | Use Case |
|------|----------|---------|----------|
| **Ephemeral** | Single command | Memory only | Stateless queries |
| **Sticky** | Multiple commands, same "task" | State file | Multi-step workflows (fetch -> process -> commit) |
| **Resumable** | Survives process crashes | Checkpoint file | Long-running batch operations |

### 7.2 Implementation

```typescript
interface Session {
  id: string;                    // UUID
  createdAt: string;
  lastActivityAt: string;
  /** Correlation ID for linking related audit entries */
  correlationId: string;
  /** What phase the session is in */
  phase: string;
  /** Arbitrary session data */
  data: Record<string, unknown>;
  /** TTL in milliseconds */
  expiresAt: string;
}

const SESSION_DIR = join(
  xdgPath('XDG_STATE_HOME', '.local/state', 'xero-cli'),
  'sessions'
);

/**
 * Create or resume a session.
 * Pass an existing sessionId to resume, or omit for a new session.
 */
function getSession(sessionId?: string): Session {
  if (sessionId) {
    const sessionPath = join(SESSION_DIR, `${sessionId}.json`);
    try {
      const session: Session = JSON.parse(
        readFileSync(sessionPath, 'utf-8')
      );
      // Check expiry
      if (new Date(session.expiresAt) < new Date()) {
        unlinkSync(sessionPath);
        throw new Error(`Session ${sessionId} has expired`);
      }
      // Touch last activity
      session.lastActivityAt = new Date().toISOString();
      atomicWriteSync(sessionPath, JSON.stringify(session, null, 2));
      return session;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        throw new Error(`Session ${sessionId} not found`);
      }
      throw err;
    }
  }

  // Create new session
  const session: Session = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    correlationId: crypto.randomUUID(),
    phase: 'init',
    data: {},
    expiresAt: new Date(Date.now() + 3600_000).toISOString(), // 1 hour default
  };

  mkdirSync(SESSION_DIR, { recursive: true });
  atomicWriteSync(
    join(SESSION_DIR, `${session.id}.json`),
    JSON.stringify(session, null, 2)
  );
  return session;
}
```

### 7.3 Stale Session Cleanup

Inspired by Gemini CLI's session retention policy:

```typescript
interface CleanupPolicy {
  maxAge: number;     // milliseconds
  maxCount: number;   // keep N most recent
}

/**
 * Clean up expired and excess sessions.
 * Call on CLI startup (non-blocking).
 */
function cleanupSessions(policy: CleanupPolicy = {
  maxAge: 30 * 24 * 3600_000,   // 30 days
  maxCount: 50,
}): { removed: number } {
  const files = readdirSync(SESSION_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const path = join(SESSION_DIR, f);
      const stat = statSync(path);
      return { path, mtimeMs: stat.mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs); // newest first

  let removed = 0;
  const now = Date.now();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const tooOld = now - file.mtimeMs > policy.maxAge;
    const overLimit = i >= policy.maxCount;

    if (tooOld || overLimit) {
      try { unlinkSync(file.path); removed++; } catch {}
    }
  }

  return { removed };
}
```

### 7.4 Session Correlation for Agents

When an agent invokes multiple CLI commands as part of one task, pass a correlation ID:

```bash
# Agent generates a correlation ID once per task
CORRELATION_ID=$(uuidgen)

# All commands in this task share the same correlation ID
xero-cli transactions --unreconciled --session-correlation=$CORRELATION_ID
xero-cli reconcile --batch input.json --session-correlation=$CORRELATION_ID
```

This lets audit logs be filtered by correlation ID to reconstruct the full agent workflow.

---

## Cross-Cutting Patterns Summary

### How These Patterns Compose

```
Agent invokes CLI command
  |
  +-- Resolve config (flag > env > project > user > default) [Section 4]
  |
  +-- Acquire lock (mkdir + mtime heartbeat) [Section 2]
  |     |
  |     +-- Load/resume checkpoint [Section 3.3]
  |     |
  |     +-- For each item:
  |     |     +-- Check idempotency (already processed?) [Section 3.2]
  |     |     +-- Capture before snapshot [Section 5.2]
  |     |     +-- If --dry-run: record planned action [Section 6.1]
  |     |     +-- If executing: mutate + capture after snapshot
  |     |     +-- Update state batcher [Section 3.4]
  |     |     +-- Flush checkpoint periodically [Section 3.3]
  |     |
  |     +-- Flush final state (atomic write) [Section 1]
  |     |
  |     +-- Write audit entry [Section 5.1]
  |
  +-- Release lock [Section 2]
  |
  +-- Update session [Section 7]
  |
  +-- Output result envelope to stdout [agent-reliability-guardrails skill]
```

---

## Sources

### Atomic File Writes
- [write-file-atomic (npm)](https://www.npmjs.com/package/write-file-atomic)
- [write-file-atomic source (GitHub)](https://github.com/npm/write-file-atomic)
- [atomically (npm)](https://www.npmjs.com/package/atomically)
- [Rename atomicity is not enough (GitHub issue)](https://github.com/npm/write-file-atomic/issues/64)

### Lock Files
- [proper-lockfile (npm)](https://www.npmjs.com/package/proper-lockfile)
- [proper-lockfile source (GitHub)](https://github.com/moxystudio/node-proper-lockfile)
- [Understanding Node.js file locking (LogRocket)](https://blog.logrocket.com/understanding-node-js-file-locking/)
- [Secure tempfiles in NodeJS (Advanced Web Machinery)](https://advancedweb.hu/secure-tempfiles-in-nodejs-without-dependencies/)

### Idempotency
- [Making retries safe with idempotent APIs (AWS Builders Library)](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/)
- [AWS Lambda Durable Functions (re:Invent 2025)](https://repost.aws/articles/ARc8wmu4l9TKywZCHX-_nn6w/re-invent-2025-deep-dive-on-aws-lambda-durable-functions)
- [Building Idempotent Data Pipelines (Medium)](https://medium.com/towards-data-engineering/building-idempotent-data-pipelines-a-practical-guide-to-reliability-at-scale-2afc1dcb7251)
- [Prisma Migrations docs](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/shadow-database)
- [Drizzle ORM Migrations](https://orm.drizzle.team/docs/migrations)

### Config Management
- [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir/latest/)
- [xdg-basedir (npm)](https://www.npmjs.com/package/xdg-basedir)
- [zod-config (GitHub)](https://github.com/alexmarqs/zod-config)
- [znv - Type-safe env parsing with Zod (GitHub)](https://github.com/lostfictions/znv)

### State Management (Terraform/Pulumi)
- [Terraform State Locking (HashiCorp)](https://developer.hashicorp.com/terraform/language/state/locking)
- [Terraform Plan command (HashiCorp)](https://developer.hashicorp.com/terraform/cli/commands/plan)
- [Terraform Apply command (HashiCorp)](https://developer.hashicorp.com/terraform/cli/commands/apply)
- [Terraform state locking explained (StateGraph)](https://stategraph.com/blog/terraform-state-locking-explained)

### Audit Trails
- [NIST SP 800-12: Audit Trails](https://csrc.nist.rip/publications/nistpubs/800-12/800-12-html/chapter18.html)
- [Audit Logging guide (Splunk)](https://www.splunk.com/en_us/blog/learn/audit-logs.html)

### Session Management
- [Gemini CLI Session Management (Google Developers Blog)](https://developers.googleblog.com/pick-up-exactly-where-you-left-off-with-session-management-in-gemini-cli/)
- [Session Management (OWASP Cheat Sheet)](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)

### Security
- [Symlink attacks on tmpfiles (LWN.net)](https://lwn.net/Articles/250468/)
- [node-tmp symlink advisory (GitHub)](https://github.com/raszi/node-tmp/security/advisories/GHSA-52f5-9888-hmc6)
