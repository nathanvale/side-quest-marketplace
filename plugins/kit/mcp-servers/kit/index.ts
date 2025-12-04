#!/usr/bin/env bun

/**
 * Kit MCP Server
 *
 * Provides PROJECT_INDEX.json-based tools for token-efficient codebase navigation
 * using the Kit CLI (cased-kit).
 */

import { startServer, tool, z } from "mcpez";

import {
	createCorrelationId,
	executeIndexFind,
	executeIndexOverview,
	executeIndexPrime,
	executeIndexStats,
	formatIndexFindResults,
	formatIndexOverviewResults,
	formatIndexPrimeResults,
	formatIndexStatsResults,
	getKitLogger,
	initLogger,
	ResponseFormat,
} from "../../src/index.js";

// Initialize logging
initLogger().catch(console.error);

/** MCP layer logger for request/response tracking */
const mcpLogger = getKitLogger();

// ============================================================================
// Kit Index Find Tool
// ============================================================================

tool(
	"kit_index_find",
	{
		description: `Find symbol definitions from PROJECT_INDEX.json (token-efficient).

Searches the pre-built index instead of scanning files. Great for:
- Finding where a function/class/type is defined
- Quick symbol lookup without reading source files
- Understanding code structure with minimal tokens

Falls back to fuzzy matching if no exact match found.

NOTE: Requires PROJECT_INDEX.json. Run kit_index_prime first if not present.`,
		inputSchema: {
			symbol_name: z
				.string()
				.describe('Symbol name to search for. Example: "executeKitGrep"'),
			index_path: z
				.string()
				.optional()
				.describe(
					"Path to PROJECT_INDEX.json or directory containing it (default: walks up to find it)",
				),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	async (args: {
		symbol_name: string;
		index_path?: string;
		response_format?: string;
	}) => {
		const mcpCid = createCorrelationId();
		const mcpStartTime = Date.now();
		mcpLogger.info("MCP tool request", {
			cid: mcpCid,
			tool: "kit_index_find",
			args: { symbol_name: args.symbol_name },
		});

		// Execute index find
		const result = await executeIndexFind(args.symbol_name, args.index_path);

		// Format output
		const format =
			args.response_format === "json"
				? ResponseFormat.JSON
				: ResponseFormat.MARKDOWN;

		const mcpDuration = Date.now() - mcpStartTime;
		mcpLogger.info("MCP tool response", {
			cid: mcpCid,
			tool: "kit_index_find",
			success: !("isError" in result),
			durationMs: mcpDuration,
		});

		return {
			...("isError" in result ? { isError: true } : {}),
			content: [
				{ type: "text" as const, text: formatIndexFindResults(result, format) },
			],
		};
	},
);

// ============================================================================
// Kit Index Stats Tool
// ============================================================================

tool(
	"kit_index_stats",
	{
		description: `Get codebase statistics from PROJECT_INDEX.json (token-efficient).

Quick snapshot of codebase health without scanning files:
- Total files and symbols count
- Symbol type distribution (functions, classes, types, etc.)
- Complexity hotspots (directories with most symbols)

NOTE: Requires PROJECT_INDEX.json. Run kit_index_prime first if not present.`,
		inputSchema: {
			index_path: z
				.string()
				.optional()
				.describe(
					"Path to PROJECT_INDEX.json or directory containing it (default: walks up to find it)",
				),
			top_n: z
				.number()
				.optional()
				.describe("Number of top complexity hotspots to return (default: 5)"),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	async (args: {
		index_path?: string;
		top_n?: number;
		response_format?: string;
	}) => {
		const mcpCid = createCorrelationId();
		const mcpStartTime = Date.now();
		mcpLogger.info("MCP tool request", {
			cid: mcpCid,
			tool: "kit_index_stats",
			args: { index_path: args.index_path },
		});

		// Execute index stats
		const result = await executeIndexStats(args.index_path, args.top_n);

		// Format output
		const format =
			args.response_format === "json"
				? ResponseFormat.JSON
				: ResponseFormat.MARKDOWN;

		const mcpDuration = Date.now() - mcpStartTime;
		mcpLogger.info("MCP tool response", {
			cid: mcpCid,
			tool: "kit_index_stats",
			success: !("isError" in result),
			durationMs: mcpDuration,
		});

		return {
			...("isError" in result ? { isError: true } : {}),
			content: [
				{
					type: "text" as const,
					text: formatIndexStatsResults(result, format),
				},
			],
		};
	},
);

// ============================================================================
// Kit Index Overview Tool
// ============================================================================

tool(
	"kit_index_overview",
	{
		description: `Get all symbols in a file from PROJECT_INDEX.json (token-efficient).

See file structure without reading source code:
- All functions, classes, types, interfaces defined in the file
- Line numbers for each symbol
- Grouped by symbol type

~50x token savings compared to reading the full file.

NOTE: Requires PROJECT_INDEX.json. Run kit_index_prime first if not present.`,
		inputSchema: {
			file_path: z
				.string()
				.describe(
					'File path to get symbols for (relative to repo root). Example: "src/kit-wrapper.ts"',
				),
			index_path: z
				.string()
				.optional()
				.describe(
					"Path to PROJECT_INDEX.json or directory containing it (default: walks up to find it)",
				),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	async (args: {
		file_path: string;
		index_path?: string;
		response_format?: string;
	}) => {
		const mcpCid = createCorrelationId();
		const mcpStartTime = Date.now();
		mcpLogger.info("MCP tool request", {
			cid: mcpCid,
			tool: "kit_index_overview",
			args: { file_path: args.file_path },
		});

		// Execute index overview
		const result = await executeIndexOverview(args.file_path, args.index_path);

		// Format output
		const format =
			args.response_format === "json"
				? ResponseFormat.JSON
				: ResponseFormat.MARKDOWN;

		const mcpDuration = Date.now() - mcpStartTime;
		mcpLogger.info("MCP tool response", {
			cid: mcpCid,
			tool: "kit_index_overview",
			success: !("isError" in result),
			durationMs: mcpDuration,
		});

		return {
			...("isError" in result ? { isError: true } : {}),
			content: [
				{
					type: "text" as const,
					text: formatIndexOverviewResults(result, format),
				},
			],
		};
	},
);

// ============================================================================
// Kit Index Prime Tool
// ============================================================================

tool(
	"kit_index_prime",
	{
		description: `Generate or refresh PROJECT_INDEX.json for the codebase.

Creates a pre-built index enabling token-efficient queries:
- Indexes all symbols (functions, classes, types, etc.)
- Enables fast symbol lookup without scanning files
- Auto-detects git repository root

The index is valid for 24 hours. Use force=true to regenerate.

Requires Kit CLI: uv tool install cased-kit`,
		inputSchema: {
			path: z
				.string()
				.optional()
				.describe("Directory to index (default: git root, then CWD)"),
			force: z
				.boolean()
				.optional()
				.describe("Force regenerate even if index is less than 24 hours old"),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	async (args: {
		path?: string;
		force?: boolean;
		response_format?: string;
	}) => {
		const mcpCid = createCorrelationId();
		const mcpStartTime = Date.now();
		mcpLogger.info("MCP tool request", {
			cid: mcpCid,
			tool: "kit_index_prime",
			args: { path: args.path, force: args.force },
		});

		// Execute index prime
		const result = await executeIndexPrime(args.force, args.path);

		// Format output
		const format =
			args.response_format === "json"
				? ResponseFormat.JSON
				: ResponseFormat.MARKDOWN;

		const mcpDuration = Date.now() - mcpStartTime;
		mcpLogger.info("MCP tool response", {
			cid: mcpCid,
			tool: "kit_index_prime",
			success: !("isError" in result),
			durationMs: mcpDuration,
		});

		return {
			...("isError" in result ? { isError: true } : {}),
			content: [
				{
					type: "text" as const,
					text: formatIndexPrimeResults(result, format),
				},
			],
		};
	},
);

// ============================================================================
// Kit Semantic Search Tool
// ============================================================================

tool(
	"kit_semantic",
	{
		description: `Semantic search using natural language queries and vector embeddings.

Find code by meaning rather than exact text matches. Great for:
- "How does authentication work?"
- "Error handling patterns"
- "Database connection logic"

NOTE: Requires ML dependencies. If unavailable, falls back to text search.
To enable: uv tool install 'cased-kit[ml]'`,
		inputSchema: {
			query: z
				.string()
				.describe(
					'Natural language query. Example: "authentication flow logic"',
				),
			path: z
				.string()
				.optional()
				.describe(
					"Repository path to search (default: current directory, or KIT_DEFAULT_PATH env var)",
				),
			top_k: z
				.number()
				.optional()
				.describe("Number of results to return (default: 5, max: 50)"),
			chunk_by: z
				.enum(["symbols", "lines"])
				.optional()
				.describe("Chunking strategy: 'symbols' (default) or 'lines'"),
			build_index: z
				.boolean()
				.optional()
				.describe("Force rebuild of vector index (default: false)"),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	async (args: {
		query: string;
		path?: string;
		top_k?: number;
		chunk_by?: "symbols" | "lines";
		build_index?: boolean;
		response_format?: string;
	}) => {
		const mcpCid = createCorrelationId();
		const mcpStartTime = Date.now();
		mcpLogger.info("MCP tool request", {
			cid: mcpCid,
			tool: "kit_semantic",
			args: { query: args.query },
		});

		const { spawnSync } = await import("node:child_process");
		const format = args.response_format === "json" ? "json" : "markdown";
		const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || ".";

		const cmd = [
			"run",
			`${pluginRoot}/src/cli.ts`,
			"search",
			args.query,
			"--format",
			format,
		];

		if (args.path) {
			cmd.push("--path", args.path);
		}
		if (args.top_k !== undefined) {
			cmd.push("--top-k", String(args.top_k));
		}
		if (args.chunk_by) {
			cmd.push("--chunk-by", args.chunk_by);
		}
		if (args.build_index) {
			cmd.push("--build-index");
		}

		const result = spawnSync("bun", cmd, {
			encoding: "utf-8",
			maxBuffer: 10 * 1024 * 1024,
		});

		const mcpDuration = Date.now() - mcpStartTime;
		mcpLogger.info("MCP tool response", {
			cid: mcpCid,
			tool: "kit_semantic",
			success: result.status === 0,
			durationMs: mcpDuration,
		});

		return {
			...(result.status !== 0 ? { isError: true } : {}),
			content: [
				{
					type: "text" as const,
					text: result.status === 0 ? result.stdout : result.stderr,
				},
			],
		};
	},
);

// ============================================================================
// Kit CLI Commands - Callers Tool
// ============================================================================

tool(
	"kit_callers",
	{
		description: `Find all call sites of a function (who calls this function).

Uses PROJECT_INDEX.json + grep to locate where a function is called. Great for:
- Understanding function impact and dependencies
- Finding all places that call a specific function
- Impact analysis before refactoring

Filters out the function definition to show only actual call sites.`,
		inputSchema: {
			function_name: z
				.string()
				.describe('Function name to find callers for. Example: "executeFind"'),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	async (args: { function_name: string; response_format?: string }) => {
		const mcpCid = createCorrelationId();
		const mcpStartTime = Date.now();
		mcpLogger.info("MCP tool request", {
			cid: mcpCid,
			tool: "kit_callers",
			args: { function_name: args.function_name },
		});

		const { spawnSync } = await import("node:child_process");
		const format = args.response_format === "json" ? "json" : "markdown";
		const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || ".";

		const result = spawnSync(
			"bun",
			[
				"run",
				`${pluginRoot}/src/cli.ts`,
				"callers",
				args.function_name,
				"--format",
				format,
			],
			{ encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 },
		);

		const mcpDuration = Date.now() - mcpStartTime;
		mcpLogger.info("MCP tool response", {
			cid: mcpCid,
			tool: "kit_callers",
			success: result.status === 0,
			durationMs: mcpDuration,
		});

		return {
			...(result.status !== 0 ? { isError: true } : {}),
			content: [
				{
					type: "text" as const,
					text: result.status === 0 ? result.stdout : result.stderr,
				},
			],
		};
	},
);

// ============================================================================
// Kit CLI Commands - Calls Tool
// ============================================================================

tool(
	"kit_calls",
	{
		description: `Find what a function calls (function's dependencies).

Analyzes what functions/modules are called by a target function. Great for:
- Understanding function dependencies
- Impact of changing called functions
- Tracing execution flow

Note: Currently returns helpful error message for TypeScript/JavaScript (kit only supports Python/Terraform for call graph analysis).`,
		inputSchema: {
			function_name: z
				.string()
				.describe('Function name to analyze. Example: "executeFind"'),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	async (args: { function_name: string; response_format?: string }) => {
		const mcpCid = createCorrelationId();
		const mcpStartTime = Date.now();
		mcpLogger.info("MCP tool request", {
			cid: mcpCid,
			tool: "kit_calls",
			args: { function_name: args.function_name },
		});

		const { spawnSync } = await import("node:child_process");
		const format = args.response_format === "json" ? "json" : "markdown";
		const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || ".";

		const result = spawnSync(
			"bun",
			[
				"run",
				`${pluginRoot}/src/cli.ts`,
				"calls",
				args.function_name,
				"--format",
				format,
			],
			{ encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 },
		);

		const mcpDuration = Date.now() - mcpStartTime;
		mcpLogger.info("MCP tool response", {
			cid: mcpCid,
			tool: "kit_calls",
			success: result.status === 0,
			durationMs: mcpDuration,
		});

		return {
			...(result.status !== 0 ? { isError: true } : {}),
			content: [
				{
					type: "text" as const,
					text: result.status === 0 ? result.stdout : result.stderr,
				},
			],
		};
	},
);

// ============================================================================
// Kit CLI Commands - Deps Tool
// ============================================================================

tool(
	"kit_deps",
	{
		description: `Show import/export relationships for a file.

Analyzes imports and exports from a specific file. Great for:
- Understanding file dependencies
- Tracing import chains
- Circular dependency detection

Note: Currently returns helpful error message for TypeScript/JavaScript (kit only supports Python/Terraform for dependency analysis).`,
		inputSchema: {
			file_path: z
				.string()
				.describe(
					'File path to analyze (relative to repo root). Example: "src/index.ts"',
				),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	async (args: { file_path: string; response_format?: string }) => {
		const mcpCid = createCorrelationId();
		const mcpStartTime = Date.now();
		mcpLogger.info("MCP tool request", {
			cid: mcpCid,
			tool: "kit_deps",
			args: { file_path: args.file_path },
		});

		const { spawnSync } = await import("node:child_process");
		const format = args.response_format === "json" ? "json" : "markdown";
		const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || ".";

		const result = spawnSync(
			"bun",
			[
				"run",
				`${pluginRoot}/src/cli.ts`,
				"deps",
				args.file_path,
				"--format",
				format,
			],
			{ encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 },
		);

		const mcpDuration = Date.now() - mcpStartTime;
		mcpLogger.info("MCP tool response", {
			cid: mcpCid,
			tool: "kit_deps",
			success: result.status === 0,
			durationMs: mcpDuration,
		});

		return {
			...(result.status !== 0 ? { isError: true } : {}),
			content: [
				{
					type: "text" as const,
					text: result.status === 0 ? result.stdout : result.stderr,
				},
			],
		};
	},
);

// ============================================================================
// Kit CLI Commands - Dead Code Tool
// ============================================================================

tool(
	"kit_dead",
	{
		description: `Find unused exports (dead code detection).

Identifies exported symbols that have no external references. Great for:
- Cleaning up dead code
- Finding unused exports
- Code maintenance and refactoring

Requires PROJECT_INDEX.json. Run kit_index_prime first if not present.`,
		inputSchema: {
			path: z
				.string()
				.optional()
				.describe(
					"Directory to scope search (optional, defaults to entire repo). Example: 'src/lib'",
				),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	async (args: { path?: string; response_format?: string }) => {
		const mcpCid = createCorrelationId();
		const mcpStartTime = Date.now();
		mcpLogger.info("MCP tool request", {
			cid: mcpCid,
			tool: "kit_dead",
			args: { path: args.path },
		});

		const { spawnSync } = await import("node:child_process");
		const format = args.response_format === "json" ? "json" : "markdown";
		const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || ".";

		const cmd = args.path
			? [
					"run",
					`${pluginRoot}/src/cli.ts`,
					"dead",
					args.path,
					"--format",
					format,
				]
			: ["run", `${pluginRoot}/src/cli.ts`, "dead", "--format", format];

		const result = spawnSync("bun", cmd, {
			encoding: "utf-8",
			maxBuffer: 10 * 1024 * 1024,
		});

		const mcpDuration = Date.now() - mcpStartTime;
		mcpLogger.info("MCP tool response", {
			cid: mcpCid,
			tool: "kit_dead",
			success: result.status === 0,
			durationMs: mcpDuration,
		});

		return {
			...(result.status !== 0 ? { isError: true } : {}),
			content: [
				{
					type: "text" as const,
					text: result.status === 0 ? result.stdout : result.stderr,
				},
			],
		};
	},
);

// ============================================================================
// Kit CLI Commands - Blast Radius Tool
// ============================================================================

tool(
	"kit_blast",
	{
		description: `Blast radius analysis: what gets affected by changing something.

Shows all code that depends on a specific file or symbol. Great for:
- Understanding change impact
- Refactoring safety analysis
- Dependency tracing

Accepts target as either:
- Symbol name (e.g., "executeFind")
- File location (e.g., "src/index.ts:42")`,
		inputSchema: {
			target: z
				.string()
				.describe(
					'Target to analyze (symbol name or file:line). Examples: "executeFind", "src/index.ts:42"',
				),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	async (args: { target: string; response_format?: string }) => {
		const mcpCid = createCorrelationId();
		const mcpStartTime = Date.now();
		mcpLogger.info("MCP tool request", {
			cid: mcpCid,
			tool: "kit_blast",
			args: { target: args.target },
		});

		const { spawnSync } = await import("node:child_process");
		const format = args.response_format === "json" ? "json" : "markdown";
		const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || ".";

		const result = spawnSync(
			"bun",
			[
				"run",
				`${pluginRoot}/src/cli.ts`,
				"blast",
				args.target,
				"--format",
				format,
			],
			{ encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 },
		);

		const mcpDuration = Date.now() - mcpStartTime;
		mcpLogger.info("MCP tool response", {
			cid: mcpCid,
			tool: "kit_blast",
			success: result.status === 0,
			durationMs: mcpDuration,
		});

		return {
			...(result.status !== 0 ? { isError: true } : {}),
			content: [
				{
					type: "text" as const,
					text: result.status === 0 ? result.stdout : result.stderr,
				},
			],
		};
	},
);

// ============================================================================
// Kit CLI Commands - API Tool
// ============================================================================

tool(
	"kit_api",
	{
		description: `List module public API (all exports from a directory).

Extracts and displays all exported symbols from a directory. Great for:
- Understanding module interfaces
- API surface documentation
- Finding what a module exposes

Uses heuristics to identify likely exported symbols (PascalCase, UPPER_CASE, common patterns).`,
		inputSchema: {
			directory: z
				.string()
				.describe(
					'Directory to analyze (relative to repo root). Example: "src/commands"',
				),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	async (args: { directory: string; response_format?: string }) => {
		const mcpCid = createCorrelationId();
		const mcpStartTime = Date.now();
		mcpLogger.info("MCP tool request", {
			cid: mcpCid,
			tool: "kit_api",
			args: { directory: args.directory },
		});

		const { spawnSync } = await import("node:child_process");
		const format = args.response_format === "json" ? "json" : "markdown";
		const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || ".";

		const result = spawnSync(
			"bun",
			[
				"run",
				`${pluginRoot}/src/cli.ts`,
				"api",
				args.directory,
				"--format",
				format,
			],
			{ encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 },
		);

		const mcpDuration = Date.now() - mcpStartTime;
		mcpLogger.info("MCP tool response", {
			cid: mcpCid,
			tool: "kit_api",
			success: result.status === 0,
			durationMs: mcpDuration,
		});

		return {
			...(result.status !== 0 ? { isError: true } : {}),
			content: [
				{
					type: "text" as const,
					text: result.status === 0 ? result.stdout : result.stderr,
				},
			],
		};
	},
);

// ============================================================================
// Kit Grep Tool
// ============================================================================

tool(
	"kit_grep",
	{
		description: `Fast text search across repository files using Kit CLI.

Searches for literal patterns with optional regex support. Great for:
- Finding function definitions
- Locating error messages
- Searching for specific strings

Results include file paths, line numbers, and matched content.`,
		inputSchema: {
			pattern: z
				.string()
				.describe('Search pattern (text or regex). Example: "function auth"'),
			path: z
				.string()
				.optional()
				.describe(
					"Repository path to search (default: current directory, or KIT_DEFAULT_PATH env var)",
				),
			include: z
				.string()
				.optional()
				.describe('Include files matching pattern. Example: "*.ts"'),
			exclude: z
				.string()
				.optional()
				.describe('Exclude files matching pattern. Example: "*.test.ts"'),
			case_sensitive: z
				.boolean()
				.optional()
				.describe("Case sensitive search (default: true)"),
			max_results: z
				.number()
				.optional()
				.describe("Maximum results to return (default: 100, max: 1000)"),
			directory: z
				.string()
				.optional()
				.describe("Limit search to specific subdirectory"),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	async (args: {
		pattern: string;
		path?: string;
		include?: string;
		exclude?: string;
		case_sensitive?: boolean;
		max_results?: number;
		directory?: string;
		response_format?: string;
	}) => {
		const mcpCid = createCorrelationId();
		const mcpStartTime = Date.now();
		mcpLogger.info("MCP tool request", {
			cid: mcpCid,
			tool: "kit_grep",
			args: { pattern: args.pattern },
		});

		const { spawnSync } = await import("node:child_process");
		const format = args.response_format === "json" ? "json" : "markdown";
		const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || ".";

		// Build command arguments
		const cmd = [
			"run",
			`${pluginRoot}/src/cli.ts`,
			"grep",
			args.pattern,
			"--format",
			format,
		];

		// Add optional flags
		if (args.path) cmd.push("--path", args.path);
		if (args.include) cmd.push("--include", args.include);
		if (args.exclude) cmd.push("--exclude", args.exclude);
		if (args.case_sensitive === false) cmd.push("--case-insensitive", "true");
		if (args.max_results) cmd.push("--max-results", String(args.max_results));
		if (args.directory) cmd.push("--directory", args.directory);

		const result = spawnSync("bun", cmd, {
			encoding: "utf-8",
			maxBuffer: 10 * 1024 * 1024,
		});

		const mcpDuration = Date.now() - mcpStartTime;
		mcpLogger.info("MCP tool response", {
			cid: mcpCid,
			tool: "kit_grep",
			success: result.status === 0,
			durationMs: mcpDuration,
		});

		return {
			...(result.status !== 0 ? { isError: true } : {}),
			content: [
				{
					type: "text" as const,
					text: result.status === 0 ? result.stdout : result.stderr,
				},
			],
		};
	},
);

// ============================================================================
// Kit Commit Tool
// ============================================================================

tool(
	"kit_commit",
	{
		description: `Generate AI-powered commit messages from staged changes.

Uses kit CLI to analyze git diff and generate intelligent, conventional commit messages.
Great for:
- Creating descriptive commit messages automatically
- Following commit message conventions
- Saving time on commit message writing

IMPORTANT: Default dry_run=true for safety. Set to false to actually commit.

Requires Kit CLI: uv tool install cased-kit`,
		inputSchema: {
			dry_run: z
				.boolean()
				.optional()
				.describe(
					"Show generated message without committing (default: true for safety)",
				),
			model: z
				.string()
				.optional()
				.describe(
					'Override LLM model. Examples: "gpt-4.1-nano", "claude-sonnet-4-20250514"',
				),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: false, // Can modify git state
			destructiveHint: false, // Not destructive (can be dry run)
			idempotentHint: false, // Each commit is unique
			openWorldHint: false,
		},
	},
	async (args: {
		dry_run?: boolean;
		model?: string;
		response_format?: string;
	}) => {
		const mcpCid = createCorrelationId();
		const mcpStartTime = Date.now();
		mcpLogger.info("MCP tool request", {
			cid: mcpCid,
			tool: "kit_commit",
			args: { dry_run: args.dry_run, model: args.model },
		});

		const { spawnSync } = await import("node:child_process");
		const format = args.response_format === "json" ? "json" : "markdown";
		const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || ".";

		// Default dry_run to true for safety
		const dryRun = args.dry_run !== false;

		const cmdArgs = [
			"run",
			`${pluginRoot}/src/cli.ts`,
			"commit",
			"--format",
			format,
		];

		if (dryRun) {
			cmdArgs.push("--dry-run", "true");
		} else {
			cmdArgs.push("--dry-run", "false");
		}

		if (args.model) {
			cmdArgs.push("--model", args.model);
		}

		const result = spawnSync("bun", cmdArgs, {
			encoding: "utf-8",
			maxBuffer: 10 * 1024 * 1024,
			timeout: 60000,
		});

		const mcpDuration = Date.now() - mcpStartTime;
		mcpLogger.info("MCP tool response", {
			cid: mcpCid,
			tool: "kit_commit",
			success: result.status === 0,
			durationMs: mcpDuration,
		});

		return {
			...(result.status !== 0 ? { isError: true } : {}),
			content: [
				{
					type: "text" as const,
					text: result.status === 0 ? result.stdout : result.stderr,
				},
			],
		};
	},
);

// ============================================================================
// Kit CLI Commands - Summarize Tool
// ============================================================================

tool(
	"kit_summarize",
	{
		description: `Generate a concise summary of a GitHub PR.

Uses Kit CLI to analyze PR changes and generate summary. Great for:
- Quick PR understanding
- PR review preparation
- Documentation of changes

Can optionally update the PR description with the generated summary.

IMPORTANT: Default update_pr_body=false for safety.`,
		inputSchema: {
			pr_url: z
				.string()
				.describe(
					'GitHub PR URL. Example: "https://github.com/owner/repo/pull/123"',
				),
			update_pr_body: z
				.boolean()
				.optional()
				.describe("Update PR description with summary (default: false)"),
			model: z
				.string()
				.optional()
				.describe('Override LLM model. Example: "claude-sonnet-4-20250514"'),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: false, // Can update PR body
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: true, // Makes API calls to GitHub
		},
	},
	async (args: {
		pr_url: string;
		update_pr_body?: boolean;
		model?: string;
		response_format?: string;
	}) => {
		const mcpCid = createCorrelationId();
		const mcpStartTime = Date.now();
		mcpLogger.info("MCP tool request", {
			cid: mcpCid,
			tool: "kit_summarize",
			args: { pr_url: args.pr_url, update_pr_body: args.update_pr_body },
		});

		const { spawnSync } = await import("node:child_process");
		const format = args.response_format === "json" ? "json" : "markdown";
		const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || ".";

		const cmd = [
			"run",
			`${pluginRoot}/src/cli.ts`,
			"summarize",
			args.pr_url,
			"--format",
			format,
		];

		if (args.update_pr_body) {
			cmd.push("--update-pr-body", "true");
		}

		if (args.model) {
			cmd.push("--model", args.model);
		}

		const result = spawnSync("bun", cmd, {
			encoding: "utf-8",
			maxBuffer: 10 * 1024 * 1024,
		});

		const mcpDuration = Date.now() - mcpStartTime;
		mcpLogger.info("MCP tool response", {
			cid: mcpCid,
			tool: "kit_summarize",
			success: result.status === 0,
			durationMs: mcpDuration,
		});

		return {
			...(result.status !== 0 ? { isError: true } : {}),
			content: [
				{
					type: "text" as const,
					text: result.status === 0 ? result.stdout : result.stderr,
				},
			],
		};
	},
);

// ============================================================================
// Start Server
// ============================================================================

startServer();
