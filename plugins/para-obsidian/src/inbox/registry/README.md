# Registry Module

**Purpose:** Tracking processed items to prevent re-processing

## What Goes Here

- **Idempotency tracking** - Recording processed files
- **File hashing** - SHA256 content-based deduplication
- **Registry persistence** - Loading/saving registry file
- **File locking** - Preventing concurrent access conflicts

## Current Structure

```
registry/
├── index.ts              # Barrel exports
└── processed-registry.ts # Registry implementation
```

## Key Exports

- `createRegistry()` - Create registry manager for a vault
- `hashFile()` - Generate SHA256 hash of file contents
- `RegistryManager` - Interface for registry operations

## Mental Model

**"I want to check if already processed"** → Use registry module

## Features

- **Content-based hashing** - Detects file changes even if renamed
- **Atomic writes** - Crash-safe registry updates
- **File locking** - Multi-process safe with stale lock detection
- **Graceful recovery** - Handles corrupt/missing registry files

## Storage

Registry stored as `.inbox-processed.json` at vault root with:
- Version number for migrations
- Array of processed items (hash, path, timestamp, created note)
