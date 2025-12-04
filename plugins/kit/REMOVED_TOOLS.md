# Removed Tools from Kit MCP Server

**Date**: 2025-12-04  
**Commit**: (to be added)

## Context

The Kit MCP server was refactored to use ONLY the CLI facade tools (`kit-index` CLI). All old tools that called the Kit CLI directly were removed to simplify the architecture.

## Removed Tools (7 total)

These tools were removed from `/Users/nathanvale/code/side-quest-marketplace/plugins/kit/mcp-servers/kit/index.ts`:

1. **kit_grep** - Fast text search across repository files
   - Direct Kit CLI wrapper for `kit grep`
   - ~130 lines

2. **kit_semantic** - Semantic search using natural language queries
   - Direct Kit CLI wrapper for `kit search-semantic`
   - ~125 lines

3. **kit_symbols** - Extract code symbols (functions, classes, etc.)
   - Direct Kit CLI wrapper for `kit extract-symbols`
   - ~125 lines

4. **kit_file_tree** - Get repository file tree structure
   - Direct Kit CLI wrapper for `kit file-tree`
   - ~105 lines

5. **kit_file_content** - Get content of multiple files
   - Direct Kit CLI wrapper for `kit file-content`
   - ~110 lines

6. **kit_usages** - Find where symbols are defined (AST-powered)
   - Direct Kit CLI wrapper for `kit usages`
   - ~120 lines

7. **kit_ast_search** - Search code using AST patterns (tree-sitter)
   - Direct Kit CLI wrapper for `kit ast-search`
   - ~135 lines

## Kept Tools (4 total)

These tools remain and use the `kit-index` CLI facade:

1. **kit_index_find** - Find symbol definitions from PROJECT_INDEX.json
2. **kit_index_stats** - Get codebase statistics from PROJECT_INDEX.json
3. **kit_index_overview** - Get all symbols in a file from PROJECT_INDEX.json
4. **kit_index_prime** - Generate or refresh PROJECT_INDEX.json

## Impact

- **Lines reduced**: 1253 → 358 (71% reduction)
- **Imports removed**: All validators, formatters, and execute functions for the old tools
- **Architecture**: Now exclusively uses CLI facade pattern

## Future Considerations

The removed tools should be re-assessed for whether they should:
1. Be re-implemented through the `kit-index` CLI facade
2. Remain deprecated in favor of PROJECT_INDEX.json-based workflows
3. Be exposed via different slash commands or skills

## Related Code

The underlying implementation still exists in:
- `/Users/nathanvale/code/side-quest-marketplace/plugins/kit/src/kit-wrapper.ts` - Pure CLI wrappers
- `/Users/nathanvale/code/side-quest-marketplace/plugins/kit/src/validators.ts` - Input validation
- `/Users/nathanvale/code/side-quest-marketplace/plugins/kit/src/formatters.ts` - Output formatting

These can be reused if the tools are brought back.
