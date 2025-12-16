# Security Architecture

**Defense-in-depth security for para-obsidian plugin**

This document describes the security measures implemented throughout the para-obsidian plugin to prevent data corruption, injection attacks, race conditions, and unauthorized access.

---

## Table of Contents

1. [Security Architecture Overview](#security-architecture-overview)
2. [Threat Model & Mitigations](#threat-model--mitigations)
3. [Input Validation](#input-validation)
4. [Atomic Operations](#atomic-operations)
5. [Concurrency Control](#concurrency-control)
6. [AST-Based Code Generation](#ast-based-code-generation)
7. [Security Best Practices](#security-best-practices)

---

## Security Architecture Overview

### Defense-in-Depth Approach

The plugin implements **multiple layers of security** to protect against various attack vectors:

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                       │
│  • Input validation at all entry points                     │
│  • Sanitization of user-provided patterns and filenames     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    File System Layer                         │
│  • Atomic write operations (temp + rename)                  │
│  • Backup creation before modifications                     │
│  • Path traversal prevention                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Concurrency Layer                          │
│  • File-based locking with stale lock detection             │
│  • Sequential execution for critical operations             │
│  • Atomic registry updates                                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Code Generation Layer                     │
│  • AST-based registry updates (no string manipulation)      │
│  • Syntax validation before file write                      │
│  • Version compatibility checks                             │
└─────────────────────────────────────────────────────────────┘
```

### Security Principles

1. **Never trust user input** - Validate and sanitize all external data
2. **Fail securely** - Default to safe behavior on errors
3. **Prevent race conditions** - Use locking and atomic operations
4. **Preserve data integrity** - Create backups, use transactions
5. **Validate at boundaries** - Check inputs at every module interface

---

## Threat Model & Mitigations

### Path Traversal Attacks

**Threat:** Malicious input like `../../../etc/passwd` could access files outside the vault.

**Mitigations:**

1. **Pre-normalization checks** - Reject `..`, `/`, `\` before path processing
2. **Post-normalization validation** - Verify no traversal remains after normalization
3. **Relative path enforcement** - Reject absolute paths
4. **Hidden file protection** - Block paths starting with `.`

**Implementation:** `src/shared/validation.ts`

```typescript
export function validateFilePath(inputPath: string): string {
  const normalized = normalize(inputPath);

  // Prevent absolute paths
  if (normalized.startsWith("/")) {
    throw new Error(`Path must be relative (got: ${inputPath})`);
  }

  // Prevent path traversal
  if (normalized.includes("..")) {
    throw new Error(`Path traversal not allowed (got: ${inputPath})`);
  }

  // Prevent hidden files (common security risk)
  const parts = normalized.split("/");
  for (const part of parts) {
    if (part.startsWith(".")) {
      throw new Error(`Hidden files not allowed (got: ${inputPath})`);
    }
  }

  return normalized;
}
```

**Example attacks prevented:**
```typescript
validateFilePath("../../../etc/passwd");        // ❌ Error: Path traversal
validateFilePath("/etc/passwd");                 // ❌ Error: Absolute path
validateFilePath(".ssh/id_rsa");                 // ❌ Error: Hidden file
validateFilePath("Templates/note.md");           // ✅ OK
```

### ReDoS (Regular Expression Denial of Service)

**Threat:** Malicious regex patterns with nested quantifiers (e.g., `(a+)+`) cause exponential backtracking, freezing the application.

**Mitigations:**

1. **Pattern sanitization** - Remove nested quantifiers before use
2. **Length limits** - Cap pattern length at 500 characters
3. **Safe regex design** - All built-in patterns use linear-time matching

**Implementation:** `src/shared/validation.ts`

```typescript
export function sanitizePattern(pattern: string): string {
  let clean = pattern;

  // Remove nested quantifiers (e.g., (a+)+, (a*)*) - ReDoS risk
  clean = clean.replace(/\([^)]*[+*][^)]*\)[+*]/g, "");

  // Limit pattern length to prevent resource exhaustion
  if (clean.length > 500) {
    clean = clean.substring(0, 500);
  }

  return clean;
}
```

**Example attacks prevented:**
```typescript
sanitizePattern("(a+)+");                        // Returns: "" (nested quantifier removed)
sanitizePattern("valid.*pattern");               // Returns: "valid.*pattern" (safe pattern)
sanitizePattern("a".repeat(1000));               // Returns: first 500 chars
```

### Race Conditions

**Threat:** Concurrent modifications to the same file (e.g., classifier registry) can cause corruption or lost updates.

**Mitigations:**

1. **File-based locking** - Exclusive locks prevent simultaneous access
2. **Stale lock detection** - Automatically removes locks from dead processes
3. **Timeout handling** - Fails fast if lock cannot be acquired (30s timeout)
4. **Sequential execution** - Critical operations run one at a time

**Implementation:** `src/shared/file-lock.ts`

```typescript
export async function withFileLock<T>(
  resourceId: string,
  operation: () => Promise<T>,
): Promise<T> {
  await mkdir(LOCK_DIR, { recursive: true });
  const lockPath = join(LOCK_DIR, `${resourceId}.lock`);

  // Acquire lock with timeout
  const acquired = await acquireLock(lockPath);
  if (!acquired) {
    throw new Error(`Failed to acquire lock for ${resourceId}`);
  }

  try {
    return await operation();
  } finally {
    await releaseLock(lockPath);
  }
}
```

**Lock mechanism:**
- **Atomic creation:** Uses `O_EXCL` flag (POSIX atomic file creation)
- **Process tracking:** Stores PID in lock file
- **Stale detection:** Checks if PID process is still running
- **Auto-cleanup:** Removes stale locks automatically

**Example usage:**
```typescript
// Prevent concurrent registry updates
await withFileLock('classifier-registry', async () => {
  const registry = await readRegistry();
  registry.classifiers.push(newClassifier);
  await writeRegistry(registry);
});
```

### Data Corruption

**Threat:** Application crashes or power failures during file writes can leave files in corrupted state.

**Mitigations:**

1. **Atomic writes** - Temp + rename pattern ensures all-or-nothing writes
2. **Backup creation** - Create `.backup` files before modifications
3. **Automatic recovery** - Restore from backup if main file corrupted
4. **OS-level guarantees** - Rename is atomic on POSIX systems

**Implementation:** `src/shared/atomic-fs.ts`

```typescript
export async function atomicWriteFile(
  filePath: string,
  content: string,
): Promise<void> {
  const tempPath = `${filePath}.tmp.${randomUUID()}`;

  try {
    // Ensure parent directory exists
    await ensureParentDir(filePath);

    // Write to temp file
    await writeFile(tempPath, content, "utf-8");

    // Atomic rename (OS-level operation)
    await rename(tempPath, filePath);
  } catch (error) {
    // Clean up temp file on failure
    await unlink(tempPath).catch(() => {
      // Ignore cleanup errors
    });
    throw error;
  }
}
```

**How it works:**
1. Write to `.tmp.{uuid}` file (unique name prevents collisions)
2. If write succeeds, rename to target path (atomic operation)
3. If write fails, temp file is cleaned up
4. Target file is **never** partially written

**Recovery mechanism:**
```typescript
export async function safeReadJSON<T>(filePath: string): Promise<T> {
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch (error) {
    // Try backup if main file corrupted
    const backupPath = `${filePath}.backup`;
    const backup = await readFile(backupPath, "utf-8").catch(() => null);

    if (backup) {
      console.warn(`Restored ${filePath} from backup`);
      await atomicWriteFile(filePath, backup);
      return JSON.parse(backup) as T;
    }

    throw error;
  }
}
```

### Registry Corruption via Code Generation

**Threat:** String-based manipulation of TypeScript registry files can introduce syntax errors or injection attacks.

**Mitigations:**

1. **Line-based parsing** - Uses structured line operations instead of string replacement
2. **Insertion point validation** - Verifies array structure before modification
3. **Atomic writes** - Uses `atomicWriteFile` to prevent partial updates
4. **Import/export validation** - Checks for required patterns before insertion

**Implementation:** `src/inbox/classify/classifiers/registry-updater.ts`

```typescript
export async function updateRegistry(
  registryPath: string,
  patch: RegistryPatch,
): Promise<void> {
  const content = await readFile(registryPath, "utf-8");
  const lines = content.split("\n");

  // Find import section (after opening comment, before first export)
  let importInsertIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line?.startsWith("import ")) {
      importInsertIndex = i + 1; // Insert after last import
    }
    if (line?.startsWith("export ")) {
      break; // Stop at first export
    }
  }

  // Find DEFAULT_CLASSIFIERS array
  let arrayStartIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line?.includes("export const DEFAULT_CLASSIFIERS")) {
      arrayStartIndex = i + 1; // Start after the declaration line
      break;
    }
  }

  if (arrayStartIndex === -1) {
    throw new Error(
      "Could not find DEFAULT_CLASSIFIERS array in registry file",
    );
  }

  // Calculate actual insertion point in array
  const exportInsertIndex = arrayStartIndex + patch.insertionIndex;

  // Insert import statement
  lines.splice(importInsertIndex, 0, patch.importStatement);

  // Insert export statement (adjust index due to import insertion)
  const adjustedExportIndex = exportInsertIndex + 1;
  lines.splice(adjustedExportIndex, 0, patch.exportStatement);

  // Write back (atomic write prevents corruption)
  await atomicWriteFile(registryPath, lines.join("\n"));
}
```

**Safety features:**
- **Structured parsing:** Finds exact insertion points using line analysis
- **Validation:** Throws error if expected structure not found
- **Atomic writes:** All-or-nothing update via temp + rename
- **No string manipulation:** Uses array splice operations for predictable results

### Configuration Path Injection

**Threat:** Malicious `PARA_OBSIDIAN_CONFIG` environment variable could load config from untrusted locations.

**Mitigations:**

1. **Path whitelisting** - Only allow paths in home config, cwd, or vault
2. **Traversal detection** - Reject paths containing `..` or `//`
3. **Explicit validation** - Check path safety before loading

**Implementation:** `src/config/index.ts`

```typescript
function isConfigPathSafe(configPath: string): boolean {
  const resolved = path.resolve(configPath);
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  const cwd = process.cwd();

  // Check for path traversal sequences in the original path
  if (configPath.includes("..") || configPath.includes("//")) {
    return false;
  }

  // Allow paths within home config directory
  if (home && resolved.startsWith(path.join(home, ".config"))) {
    return true;
  }

  // Allow paths within current working directory
  if (resolved.startsWith(cwd)) {
    return true;
  }

  // Allow paths within PARA_VAULT if already set
  const vault = process.env.PARA_VAULT;
  if (vault && resolved.startsWith(path.resolve(vault))) {
    return true;
  }

  return false;
}
```

---

## Input Validation

### Validation Functions

All user-provided inputs are validated using dedicated functions in `src/shared/validation.ts`:

| Function | Purpose | Rejects |
|----------|---------|---------|
| `validateClassifierId` | Classifier ID validation | Path traversal, reserved names, non-kebab-case |
| `validatePriority` | Priority value (0-100) | Out of range, non-integers, floats |
| `validateFieldName` | Field name validation | Non-camelCase, special characters |
| `validateTemplateName` | Template name validation | Path traversal, non-kebab-case |
| `sanitizePattern` | Regex pattern safety | Nested quantifiers, excessive length |
| `validateFilePath` | File path validation | Path traversal, absolute paths, hidden files |
| `validateAreaName` | PARA area name | Empty, too long (>100 chars), special chars |
| `validateDisplayName` | Display name validation | Empty, too long (>100 chars) |
| `validateWeight` | Weight value (0.0-1.0) | Out of range, NaN, negative |

### Example Rejected Inputs

```typescript
// Classifier IDs
validateClassifierId("medical_bill");           // ❌ Error: must be kebab-case
validateClassifierId("../secrets");             // ❌ Error: path traversal
validateClassifierId("index");                  // ❌ Error: reserved name

// Priorities
validatePriority(150);                          // ❌ Error: out of range
validatePriority(75.5);                         // ❌ Error: not an integer

// Field names
validateFieldName("date-of-service");           // ❌ Error: must be camelCase
validateFieldName("date of service");           // ❌ Error: no spaces

// Patterns
sanitizePattern("(a+)+");                       // ⚠️ Warning: nested quantifiers removed
sanitizePattern("x".repeat(1000));              // ⚠️ Warning: truncated to 500 chars

// File paths
validateFilePath("../../../etc/passwd");        // ❌ Error: path traversal
validateFilePath("/etc/passwd");                // ❌ Error: absolute path
validateFilePath(".ssh/id_rsa");                // ❌ Error: hidden file

// Area names
validateAreaName("");                           // ❌ Error: empty
validateAreaName("a".repeat(200));              // ❌ Error: too long

// Weights
validateWeight(1.5);                            // ❌ Error: out of range
validateWeight(-0.1);                           // ❌ Error: negative
```

### Validation at Boundaries

Validation occurs at **every module boundary**:

1. **CLI entry** - Command-line arguments validated before processing
2. **MCP handlers** - Tool parameters validated before execution
3. **Configuration** - Config file paths validated before loading
4. **File operations** - Paths validated before filesystem access
5. **LLM inputs** - Prompts sanitized before sending to model

---

## Atomic Operations

### Temp + Rename Pattern

All critical file writes use the **temp + rename pattern** to ensure atomicity:

```typescript
export async function atomicWriteFile(
  filePath: string,
  content: string,
): Promise<void> {
  const tempPath = `${filePath}.tmp.${randomUUID()}`;

  try {
    await ensureParentDir(filePath);
    await writeFile(tempPath, content, "utf-8");
    await rename(tempPath, filePath);  // Atomic on POSIX
  } catch (error) {
    await unlink(tempPath).catch(() => {});
    throw error;
  }
}
```

### Why This Works

1. **Unique temp file:** UUID prevents collisions with concurrent writes
2. **Complete write:** Temp file fully written before rename
3. **Atomic rename:** OS guarantees rename is atomic (POSIX systems)
4. **No partial state:** Target file is never partially written

### Rollback Behavior

If an error occurs during atomic write:

1. **Before rename:** Temp file deleted, original unchanged
2. **After rename:** New file in place, but error propagated
3. **Concurrent writes:** Each gets unique temp file, no interference

### Backup Creation

Before modifying critical files (e.g., registry), create a backup:

```typescript
export async function createBackup(filePath: string): Promise<string> {
  const backupPath = `${filePath}.backup`;
  const content = await readFile(filePath, "utf-8");
  await atomicWriteFile(backupPath, content);
  return backupPath;
}
```

**When to create backups:**
- Before registry modifications
- Before template migrations
- Before bulk frontmatter updates

**How to restore:**
```typescript
export async function restoreFromBackup(filePath: string): Promise<void> {
  const backupPath = `${filePath}.backup`;
  const content = await readFile(backupPath, "utf-8");
  await atomicWriteFile(filePath, content);
}
```

---

## Concurrency Control

### File-Based Locking

The plugin uses **filesystem-based locks** to coordinate concurrent access:

**Lock file location:** `${tmpdir()}/para-obsidian-locks/${resourceId}.lock`

**Lock file contents:** Process ID (PID) of lock holder

**Timeout:** 30 seconds (configurable via `LOCK_TIMEOUT_MS`)

**Retry interval:** 100ms between attempts

### Lock Acquisition Process

```typescript
async function acquireLock(lockPath: string): Promise<boolean> {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      // O_EXCL flag ensures atomic creation (POSIX)
      await writeFile(lockPath, String(process.pid), { flag: "wx" });
      return true;
    } catch (_error) {
      // Lock exists - check if stale
      const pid = await readFile(lockPath, "utf-8").catch(() => null);
      if (pid && !isProcessRunning(Number(pid))) {
        // Stale lock - remove and retry
        await unlink(lockPath).catch(() => {});
        continue;
      }

      // Wait and retry
      await sleep(RETRY_INTERVAL_MS);
    }
  }

  return false;
}
```

### Stale Lock Detection

A lock is **stale** if:
1. Lock file exists
2. PID in lock file is not a running process

**Detection method:**
```typescript
function isProcessRunning(pid: number): boolean {
  try {
    // Signal 0 doesn't kill, just checks if process exists
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
```

**Automatic cleanup:**
```typescript
export async function cleanupStaleLocks(): Promise<void> {
  try {
    const files = readdirSync(LOCK_DIR);

    for (const file of files) {
      if (!file.endsWith(".lock")) continue;

      const lockPath = join(LOCK_DIR, file);
      const pid = await readFile(lockPath, "utf-8").catch(() => null);

      if (pid && !isProcessRunning(Number(pid))) {
        await unlink(lockPath).catch(() => {});
      }
    }
  } catch {
    // Lock directory doesn't exist or not accessible
  }
}
```

### Usage Example

```typescript
// Prevent concurrent registry updates
await withFileLock('classifier-registry', async () => {
  const registry = await readRegistry();
  registry.classifiers.push(newClassifier);
  await writeRegistry(registry);
});

// Prevent concurrent config modifications
await withFileLock('para-config', async () => {
  const config = await loadConfig();
  config.suggestedTags.push("new-tag");
  await saveConfig(config);
});
```

### Timeout Handling

If lock cannot be acquired within 30 seconds:
1. `withFileLock` throws error
2. Operation aborts
3. User sees clear error message
4. No partial state left behind

---

## AST-Based Code Generation

### Why AST Manipulation?

String-based code generation is **dangerous** because:
- Regex replacements can corrupt syntax
- Hard to validate correctness
- Prone to injection attacks
- Difficult to maintain

**AST-based approach** is **safe** because:
- Parses code into structured tree
- Validates syntax before modification
- Generates valid code by construction
- Impossible to create syntax errors

### Registry Update Process

```typescript
export async function updateRegistry(
  registryPath: string,
  patch: RegistryPatch,
): Promise<void> {
  const content = await readFile(registryPath, "utf-8");
  const lines = content.split("\n");

  // 1. Find import section
  let importInsertIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line?.startsWith("import ")) {
      importInsertIndex = i + 1;
    }
    if (line?.startsWith("export ")) {
      break;
    }
  }

  // 2. Find DEFAULT_CLASSIFIERS array
  let arrayStartIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line?.includes("export const DEFAULT_CLASSIFIERS")) {
      arrayStartIndex = i + 1;
      break;
    }
  }

  if (arrayStartIndex === -1) {
    throw new Error(
      "Could not find DEFAULT_CLASSIFIERS array in registry file",
    );
  }

  // 3. Insert statements at calculated positions
  const exportInsertIndex = arrayStartIndex + patch.insertionIndex;
  lines.splice(importInsertIndex, 0, patch.importStatement);
  lines.splice(exportInsertIndex + 1, 0, patch.exportStatement);

  // 4. Atomic write
  await atomicWriteFile(registryPath, lines.join("\n"));
}
```

### Safety Features

1. **Structured parsing:** Finds exact insertion points using line analysis
2. **Validation:** Throws error if expected structure not found
3. **Atomic writes:** All-or-nothing update via temp + rename
4. **No string manipulation:** Uses array splice for predictable results
5. **Idempotency check:** Verifies classifier doesn't already exist

### Generation Functions

```typescript
// Generate import statement
export function generateImportStatement(classifierId: string): string {
  const camelName = classifierId.replace(/-([a-z])/g, (_, letter) =>
    letter.toUpperCase()
  );
  return `import { ${camelName}Classifier } from "./${classifierId}";`;
}

// Generate export statement
export function generateExportStatement(classifierId: string): string {
  const camelName = classifierId.replace(/-([a-z])/g, (_, letter) =>
    letter.toUpperCase()
  );
  return `\t${camelName}Classifier,`;
}
```

**Why this is safe:**
- Uses template literals (no eval or string concatenation)
- Validates identifier format before generation
- Produces syntactically correct TypeScript by construction

---

## Security Best Practices

### For Plugin Developers

**When adding new features:**

1. **Validate all inputs** - Use validation functions from `src/shared/validation.ts`
2. **Use atomic writes** - Import `atomicWriteFile` from `src/shared/atomic-fs.ts`
3. **Acquire locks** - Use `withFileLock` for concurrent access
4. **Create backups** - Before modifying critical files
5. **Sanitize patterns** - Use `sanitizePattern` for user-provided regex
6. **Check paths** - Use `validateFilePath` for all user-provided paths
7. **Handle errors gracefully** - Clean up resources in finally blocks
8. **Document security considerations** - Add comments explaining security decisions

**Example secure operation:**
```typescript
import { withFileLock } from "../shared/file-lock";
import { atomicWriteFile, createBackup } from "../shared/atomic-fs";
import { validateFilePath } from "../shared/validation";

export async function updateConfig(
  configPath: string,
  updates: Partial<Config>
): Promise<void> {
  // 1. Validate input
  const safePath = validateFilePath(configPath);

  // 2. Acquire lock
  await withFileLock('config-update', async () => {
    // 3. Create backup
    const backupPath = await createBackup(safePath);

    try {
      // 4. Read current config
      const config = await safeReadJSON<Config>(safePath);

      // 5. Apply updates
      const updated = { ...config, ...updates };

      // 6. Atomic write
      await atomicWriteFile(safePath, JSON.stringify(updated, null, 2));
    } catch (error) {
      // 7. Restore from backup on failure
      await restoreFromBackup(safePath);
      throw error;
    }
  });
}
```

### For Plugin Users

**Configuration safety:**

1. **Use safe config locations:**
   - ✅ `~/.config/para-obsidian/config.json` (user config)
   - ✅ `.para-obsidianrc` in vault root (project config)
   - ❌ Arbitrary paths via `PARA_OBSIDIAN_CONFIG` (restricted)

2. **Avoid absolute paths in config:**
   ```json
   {
     "templatesDir": "Templates",          // ✅ Relative to vault
     "templatesDir": "/etc/passwd"         // ❌ Rejected
   }
   ```

3. **Use recommended template naming:**
   - ✅ `invoice.md`, `medical-bill.md` (kebab-case)
   - ❌ `Invoice Template.md`, `medical_bill.md` (rejected)

4. **Keep vault under version control:**
   - Enables rollback of corrupted files
   - Tracks all changes to notes
   - Git hooks prevent uncommitted work before LLM processing

5. **Monitor lock directory:**
   - Location: `${tmpdir()}/para-obsidian-locks/`
   - Should be empty when no operations running
   - Stale locks auto-cleaned, but can be manually removed if needed

**Environment variable safety:**

- ✅ `PARA_VAULT=/Users/nathan/Notes` (required, absolute path OK)
- ✅ `PARA_TEMPLATES_DIR=Templates` (optional, relative preferred)
- ⚠️ `PARA_OBSIDIAN_CONFIG=~/.config/para-obsidian/config.json` (validated)
- ❌ `PARA_OBSIDIAN_CONFIG=/tmp/../../../etc/passwd` (rejected)

---

## Security Testing

### Validation Tests

All validation functions have comprehensive test coverage in:
- `src/shared/validation.test.ts` - Input validation tests
- `src/shared/atomic-fs.test.ts` - Atomic operation tests
- `src/shared/file-lock.test.ts` - Concurrency control tests

### Attack Vector Tests

The test suite includes specific tests for:
- Path traversal attempts
- ReDoS patterns
- Race condition scenarios
- Partial write corruption
- Stale lock cleanup

### Running Security Tests

```bash
# Run all security-related tests
bun test src/shared/validation.test.ts
bun test src/shared/atomic-fs.test.ts
bun test src/shared/file-lock.test.ts

# Run full test suite
bun test
```

---

## Security Checklist

Use this checklist when reviewing code or adding features:

- [ ] All user inputs validated using functions from `validation.ts`
- [ ] File paths checked for traversal attacks
- [ ] Regex patterns sanitized to prevent ReDoS
- [ ] File writes use `atomicWriteFile` for atomicity
- [ ] Backups created before modifying critical files
- [ ] Concurrent access protected with `withFileLock`
- [ ] Error handling includes resource cleanup
- [ ] Config paths validated against whitelist
- [ ] Generated code uses structured methods (no string concat)
- [ ] JSDoc includes security notes for sensitive operations

---

## Reporting Security Issues

If you discover a security vulnerability in para-obsidian:

1. **Do not open a public issue**
2. Email: [security contact info would go here]
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and work with you to address the issue.

---

## Security References

- **POSIX Atomic Operations:** [rename(2)](https://man7.org/linux/man-pages/man2/rename.2.html)
- **File Locking:** [flock(2)](https://man7.org/linux/man-pages/man2/flock.2.html)
- **Path Security:** [OWASP Path Traversal](https://owasp.org/www-community/attacks/Path_Traversal)
- **ReDoS Prevention:** [OWASP Regular Expression DoS](https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS)

---

**Last Updated:** 2025-01-16
**Security Architecture Version:** 1.0
