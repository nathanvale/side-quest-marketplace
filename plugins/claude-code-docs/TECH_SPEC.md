# Technical Specification: Claude Docs Plugin

**Version:** 1.0.0
**Author:** Nathan Vale
**Date:** 2025-11-25
**Status:** Draft

---

## Table of Contents

1. [Overview](#overview)
2. [Goals & Non-Goals](#goals--non-goals)
3. [Architecture](#architecture)
4. [Technical Design](#technical-design)
5. [API Specification](#api-specification)
6. [Data Models](#data-models)
7. [Testing Strategy](#testing-strategy)
8. [Implementation Plan](#implementation-plan)
9. [Security Considerations](#security-considerations)
10. [Performance Requirements](#performance-requirements)
11. [Monitoring & Maintenance](#monitoring--maintenance)
12. [Future Enhancements](#future-enhancements)

---

## Overview

### Purpose

The Claude Docs Plugin is a Side Quest Marketplace plugin that fetches, tracks, and maintains Claude Code documentation from `https://code.claude.com/docs`. It provides automatic updates, change detection, and seamless integration with Claude Code's skills system.

### Problem Statement

Currently, documentation management for Claude Code requires:
- Manual downloads using third-party tools (docpull)
- No automatic updates when docs change
- Verbose, non-clean filenames
- No change tracking or versioning
- No integration with Claude Code workflows

### Solution

A native TypeScript/Bun plugin that:
- Automatically fetches and updates documentation
- Tracks changes via SHA256 manifest
- Generates clean filenames and INDEX
- Integrates via slash commands and hooks
- Provides robust error handling and retry logic

---

## Goals & Non-Goals

### Goals

1. **Automatic Documentation Management**
   - Fetch docs from sitemap.xml
   - Track changes with SHA256 hashes
   - Only update changed files
   - Generate comprehensive INDEX.md

2. **Clean Integration**
   - `/docs` slash command for manual updates
   - PreToolUse hook for automatic checks
   - Output to `~/.claude/skills/anthropic/claude-code/docs/`
   - Clean filenames (e.g., `hooks.md` not `docs_en_hooks.md`)

3. **Robustness**
   - Exponential backoff with jitter
   - Configurable retry logic
   - Markdown validation
   - Comprehensive error handling

4. **Developer Experience**
   - 100% TypeScript with type safety
   - Comprehensive test coverage (>80%)
   - TDD approach
   - Clear documentation

### Non-Goals

1. **Not a generic doc tool** - Specifically for Claude Code docs (phase 1)
2. **Not a web scraper** - Uses sitemap.xml for discovery
3. **Not multi-language** - English only (`/docs/en/`)
4. **Not real-time** - Periodic checks, not live sync

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Claude Code Session                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ invokes
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Plugin Interface                         │
│  ┌──────────────────┐              ┌──────────────────┐    │
│  │  /docs command   │              │  PreToolUse hook │    │
│  └──────────────────┘              └──────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ calls
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              ClaudeDocsFetcher (Core Logic)                  │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Sitemap Parser                                      │    │
│  │ Fetch Manager (retry, rate limit)                  │    │
│  │ Manifest Manager (SHA256 tracking)                 │    │
│  │ Document Processor (validate, save)                │    │
│  │ Index Generator                                     │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ interacts with
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    External Systems                          │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │ code.claude.com  │  │  File System     │               │
│  │ sitemap.xml      │  │  ~/.claude/...   │               │
│  └──────────────────┘  └──────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   ClaudeDocsFetcher                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ SitemapParser                                        │   │
│  │ - parseSitemap(): Promise<string[]>                 │   │
│  │ - filterEnglishUrls(urls: string[]): string[]       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ FetchManager                                         │   │
│  │ - fetchWithRetry(url, opts): Promise<string>        │   │
│  │ - exponentialBackoff(attempt): number               │   │
│  │ - sleep(ms): Promise<void>                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ManifestManager                                      │   │
│  │ - loadManifest(): Promise<Manifest>                 │   │
│  │ - saveManifest(manifest): Promise<void>             │   │
│  │ - needsUpdate(url, content): boolean                │   │
│  │ - updateEntry(entry): void                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ DocumentProcessor                                    │   │
│  │ - isValidMarkdown(content): boolean                 │   │
│  │ - urlToFilename(url): string                        │   │
│  │ - saveDocument(url, content, filename): Promise<>   │   │
│  │ - calculateSha256(content): string                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ IndexGenerator                                       │   │
│  │ - createIndex(files): Promise<void>                 │   │
│  │ - formatTitle(filename): string                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Main Orchestration                                   │   │
│  │ - fetch(): Promise<FetchResult>                     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
claude-docs/
├── .claude-plugin/
│   └── plugin.json                 # Plugin metadata
│
├── commands/
│   └── docs.md                     # /docs slash command
│
├── hooks/
│   └── PreToolUse.sh              # Auto-update hook
│
├── src/
│   ├── lib/
│   │   ├── sitemap-parser.ts      # Sitemap XML parsing
│   │   ├── fetch-manager.ts       # HTTP fetch with retry
│   │   ├── manifest-manager.ts    # Manifest CRUD
│   │   ├── document-processor.ts  # Doc validation & saving
│   │   ├── index-generator.ts     # INDEX.md generation
│   │   └── types.ts               # TypeScript interfaces
│   │
│   ├── fetcher.ts                 # Main ClaudeDocsFetcher class
│   └── cli.ts                     # CLI entry point
│
├── tests/
│   ├── unit/
│   │   ├── sitemap-parser.test.ts
│   │   ├── fetch-manager.test.ts
│   │   ├── manifest-manager.test.ts
│   │   ├── document-processor.test.ts
│   │   └── index-generator.test.ts
│   │
│   ├── integration/
│   │   └── fetcher.test.ts
│   │
│   └── fixtures/
│       ├── sample-sitemap.xml
│       ├── sample-manifest.json
│       └── sample-doc.md
│
├── package.json
├── tsconfig.json
├── bunfig.toml
├── TECH_SPEC.md                   # This file
└── README.md
```

---

## Technical Design

### Core Components

#### 1. SitemapParser

**Responsibility:** Parse sitemap.xml and extract English documentation URLs

**Dependencies:**
- `xml2js` - XML parsing with security features

**Key Methods:**
```typescript
class SitemapParser {
  constructor(private sitemapUrl: string) {}

  async parseSitemap(): Promise<string[]>
  private filterEnglishUrls(urls: string[]): string[]
  private parseXml(xml: string): Promise<SitemapXml>
}
```

**Implementation Details:**
- Uses `xml2js` with `explicitArray: false` for simpler parsing
- Filters URLs matching `/docs/en/` pattern
- Validates XML structure before parsing
- Returns sorted array of URLs

**Error Handling:**
- Invalid XML → throw `SitemapParseError`
- Empty sitemap → throw `EmptySitemapError`
- Network failure → propagated to FetchManager

---

#### 2. FetchManager

**Responsibility:** HTTP fetching with exponential backoff and retry logic

**Dependencies:**
- Native `fetch()` (Bun built-in)

**Key Methods:**
```typescript
class FetchManager {
  constructor(private options: FetchOptions) {}

  async fetchWithRetry(url: string): Promise<string>
  private exponentialBackoff(attempt: number): number
  private sleep(ms: number): Promise<void>
}

interface FetchOptions {
  maxRetries: number;      // Default: 3
  baseDelay: number;       // Default: 1000ms
  maxDelay: number;        // Default: 10000ms
  rateLimit: number;       // Default: 200ms between requests
}
```

**Retry Logic:**
```typescript
// Exponential backoff with jitter
delay = min(baseDelay * 2^attempt + random(0, 1000), maxDelay)

// Example progression (baseDelay=1000):
// Attempt 0: 1000-2000ms
// Attempt 1: 2000-3000ms
// Attempt 2: 4000-5000ms
```

**Error Handling:**
- HTTP 4xx → don't retry, throw immediately
- HTTP 5xx → retry with backoff
- Network timeout → retry with backoff
- Max retries exceeded → throw `FetchFailedError`

---

#### 3. ManifestManager

**Responsibility:** Manage manifest.json for change tracking

**Dependencies:**
- `node:fs/promises` - File I/O
- `node:crypto` - SHA256 hashing

**Key Methods:**
```typescript
class ManifestManager {
  constructor(private manifestPath: string) {}

  async loadManifest(): Promise<Manifest>
  async saveManifest(manifest: Manifest): Promise<void>
  needsUpdate(url: string, content: string, manifest: Manifest): boolean
  updateEntry(manifest: Manifest, entry: ManifestEntry): void
  private calculateSha256(content: string): string
}
```

**Change Detection Logic:**
```typescript
needsUpdate(url, content, manifest) {
  const existing = manifest.files.find(f => f.url === url);
  if (!existing) return true;  // New file

  const newHash = calculateSha256(content);
  return existing.sha256 !== newHash;  // Content changed
}
```

**Manifest Schema:**
```typescript
interface Manifest {
  metadata: {
    base_url: string;
    last_updated: string;    // ISO 8601
    version: string;
  };
  files: ManifestEntry[];
}

interface ManifestEntry {
  url: string;
  filename: string;
  sha256: string;
  fetched_at: string;        // ISO 8601
}
```

---

#### 4. DocumentProcessor

**Responsibility:** Validate, process, and save documentation files

**Dependencies:**
- `node:fs/promises` - File I/O
- `node:path` - Path manipulation

**Key Methods:**
```typescript
class DocumentProcessor {
  constructor(private outputDir: string) {}

  isValidMarkdown(content: string): boolean
  urlToFilename(url: string): string
  async saveDocument(url: string, content: string, filename: string): Promise<void>
}
```

**URL to Filename Conversion:**
```typescript
// Input:  https://code.claude.com/docs/en/hooks
// Output: hooks.md

// Input:  https://code.claude.com/docs/en/sdk/migration-guide
// Output: sdk_migration-guide.md

urlToFilename(url: string): string {
  const match = url.match(/\/docs\/en\/(.+)/);
  if (!match) return "unknown.md";

  const path = match[1]
    .replace(/\/$/, "")           // Remove trailing slash
    .replace(/\//g, "_");         // Convert slashes to underscores

  return `${path}.md`;
}
```

**Markdown Validation:**
```typescript
isValidMarkdown(content: string): boolean {
  // Check for markdown indicators
  const indicators = [
    content.includes("# "),       // Headers
    content.includes("## "),
    content.includes("```"),      // Code blocks
    content.includes("- "),       // Lists
    content.includes("* "),
    content.includes("["),        // Links
  ];

  // Should have at least 2 markdown indicators
  const count = indicators.filter(x => x).length;
  return count >= 2 && content.length > 100;
}
```

---

#### 5. IndexGenerator

**Responsibility:** Generate INDEX.md with sorted documentation links

**Key Methods:**
```typescript
class IndexGenerator {
  constructor(private outputDir: string) {}

  async createIndex(files: ManifestEntry[]): Promise<void>
  private formatTitle(filename: string): string
}
```

**INDEX.md Format:**
```markdown
# Claude Code Documentation Index

This directory contains English documentation for Claude Code pulled from https://code.claude.com/docs/en

## Documentation Files

- [Analytics](analytics.md)
- [Common Workflows](common-workflows.md)
- [Hooks Guide](hooks-guide.md)
- [Hooks](hooks.md)
...
```

**Title Formatting:**
```typescript
formatTitle(filename: string): string {
  // hooks.md → Hooks
  // sdk_migration-guide.md → Sdk Migration Guide

  return filename
    .replace(/\.md$/, "")
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
```

---

#### 6. ClaudeDocsFetcher (Main Orchestrator)

**Responsibility:** Coordinate all components to fetch and update documentation

**Key Methods:**
```typescript
class ClaudeDocsFetcher {
  constructor(
    private outputDir: string,
    private options: FetcherOptions
  ) {}

  async fetch(): Promise<FetchResult>
}

interface FetcherOptions {
  sitemapUrl?: string;
  fetchOptions?: FetchOptions;
  skipValidation?: boolean;
}

interface FetchResult {
  fetched: number;
  skipped: number;
  failed: number;
  total: number;
  duration: number;
  errors: Array<{url: string, error: string}>;
}
```

**Fetch Workflow:**
```
1. Load manifest (if exists)
2. Parse sitemap → get URLs
3. For each URL:
   a. Fetch content with retry
   b. Validate markdown
   c. Check if update needed
   d. Save if changed
   e. Update manifest entry
4. Save manifest
5. Generate INDEX.md
6. Return result summary
```

---

## API Specification

### CLI Interface

```bash
# Fetch/update documentation
bun run src/cli.ts [outputDir]

# With custom output directory
bun run src/cli.ts ~/.claude/skills/anthropic/claude-code/docs/

# Via package.json script
bun run fetch
```

### Programmatic API

```typescript
import { ClaudeDocsFetcher } from './src/fetcher';

const fetcher = new ClaudeDocsFetcher(outputDir, {
  sitemapUrl: 'https://code.claude.com/sitemap.xml',
  fetchOptions: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    rateLimit: 200,
  },
  skipValidation: false,
});

const result = await fetcher.fetch();
console.log(`Fetched: ${result.fetched}, Skipped: ${result.skipped}, Failed: ${result.failed}`);
```

### Slash Command

**Command:** `/docs [force]`

**Description:** Fetch or update Claude Code documentation

**Usage:**
```bash
/docs           # Update only changed files
/docs force     # Force re-fetch all files
```

**Implementation:**
```markdown
<!-- commands/docs.md -->
Run the documentation fetcher script:

bun run /Users/nathanvale/code/side-quest-marketplace/plugins/claude-docs/src/cli.ts {{args}}
```

### Hook

**Hook:** `PreToolUse`

**Trigger:** Before any tool execution

**Behavior:**
- Check if last update was >24 hours ago
- If yes, run background update
- Don't block tool execution

**Implementation:**
```bash
#!/bin/bash
# hooks/PreToolUse.sh

MANIFEST="$HOME/.claude/skills/anthropic/claude-code/docs/manifest.json"
THRESHOLD=86400  # 24 hours in seconds

if [ -f "$MANIFEST" ]; then
  LAST_UPDATE=$(jq -r '.metadata.last_updated' "$MANIFEST")
  LAST_EPOCH=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${LAST_UPDATE:0:19}" "+%s" 2>/dev/null || echo 0)
  NOW=$(date +%s)
  DIFF=$((NOW - LAST_EPOCH))

  if [ $DIFF -gt $THRESHOLD ]; then
    echo "📚 Updating Claude Code docs (last update: $((DIFF / 3600)) hours ago)..."
    bun run /Users/nathanvale/code/side-quest-marketplace/plugins/claude-docs/src/cli.ts &
  fi
fi
```

---

## Data Models

### TypeScript Interfaces

```typescript
// src/lib/types.ts

export interface Manifest {
  metadata: ManifestMetadata;
  files: ManifestEntry[];
}

export interface ManifestMetadata {
  base_url: string;
  last_updated: string;  // ISO 8601
  version: string;
}

export interface ManifestEntry {
  url: string;
  filename: string;
  sha256: string;
  fetched_at: string;    // ISO 8601
}

export interface FetchOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  rateLimit: number;
}

export interface FetcherOptions {
  sitemapUrl?: string;
  fetchOptions?: FetchOptions;
  skipValidation?: boolean;
}

export interface FetchResult {
  fetched: number;
  skipped: number;
  failed: number;
  total: number;
  duration: number;
  errors: FetchError[];
}

export interface FetchError {
  url: string;
  error: string;
}

export interface SitemapXml {
  urlset: {
    url: Array<{ loc: string }>;
  };
}
```

### File System Schema

```
~/.claude/skills/anthropic/claude-code/docs/
├── manifest.json              # Tracking metadata
├── INDEX.md                   # Generated index
├── hooks.md                   # Clean filenames
├── hooks-guide.md
├── quickstart.md
├── sdk_migration-guide.md     # Nested paths use underscore
└── ...
```

---

## Testing Strategy

### Unit Tests

**Coverage Target:** >80% for all modules

**Test Files:**
- `tests/unit/sitemap-parser.test.ts`
- `tests/unit/fetch-manager.test.ts`
- `tests/unit/manifest-manager.test.ts`
- `tests/unit/document-processor.test.ts`
- `tests/unit/index-generator.test.ts`

**Example Test Structure:**
```typescript
// tests/unit/document-processor.test.ts
import { describe, test, expect } from "bun:test";
import { DocumentProcessor } from "../../src/lib/document-processor";

describe("DocumentProcessor", () => {
  describe("urlToFilename", () => {
    test("converts simple URL to filename", () => {
      const processor = new DocumentProcessor("/tmp");
      expect(processor.urlToFilename("https://code.claude.com/docs/en/hooks"))
        .toBe("hooks.md");
    });

    test("converts nested URL with underscores", () => {
      const processor = new DocumentProcessor("/tmp");
      expect(processor.urlToFilename("https://code.claude.com/docs/en/sdk/migration-guide"))
        .toBe("sdk_migration-guide.md");
    });

    test("handles trailing slashes", () => {
      const processor = new DocumentProcessor("/tmp");
      expect(processor.urlToFilename("https://code.claude.com/docs/en/hooks/"))
        .toBe("hooks.md");
    });
  });

  describe("isValidMarkdown", () => {
    test("returns true for valid markdown", () => {
      const processor = new DocumentProcessor("/tmp");
      const content = "# Title\n\nSome content with [links](url) and:\n\n```js\ncode\n```";
      expect(processor.isValidMarkdown(content)).toBe(true);
    });

    test("returns false for HTML content", () => {
      const processor = new DocumentProcessor("/tmp");
      const content = "<html><body>Not markdown</body></html>";
      expect(processor.isValidMarkdown(content)).toBe(false);
    });

    test("returns false for short content", () => {
      const processor = new DocumentProcessor("/tmp");
      expect(processor.isValidMarkdown("# Hi")).toBe(false);
    });
  });
});
```

### Integration Tests

**Test File:** `tests/integration/fetcher.test.ts`

**Test Scenarios:**
1. Full fetch workflow with mocked HTTP
2. Update detection with existing manifest
3. Error handling and retries
4. INDEX.md generation

**Example:**
```typescript
// tests/integration/fetcher.test.ts
import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { ClaudeDocsFetcher } from "../../src/fetcher";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";

describe("ClaudeDocsFetcher Integration", () => {
  const testDir = "/tmp/claude-docs-test";

  beforeEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test("fetches and saves documentation", async () => {
    // Mock fetch to return test data
    const originalFetch = global.fetch;
    global.fetch = mock((url) => {
      if (url.includes("sitemap.xml")) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(sampleSitemap),
        });
      }
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(sampleMarkdown),
      });
    });

    const fetcher = new ClaudeDocsFetcher(testDir);
    const result = await fetcher.fetch();

    expect(result.fetched).toBeGreaterThan(0);
    expect(result.failed).toBe(0);

    // Verify files were created
    const manifest = JSON.parse(
      await readFile(join(testDir, "manifest.json"), "utf-8")
    );
    expect(manifest.files.length).toBeGreaterThan(0);

    // Verify INDEX was created
    const index = await readFile(join(testDir, "INDEX.md"), "utf-8");
    expect(index).toContain("# Claude Code Documentation Index");

    global.fetch = originalFetch;
  });

  test("skips unchanged files on second run", async () => {
    // First run
    const fetcher1 = new ClaudeDocsFetcher(testDir);
    const result1 = await fetcher1.fetch();

    // Second run (no changes)
    const fetcher2 = new ClaudeDocsFetcher(testDir);
    const result2 = await fetcher2.fetch();

    expect(result2.skipped).toBe(result1.fetched);
    expect(result2.fetched).toBe(0);
  });
});
```

### Fixtures

**Location:** `tests/fixtures/`

**Files:**
- `sample-sitemap.xml` - Minimal sitemap for testing
- `sample-manifest.json` - Example manifest
- `sample-doc.md` - Valid markdown document
- `sample-html.html` - Invalid HTML (should be rejected)

---

## Implementation Plan

### Phase 1: Project Setup (Day 1)

**Tasks:**
1. ✅ Create directory structure
2. Initialize package.json with dependencies
3. Configure TypeScript (tsconfig.json)
4. Configure Bun test (bunfig.toml)
5. Set up test fixtures

**Dependencies to Install:**
```json
{
  "dependencies": {
    "xml2js": "^0.6.2"
  },
  "devDependencies": {
    "@types/xml2js": "^0.4.14",
    "bun-types": "latest"
  }
}
```

### Phase 2: Core Utilities (Day 1-2)

**Test-Driven Order:**
1. DocumentProcessor (SHA256, validation, filename conversion)
2. IndexGenerator (title formatting, INDEX generation)
3. ManifestManager (load, save, change detection)

**Acceptance Criteria:**
- All unit tests pass
- >80% code coverage
- Type-safe interfaces

### Phase 3: Network Layer (Day 2-3)

**Test-Driven Order:**
1. FetchManager (retry logic, backoff, rate limiting)
2. SitemapParser (XML parsing, URL filtering)

**Acceptance Criteria:**
- Retry logic tested with mock failures
- XML parsing handles malformed input
- Rate limiting verified

### Phase 4: Integration (Day 3-4)

**Tasks:**
1. Implement ClaudeDocsFetcher orchestrator
2. Write integration tests
3. CLI entry point (src/cli.ts)

**Acceptance Criteria:**
- Full workflow tested end-to-end
- Error handling verified
- Performance benchmarked (<5 min for full fetch)

### Phase 5: Plugin Integration (Day 4-5)

**Tasks:**
1. Create /docs slash command
2. Create PreToolUse hook
3. Write plugin.json manifest
4. Update README with usage instructions

**Acceptance Criteria:**
- Slash command works in Claude Code
- Hook triggers automatically
- Plugin installs cleanly

### Phase 6: Testing & Documentation (Day 5)

**Tasks:**
1. End-to-end testing in real Claude Code session
2. Update TECH_SPEC.md with final details
3. Write comprehensive README
4. Add inline code documentation

**Acceptance Criteria:**
- Manual testing checklist completed
- All documentation up-to-date
- No known bugs

---

## Security Considerations

### XML Parsing Security

**Threat:** XML External Entity (XXE) attacks

**Mitigation:**
```typescript
// Use xml2js with secure defaults
const parser = new xml2js.Parser({
  explicitArray: false,
  // Note: xml2js doesn't support entities by default in Node.js
  // Bun's XML parsing is safe by default
});
```

### Path Traversal

**Threat:** Malicious URLs could create files outside output directory

**Mitigation:**
```typescript
import { resolve, relative } from "node:path";

async saveDocument(url: string, content: string, filename: string) {
  const fullPath = resolve(this.outputDir, filename);

  // Ensure path is within output directory
  const rel = relative(this.outputDir, fullPath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Invalid filename: path traversal detected");
  }

  // Safe to write
  await writeFile(fullPath, content, "utf-8");
}
```

### Rate Limiting

**Threat:** Overwhelming target server with requests

**Mitigation:**
```typescript
// Configurable rate limit (default: 200ms between requests)
async fetch() {
  for (const url of urls) {
    await this.fetchWithRetry(url);
    await this.sleep(this.options.rateLimit);  // Rate limit
  }
}
```

### Dependency Security

**Policy:**
- Pin dependency versions in package.json
- Run `bun audit` regularly
- Keep dependencies minimal

---

## Performance Requirements

### Target Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Full fetch time | <5 minutes | ~50 docs @ 200ms/doc + network |
| Memory usage | <100MB | During full fetch |
| Manifest load/save | <100ms | File I/O on SSD |
| Change detection | <1ms/file | SHA256 comparison |
| Startup time | <500ms | Cold start of CLI |

### Optimization Strategies

1. **Parallel Fetching (Future Enhancement)**
   - Currently sequential for rate limiting
   - Could parallelize with semaphore (max 5 concurrent)

2. **Incremental Updates**
   - Only fetch changed files (via SHA256)
   - Typical update: <30 seconds (5-10 changed docs)

3. **Efficient Hashing**
   - Use streaming SHA256 for large files
   - Cache hashes in manifest

4. **Minimal Dependencies**
   - xml2js only external dependency
   - Leverage Bun's fast native modules

---

## Monitoring & Maintenance

### Logging

**Log Levels:**
- `INFO`: Normal operations (fetched, skipped, completed)
- `WARN`: Recoverable errors (retry, validation failed)
- `ERROR`: Fatal errors (manifest corruption, network failure)

**Log Format:**
```
[2025-11-25T10:30:45.123Z] INFO: Fetching https://code.claude.com/docs/en/hooks
[2025-11-25T10:30:45.456Z] INFO: ✓ Saved hooks.md
[2025-11-25T10:30:45.789Z] WARN: Retry after 2000ms...
[2025-11-25T10:30:50.000Z] ERROR: Failed to fetch after 3 attempts
```

### Metrics

**FetchResult Summary:**
```typescript
{
  fetched: 5,      // New or updated files
  skipped: 40,     // Unchanged files
  failed: 2,       // Failures after retries
  total: 47,       // Total URLs processed
  duration: 45123, // Milliseconds
  errors: [
    { url: "https://...", error: "Network timeout" }
  ]
}
```

### Maintenance Tasks

**Weekly:**
- Review failed URLs in logs
- Check for new docs not in sitemap

**Monthly:**
- Audit dependency versions
- Review performance metrics
- Update documentation

**Quarterly:**
- Security audit
- Consider feature requests
- Refactor if needed

---

## Future Enhancements

### Phase 2: Generic Doc Tool (Post-MVP)

**Goal:** Extend to support multiple documentation sites

**Design:**
```typescript
interface DocSource {
  name: string;
  sitemapUrl: string;
  urlPattern: RegExp;
  outputDir: string;
}

const sources: DocSource[] = [
  {
    name: "claude-code",
    sitemapUrl: "https://code.claude.com/sitemap.xml",
    urlPattern: /\/docs\/en\//,
    outputDir: "~/.claude/skills/anthropic/claude-code/docs/",
  },
  {
    name: "stripe",
    sitemapUrl: "https://stripe.com/sitemap.xml",
    urlPattern: /\/docs\//,
    outputDir: "~/.claude/skills/stripe/docs/",
  },
];
```

### Phase 3: Advanced Features

**Potential Enhancements:**
1. **Parallel Fetching** - Semaphore-based concurrency
2. **Incremental Builds** - Git-style diff tracking
3. **Search Index** - Full-text search capability
4. **Version History** - Track doc changes over time
5. **Custom Transformers** - Post-processing plugins
6. **Web UI** - Dashboard for monitoring updates

---

## Appendix

### Reference Implementations

**ericbuess/claude-code-docs:**
- Python-based
- Excellent manifest tracking
- Robust error handling
- Inspiration for this design

**docpull:**
- Generic web scraping tool
- Limited change tracking
- Verbose output
- Not suitable for long-term maintenance

### Glossary

- **Manifest**: JSON file tracking fetched docs with SHA256 hashes
- **Sitemap**: XML file listing all URLs on a website
- **Exponential Backoff**: Retry strategy with increasing delays
- **Jitter**: Random delay added to prevent thundering herd
- **SHA256**: Cryptographic hash function for change detection
- **TDD**: Test-Driven Development methodology

### Related Documentation

- Claude Code Plugin Guide: `.claude/skills/anthropic/claude-code/docs/plugins.md`
- Bun Documentation: https://bun.sh/docs
- xml2js Documentation: https://github.com/Leonidas-from-XIV/node-xml2js

---

**Document Status:** Draft - Ready for Review
**Next Steps:** Review with team, implement Phase 1
**Questions/Feedback:** Contact Nathan Vale (hi@nathanvale.com)
