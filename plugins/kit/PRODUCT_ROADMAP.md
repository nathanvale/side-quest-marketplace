# Kit Plugin Product Roadmap

**Purpose**: Excellent context engineering, token optimization, quick searches, code reviews, debugging, blast radius analysis, and bug hunting for Claude Code.

**Last Updated**: 2025-12-04

---

## Executive Summary

The kit plugin wraps the cased-kit CLI to provide token-efficient codebase navigation. Our current implementation covers **8 of 10 CLI commands** with full functionality, but kit offers significantly more capabilities we haven't tapped into.

### Current State

| Category | Status | Coverage |
|----------|--------|----------|
| Index-based queries | Excellent | 4 tools fully working |
| Call graph analysis | Partial | callers works, calls/deps blocked |
| Dead code detection | Good | Heuristic-based |
| Impact analysis | Good | blast radius works |
| Real-time search | Removed | Was 7 tools, now 0 |
| PR/Code review | Not implemented | Kit has full support |
| Commit generation | Not implemented | Kit has AI commits |
| Context assembly | Not implemented | Kit has LLM context tools |

---

## Tier 1: Quick Wins (1-2 days each)

### 1.1 Restore Real-Time Search Tools

**Problem**: We removed `kit_grep`, `kit_semantic`, `kit_ast_search` etc. These are essential for exploratory work without needing to run `prime` first.

**Solution**: Add slash commands that call kit CLI directly:
- `/kit:grep <pattern>` - Fast text search
- `/kit:search <query>` - Semantic natural language search
- `/kit:context <file:line>` - Extract context around a line

**Value**: Immediate exploratory capability without index dependency.

**Kit CLI**:
```bash
kit grep . "pattern" --include "*.ts"
kit search-semantic . "authentication flow" --top-k 10
kit context . src/auth.ts --line 42
```

### 1.2 Add Intelligent Commit Message Generation

**Problem**: Developers write poor commit messages. Kit can generate intelligent messages based on staged changes.

**Solution**: New command `/kit:commit`:
```bash
kit commit --dry-run  # Preview message
kit commit            # Generate and commit
```

**Value**: Better commit hygiene, understands code context.

### 1.3 Add PR Summary Generation

**Problem**: PRs often lack good descriptions. Kit can summarize changes automatically.

**Solution**: New command `/kit:summarize`:
```bash
kit summarize https://github.com/owner/repo/pull/123
kit summarize --update-pr-body <url>  # Auto-update PR
```

**Value**: Faster PR triage, better documentation.

### 1.4 Add File Chunking for LLM Context

**Problem**: Large files exceed LLM context windows. Kit has chunking utilities.

**Solution**: New commands:
- `/kit:chunk-lines <file>` - Split by line count
- `/kit:chunk-symbols <file>` - Split by functions/classes

**Kit CLI**:
```bash
kit chunk-lines . src/large_file.ts --max-lines 100
kit chunk-symbols . src/main.ts --format json
```

**Value**: Process large files without truncation.

---

## Tier 2: High-Value Features (3-5 days each)

### 2.1 Add Code Review Command

**Problem**: Code review is manual and inconsistent. Kit has AI-powered PR review.

**Solution**: New command `/kit:review`:
```bash
# Review GitHub PR
kit review https://github.com/owner/repo/pull/123

# Review local changes (no PR needed!)
kit review main..feature    # Branch diff
kit review HEAD~3..HEAD     # Last 3 commits
kit review --staged         # Staged changes only

# Dry run (preview without posting)
kit review --dry-run --priority=high <url>
```

**Value**: Consistent, thorough code reviews with security/performance focus.

**Integration**: Could pipe to Claude for fixes:
```bash
kit review -p <url> | claude "Fix the high priority issues"
```

### 2.2 Implement Forward Call Graph (calls command)

**Problem**: `calls` command is a stub because kit only supports Python/Terraform.

**Solution**: Build our own TypeScript AST analyzer:
1. Parse file with tree-sitter
2. Find all function calls within target function
3. Resolve to definitions in index

**Value**: Complete call graph - both "who calls me" and "what do I call".

### 2.3 Implement Import/Export Analysis (deps command)

**Problem**: `deps` command is a stub for TypeScript/JavaScript.

**Solution**: Build AST-based import analyzer:
1. Parse imports/exports with tree-sitter
2. Resolve paths to actual files
3. Build dependency graph

**Features**:
- Show all imports for a file
- Show all files that import this file
- Detect circular dependencies

**Value**: Understand module relationships without kit CLI limitation.

### 2.4 Add LLM Context Assembly

**Problem**: Building good context for LLM queries is manual and inconsistent.

**Solution**: New command `/kit:context-assemble`:
```typescript
// Assemble context for a query
kit context-assemble "How does authentication work?" --max-tokens 8000

// Include specific elements
kit context-assemble --files src/auth/* --symbols AuthService --deps
```

**Kit Python API** (we'd wrap this):
```python
assembler = ContextAssembler(repo)
context = assembler.assemble_context(
    query="How does auth work?",
    max_tokens=8000,
    include_symbols=True,
    include_dependencies=True
)
```

**Value**: Optimized context for any LLM query.

---

## Tier 3: Advanced Features (1-2 weeks each)

### 3.1 Circular Dependency Detection

**Problem**: Circular dependencies cause build issues and indicate poor architecture.

**Solution**: New command `/kit:cycles`:
```bash
kit dependencies . --language python --cycles
```

For TypeScript, we'd need our own implementation building on deps analysis.

**Value**: Architecture health monitoring.

### 3.2 Transitive Blast Radius

**Problem**: Current `blast` only shows direct dependencies.

**Solution**: Multi-level traversal:
```
Level 0: Target file/symbol
Level 1: Direct dependents (who imports/calls this)
Level 2: Files that import Level 1 files
Level 3+: Continue until no more deps
```

**Value**: True impact analysis for refactoring.

### 3.3 Code Health Scoring

**Problem**: No quantitative measure of codebase health.

**Solution**: New command `/kit:health`:
- Complexity metrics (symbols per file, file sizes)
- Dead code percentage
- Circular dependency count
- Test coverage gaps (files without .test.ts)

**Value**: Track technical debt over time.

### 3.4 Interactive Dependency Explorer

**Problem**: Hard to visualize complex dependencies.

**Solution**: Generate DOT/GraphML and render:
```bash
kit dependencies . --format dot | dot -Tpng -o deps.png
```

Or integrate with web viewer.

**Value**: Visual understanding of architecture.

---

## Feature Matrix: Kit Capabilities vs Our Implementation

| Kit Feature | Kit CLI | Our CLI | Our MCP | Priority |
|-------------|---------|---------|---------|----------|
| **Index Generation** |
| Generate index | `kit index` | `prime` | `kit_index_prime` | Done |
| **Symbol Search** |
| Find symbols | `kit symbols` | `find` | `kit_index_find` | Done |
| File overview | - | `overview` | `kit_index_overview` | Done |
| Codebase stats | - | `stats` | `kit_index_stats` | Done |
| **Text Search** |
| Grep search | `kit grep` | - | Removed | Tier 1 |
| Semantic search | `kit search-semantic` | - | Removed | Tier 1 |
| **Code Analysis** |
| Symbol usages | `kit usages` | `callers` | `kit_callers` | Done |
| Forward calls | - | `calls` (stub) | `kit_calls` | Tier 2 |
| Dependencies | `kit dependencies` | `deps` (stub) | `kit_deps` | Tier 2 |
| Dead code | - | `dead` | `kit_dead` | Done |
| Blast radius | - | `blast` | `kit_blast` | Done |
| Public API | - | `api` | `kit_api` | Done |
| **LLM Optimization** |
| Chunk by lines | `kit chunk-lines` | - | - | Tier 1 |
| Chunk by symbols | `kit chunk-symbols` | - | - | Tier 1 |
| Context assembly | Python API | - | - | Tier 2 |
| Extract context | `kit context` | - | - | Tier 1 |
| **Git Integration** |
| Commit messages | `kit commit` | - | - | Tier 1 |
| PR summaries | `kit summarize` | - | - | Tier 1 |
| PR reviews | `kit review` | - | - | Tier 2 |
| Git metadata | `kit git-info` | - | - | Low |
| **Advanced** |
| Circular deps | `kit dependencies --cycles` | - | - | Tier 3 |
| Visualizations | `kit dependencies --visualize` | - | - | Tier 3 |
| REST API | `kit serve` | - | - | Low |

---

## Implementation Priority

### Phase 1: Essential Search & Commits (Week 1)
1. `/kit:grep` - Restore text search
2. `/kit:search` - Restore semantic search
3. `/kit:commit` - AI commit messages
4. `/kit:summarize` - PR summaries

### Phase 2: Code Review & Context (Week 2)
5. `/kit:review` - AI code reviews
6. `/kit:chunk` - File chunking
7. `/kit:context` - Line context extraction

### Phase 3: Complete Call Graph (Week 3)
8. Implement `calls` command with AST
9. Implement `deps` command with AST
10. Add circular dependency detection

### Phase 4: Advanced Analysis (Week 4+)
11. Transitive blast radius
12. Code health scoring
13. Visualization tools

---

## Technical Decisions

### CLI Facade Pattern
We chose to wrap kit CLI rather than use Python API because:
- Simpler deployment (no Python env management)
- Clear process boundaries
- JSON output parsing is reliable
- MCP tools stay thin

### What We Build vs What Kit Provides
- **Use Kit CLI**: grep, semantic search, symbols, PR review, commits
- **Build Ourselves**: TypeScript call graph, deps, circular deps (kit only supports Python/Terraform)
- **Enhance**: blast radius (add transitive), dead code (better export detection)

### Token Optimization Strategy
1. **Index-first**: Use PROJECT_INDEX.json for 90% of queries
2. **Chunking**: Split large files into symbol-based chunks
3. **Context assembly**: Build minimal context for LLM queries
4. **JSON output**: Always use `--format json` for machine parsing

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| CLI commands implemented | 8/10 | 10/10 |
| Kit features exposed | ~30% | 80% |
| Average query tokens | ~500 | ~200 (with chunking) |
| Real-time search available | No | Yes |
| Code review integration | No | Yes |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Kit CLI breaking changes | High | Pin version, test on updates |
| TypeScript AST complexity | Medium | Use tree-sitter, incremental build |
| Context window limits | Medium | Chunking, smart context assembly |
| Performance on large repos | Medium | Caching, incremental indexing |

---

## Next Actions

1. **Immediate**: Restore `/kit:grep` and `/kit:search` as slash commands
2. **This week**: Add `/kit:commit` and `/kit:summarize`
3. **Next week**: Implement `/kit:review` for AI code reviews
4. **Ongoing**: Build TypeScript call graph for `calls` and `deps`

---

## References

- [Kit Documentation](https://kit.cased.com)
- [Kit GitHub](https://github.com/cased/kit)
- [Context7 Kit Docs](/cased/kit)
- [REMOVED_TOOLS.md](./REMOVED_TOOLS.md) - What we removed and why
