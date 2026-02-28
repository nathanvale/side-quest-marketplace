---
status: deferred
priority: p3
issue_id: "016"
tags: [feature, mermaid, cli, rendering]
dependencies: []
---

# Explore custom Mermaid rendering CLI

## Problem Statement

The `@lepion/mcp-server-mermaid` MCP server works well but adds a Puppeteer dependency and requires MCP server configuration. A lightweight custom CLI tool that connects directly to the Mermaid rendering API (mermaid.ink or local mmdc) would remove the MCP server dependency.

## Proposed Solutions

### Option A: Thin CLI wrapper around mermaid.ink API

Use the mermaid.ink public API to render diagrams server-side. No local Puppeteer needed.

- **Pros:** No heavy dependencies, works anywhere
- **Cons:** Requires internet, rate limits, privacy concerns
- **Effort:** Small

### Option B: Local mmdc (mermaid-cli) wrapper

Wrap the official `@mermaid-js/mermaid-cli` (mmdc) which uses Puppeteer internally but is well-maintained.

- **Pros:** Local rendering, no API dependency
- **Cons:** Still needs Puppeteer, but it's the official tool
- **Effort:** Small

### Option C: Bun-native renderer

Use Bun's built-in capabilities with a lighter headless browser or canvas approach.

- **Pros:** Fast, Bun-native
- **Cons:** More experimental, may not render all diagram types
- **Effort:** Medium

## Recommended Action

Defer until after Stage 0 dogfooding validates the diagram workflow.

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-28 | Created during visualize skill brainstorm | MCP server works for now, explore alternatives later |
