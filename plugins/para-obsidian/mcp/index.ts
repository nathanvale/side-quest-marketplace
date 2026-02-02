#!/usr/bin/env bun

/**
 * Para-Obsidian MCP Server
 *
 * Provides 25 MCP tools for PARA-style Obsidian vault management with
 * frontmatter validation, template versioning, and git auto-commit.
 *
 * Tools are organized into modules:
 * - config.ts: Configuration and template tools
 * - files.ts: File operations (list, read, create, insert, rename, delete)
 * - search.ts: Text and semantic search tools
 * - indexer.ts: Index management and PARA list tools
 * - frontmatter.ts: Frontmatter extraction, validation, and migration
 * - links.ts: Link rewriting tools
 *
 * Pattern: Each tool follows the 6-step handler pattern from Kit reference:
 * 1. Create correlation ID (cid)
 * 2. Log request start
 * 3. Execute operation
 * 4. Format output (markdown/json)
 * 5. Log response
 * 6. Return MCP response with isError flag
 */

if (!process.env.MCPEZ_AUTO_START) {
	process.env.MCPEZ_AUTO_START = "false";
}

import { startServer } from "@side-quest/core/mcp";
import { initMcpLogger } from "./utils";

// Import tool modules (side-effect: registers tools)
import "../src/mcp-handlers/config";
import "../src/mcp-handlers/files";
import "../src/mcp-handlers/search";
import "../src/mcp-handlers/indexer";
import "../src/mcp-handlers/frontmatter";
import "../src/mcp-handlers/links";
import "../src/mcp-handlers/export";
import "../src/mcp-handlers/git";
import "../src/mcp-handlers/stakeholders";

// Initialize logger
initMcpLogger().catch(console.error);

// ============================================================================
// Start Server
// ============================================================================

if (import.meta.main) {
	// File logging handled by initMcpLogger() above, which initializes
	// the plugin's logger writing to ~/.claude/logs/para-obsidian.jsonl
	startServer("para-obsidian", {
		version: "0.1.0",
	});
}
