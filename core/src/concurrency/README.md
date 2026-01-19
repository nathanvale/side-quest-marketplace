# Concurrency Utilities

Utilities for safe concurrent operations with file locking and transaction rollback support.

## Modules

### `withFileLock`

Execute operations with exclusive file locks to prevent race conditions.

**Features:**
- Filesystem-based locking (no external dependencies)
- Stale lock detection and automatic cleanup
- Automatic lock release on success or error
- Configurable timeout (30 seconds default)

**Usage:**

```typescript
import { withFileLock } from "@sidequest/core/concurrency";

// Prevent concurrent modifications to a resource
await withFileLock('classifier-registry', async () => {
  const registry = await readRegistry();
  registry.classifiers.push(newClassifier);
  await writeRegistry(registry);
});

// Lock is automatically released even if operation throws
```

**Concurrent Access Behavior:**

```typescript
// Process 1 acquires lock immediately
const result1 = withFileLock('resource-1', async () => {
  await someWork();
  return 'done';
});

// Process 2 waits until Process 1 releases lock
const result2 = withFileLock('resource-1', async () => {
  await moreWork();
  return 'also done';
});

// Different resources can be locked concurrently
const result3 = withFileLock('resource-2', async () => {
  await independentWork(); // Runs in parallel with resource-1
  return 'independent';
});
```

### `cleanupStaleLocks`

Maintenance utility for removing stale lock files from crashed processes.

**Usage:**

```typescript
import { cleanupStaleLocks } from "@sidequest/core/concurrency";

// On application startup
const result = await cleanupStaleLocks();
console.log(`Cleaned ${result.cleanedCount} of ${result.totalFiles} locks`);
```

### `Transaction` & `executeTransaction`

Execute multi-step operations with automatic rollback on failure.

**Features:**
- All-or-nothing semantics
- Automatic rollback in reverse order
- Rollback state capture and replay
- Continues rollback even if rollback operations fail

**Usage:**

```typescript
import { Transaction } from "@sidequest/core/concurrency";

const tx = new Transaction();

// Add operations that can be rolled back
tx.add({
  name: 'create-file',
  execute: async () => {
    await writeFile(path, content);
    return { path }; // Returned value passed to rollback
  },
  rollback: async (result) => {
    const { path } = result;
    await unlink(path).catch(() => {}); // Clean up on failure
  }
});

tx.add({
  name: 'update-registry',
  execute: async () => {
    const registry = await readRegistry();
    registry.items.push(newItem);
    await writeRegistry(registry);
    return { registry };
  },
  rollback: async ({ registry }) => {
    registry.items.pop();
    await writeRegistry(registry);
  }
});

// Execute all operations
const result = await tx.execute<string>();

if (!result.success) {
  console.error(`Transaction failed at ${result.failedAt}: ${result.error.message}`);
  // All completed operations have been rolled back
}
```

**Convenience Function:**

```typescript
import { executeTransaction } from "@sidequest/core/concurrency";

const result = await executeTransaction([
  {
    name: 'op1',
    execute: async () => { /* ... */ },
    rollback: async () => { /* ... */ }
  },
  {
    name: 'op2',
    execute: async () => { /* ... */ },
    rollback: async () => { /* ... */ }
  }
]);
```

## Use Cases

### File Creation with Cleanup

```typescript
import { Transaction } from "@sidequest/core/concurrency";

async function createClassifier(name: string, code: string) {
  const tx = new Transaction();

  tx.add({
    name: 'create-classifier-file',
    execute: async () => {
      const path = `classifiers/${name}.ts`;
      await writeFile(path, code);
      return { path };
    },
    rollback: async ({ path }) => {
      await unlink(path).catch(() => {});
    }
  });

  tx.add({
    name: 'update-registry',
    execute: async () => {
      const registry = await readRegistry();
      registry.classifiers.push({ name, path: `classifiers/${name}.ts` });
      await writeRegistry(registry);
    },
    rollback: async () => {
      const registry = await readRegistry();
      registry.classifiers = registry.classifiers.filter(c => c.name !== name);
      await writeRegistry(registry);
    }
  });

  return tx.execute();
}
```

### Registry Updates with Locking

```typescript
import { withFileLock } from "@sidequest/core/concurrency";

async function addToRegistry(item: RegistryItem) {
  return withFileLock('registry', async () => {
    const registry = await readRegistry();

    // Check for duplicates
    if (registry.items.some(i => i.id === item.id)) {
      throw new Error(`Item ${item.id} already exists`);
    }

    registry.items.push(item);
    await writeRegistry(registry);

    return item;
  });
}
```

### Combined: Transaction + Locking

```typescript
import { Transaction, withFileLock } from "@sidequest/core/concurrency";

async function createClassifierWithLocking(name: string, code: string) {
  return withFileLock('classifier-creation', async () => {
    const tx = new Transaction();

    // Add operations...

    return tx.execute();
  });
}
```

## Implementation Details

### File Locking

- Lock files stored in: `${tmpdir}/sidequest-locks/`
- Lock file format: `{hash}.lock` containing process PID
- Uses `wx` flag for atomic lock creation (POSIX O_EXCL)
- Polls every 100ms with 30-second timeout
- Automatically removes stale locks (PID doesn't exist)

### Transaction Execution

- Operations execute sequentially (not in parallel)
- Each operation's result is captured for rollback
- On failure, rollback runs in reverse order
- Rollback errors are logged but don't stop other rollbacks
- Completed operations list is cleared after rollback

## Testing

The module includes comprehensive test coverage:

- **file-lock.test.ts**: Concurrent access, stale lock cleanup, error handling
- **transaction.test.ts**: Success cases, rollback scenarios, real-world examples

Run tests:

```bash
bun test core/src/concurrency/
```

## Migration from para-obsidian

This module was extracted from `para-obsidian/src/shared/` to make these utilities available across all plugins.

**Changes from original:**

1. Removed dependencies on `instrumentation.ts` and `logger.ts`
2. Lock directory changed from `para-obsidian-locks` to `sidequest-locks`
3. Simplified error logging (uses `console.error` instead of structured logger)
4. All other behavior preserved

**To migrate existing code:**

```typescript
// Before (para-obsidian)
import { withFileLock } from "../shared/file-lock.js";
import { Transaction } from "../shared/transaction.js";

// After (core)
import { withFileLock, Transaction } from "@sidequest/core/concurrency";
```
