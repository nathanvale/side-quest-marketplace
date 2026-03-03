---
created: 2026-03-03
title: MCP Best Practices -- Tool Descriptions, Token Optimization, and Prompt Engineering
type: research
tags: [mcp, tool-descriptions, prompt-engineering, token-optimization, annotations, error-handling]
project: dx-tsc-runner
status: complete
---

# MCP Best Practices -- Tool Descriptions, Token Optimization, and Prompt Engineering

Research into how MCP servers should describe tools, format responses, and handle errors for optimal LLM routing and token efficiency. Synthesized from newsroom investigation (Reddit, X, web), Firecrawl best-practices researcher, and Claude Code hooks documentation.

## Tool Descriptions Are Routing Signals

The single most important finding: Claude picks tools based on descriptions, not names. The "new hire" heuristic applies -- if a new engineer couldn't figure out when to use a tool from its description alone, the description is inadequate.

**Best practices for tool descriptions:**
- Start with WHAT the tool does, then WHEN to use it
- Include the input/output contract in the description
- Mention what the tool does NOT do (prevents misrouting)
- Keep under 200 tokens -- Claude's context budget for tool selection is limited

**Example (tsc_check):**

```
BAD:  "Run TypeScript type checker"
GOOD: "Check TypeScript files for type errors. Returns structured JSON with file:line:col locations and error messages. Use after editing .ts/.tsx files to verify type safety. Does NOT fix errors -- only reports them."
```

Community signal: Multiple Reddit threads and X posts confirm that tool description quality is the #1 factor in reliable tool routing. Names are cosmetic.

## Token Optimization

### Response Format

Always support `response_format: "json"` for machine-to-machine calls. JSON responses are:
- 40-60% fewer tokens than markdown equivalents
- Parseable without LLM interpretation
- Composable with other tools

**Pattern:** Offer both formats, default to JSON:

```typescript
if (responseFormat === 'json') {
  return JSON.stringify({ errors, errorCount, passed: errors.length === 0 })
} else {
  return formatAsMarkdown(errors) // Human-readable fallback
}
```

### Avoid Pretty-Printing JSON

`JSON.stringify(data, null, 2)` adds ~30% token overhead from whitespace. For MCP responses consumed by Claude, use compact JSON: `JSON.stringify(data)`.

### Structured Error Fields

Include machine-parseable fields, not just human-readable messages:

```json
{
  "file": "src/index.ts",
  "line": 42,
  "col": 7,
  "code": "TS2345",
  "message": "Argument of type 'string' is not assignable to parameter of type 'number'"
}
```

The `code` field (e.g., `TS2345`) enables Claude to look up the error type and apply targeted fixes.

## Tool Annotations (MCP Protocol)

MCP supports tool annotations that help Claude understand tool behavior without trial and error:

| Annotation | Type | Purpose |
|-----------|------|---------|
| `readOnlyHint` | boolean | Tool does not modify state |
| `destructiveHint` | boolean | Tool modifies or deletes data |
| `idempotentHint` | boolean | Safe to call multiple times |
| `openWorldHint` | boolean | Interacts with external systems |

**For tsc_check:** `readOnlyHint: true`, `idempotentHint: true` -- it reads files and reports errors, never modifies anything.

## Two-Tier Error System

MCP distinguishes between tool errors and protocol errors:

1. **Tool errors** (expected failures): Return in the result with `isError: true`. Example: "No tsconfig.json found in /path"
2. **Protocol errors** (infrastructure failures): Throw at the transport level. Example: tsc binary not found, spawn failure

The distinction matters because Claude handles them differently:
- Tool errors: Claude reads the error content and adjusts its approach
- Protocol errors: Claude retries or reports the failure to the user

## Community Signal (Reddit/X)

### Reddit consensus (r/ClaudeAI, r/mcp, r/LocalLLaMA)
- Tool descriptions >> tool names for routing
- JSON responses save significant context window
- The MCP ecosystem is early -- conventions are still forming
- Most complaints are about tools with vague descriptions causing misrouting

### X signal
- Anthropic team members actively recommend structured JSON responses
- `response_format` parameter pattern gaining adoption across MCP servers
- Tool annotations are underused -- most servers don't set them yet

## Implications for dx-tsc-runner

| Finding | Action | Scope |
|---------|--------|-------|
| Tool description quality | Improve `tsc_check` description for LLM routing | npm package (issue #28) |
| JSON response format | Already supported via `response_format` param | No change needed |
| Pretty-print removal | Remove `JSON.stringify(data, null, 2)` | npm package (issue #30) |
| Error codes in output | Add `code` field to structured errors | npm package (issue #31) |
| Tool annotations | Add `readOnlyHint`, `idempotentHint` | npm package (future) |
| Em dash in output | Replace with double hyphen | npm package (issue #29) |

## Sources

- [MCP Tool Annotations spec](https://spec.modelcontextprotocol.io/specification/2025-03-26/server/tools/#annotations)
- [Claude Code hooks reference](https://code.claude.com/docs/en/hooks)
- [Anthropic MCP documentation](https://docs.anthropic.com/en/docs/agents-and-tools/mcp)
- Reddit: r/ClaudeAI, r/mcp, r/LocalLLaMA threads on tool description best practices
- X: @anthropaborations, @alexalbert__ on MCP response format patterns
- Firecrawl best-practices researcher findings
- Newsroom investigation: Reddit, X, and web (March 2026)
