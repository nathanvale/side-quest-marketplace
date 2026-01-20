#!/usr/bin/env bun

/**
 * Kit MCP Server
 *
 * Provides PROJECT_INDEX.json-based tools for token-efficient codebase navigation
 * using the Kit CLI (cased-kit).
 *
 * ## Observability
 *
 * File logging is enabled via the MCP module's built-in observability layer.
 * Logs are written to: ~/.claude/logs/kit.jsonl
 *
 * The `log` API from @sidequest/core/mcp provides dual-logging:
 * - MCP protocol logging (visible in Claude Desktop inspector)
 * - JSONL file logging (for post-mortem debugging)
 */

import { formatBytes } from "@sidequest/core/formatters";
import {
	createCorrelationId,
	log,
	startServer,
	tool,
	z,
} from "@sidequest/core/mcp";
import { wrapToolHandler } from "@sidequest/core/mcp-response";
import { buildEnhancedPath, spawnSyncCollect } from "@sidequest/core/spawn";
import {
	executeAstSearch,
	executeIndexFind,
	executeIndexOverview,
	executeIndexPrime,
	executeIndexStats,
	executeKitFileContent,
	executeKitFileTree,
	executeKitUsages,
	formatIndexFindResults,
	formatIndexOverviewResults,
	formatIndexPrimeResults,
	formatIndexStatsResults,
	ResponseFormat,
	SearchMode,
} from "../src/index.js";

// ============================================================================
// Logger Adapter
// ============================================================================

/**
 * Adapter to bridge @sidequest/core/mcp log API to wrapToolHandler Logger interface.
 *
 * The wrapToolHandler expects: logger.info(message, properties)
 * But @sidequest/core/mcp provides: log.info(properties, subsystem)
 *
 * This adapter inverts the signature and forwards to the correct subsystem.
 */
function createLoggerAdapter(subsystem: string) {
	return {
		info: (message: string, properties?: Record<string, unknown>) => {
			log.info({ message, ...properties }, subsystem);
		},
		error: (message: string, properties?: Record<string, unknown>) => {
			log.error({ message, ...properties }, subsystem);
		},
	};
}

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
	wrapToolHandler(
		async (args, format) => {
			const { symbol_name, index_path } = args as {
				symbol_name: string;
				index_path?: string;
			};
			const result = await executeIndexFind(symbol_name, index_path);

			// Convert isError result to exception for wrapToolHandler
			if ("isError" in result && result.isError) {
				throw new Error(result.error);
			}

			const responseFormat =
				format === ResponseFormat.JSON
					? ResponseFormat.JSON
					: ResponseFormat.MARKDOWN;
			return formatIndexFindResults(result, responseFormat);
		},
		{
			toolName: "kit_index_find",
			logger: createLoggerAdapter("symbols"),
			createCid: createCorrelationId,
		},
	),
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
	wrapToolHandler(
		async (args, format) => {
			const { index_path, top_n } = args as {
				index_path?: string;
				top_n?: number;
			};
			const result = await executeIndexStats(index_path, top_n);

			// Convert isError result to exception for wrapToolHandler
			if ("isError" in result && result.isError) {
				throw new Error(result.error);
			}

			const responseFormat =
				format === ResponseFormat.JSON
					? ResponseFormat.JSON
					: ResponseFormat.MARKDOWN;
			return formatIndexStatsResults(result, responseFormat);
		},
		{
			toolName: "kit_index_stats",
			logger: createLoggerAdapter("symbols"),
			createCid: createCorrelationId,
		},
	),
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
	wrapToolHandler(
		async (args, format) => {
			const { file_path, index_path } = args as {
				file_path: string;
				index_path?: string;
			};
			const result = await executeIndexOverview(file_path, index_path);

			// Convert isError result to exception for wrapToolHandler
			if ("isError" in result && result.isError) {
				throw new Error(result.error);
			}

			const responseFormat =
				format === ResponseFormat.JSON
					? ResponseFormat.JSON
					: ResponseFormat.MARKDOWN;
			return formatIndexOverviewResults(result, responseFormat);
		},
		{
			toolName: "kit_index_overview",
			logger: createLoggerAdapter("symbols"),
			createCid: createCorrelationId,
		},
	),
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
	wrapToolHandler(
		async (args, format) => {
			const { path, force } = args as { path?: string; force?: boolean };
			const result = await executeIndexPrime(force, path);

			// Convert isError result to exception for wrapToolHandler
			if ("isError" in result && result.isError) {
				throw new Error(result.error);
			}

			const responseFormat =
				format === ResponseFormat.JSON
					? ResponseFormat.JSON
					: ResponseFormat.MARKDOWN;
			return formatIndexPrimeResults(result, responseFormat);
		},
		{
			toolName: "kit_index_prime",
			logger: createLoggerAdapter("symbols"),
			createCid: createCorrelationId,
		},
	),
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
	wrapToolHandler(
		async (args, format) => {
			const { query, path, top_k, chunk_by, build_index } = args as {
				query: string;
				path?: string;
				top_k?: number;
				chunk_by?: "symbols" | "lines";
				build_index?: boolean;
			};

			const formatStr = format === ResponseFormat.JSON ? "json" : "markdown";
			const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || ".";

			const cmd = [
				"run",
				`${pluginRoot}/src/cli.ts`,
				"search",
				query,
				"--format",
				formatStr,
			];

			if (path) {
				cmd.push("--path", path);
			}
			if (top_k !== undefined) {
				cmd.push("--top-k", String(top_k));
			}
			if (chunk_by) {
				cmd.push("--chunk-by", chunk_by);
			}
			if (build_index) {
				cmd.push("--build-index");
			}

			const result = spawnSyncCollect(["bun", ...cmd], {
				env: { PATH: buildEnhancedPath() },
			});

			// Convert non-zero exit code to exception for wrapToolHandler
			if (result.exitCode !== 0) {
				throw new Error(result.stderr || "Semantic search failed");
			}

			return result.stdout;
		},
		{
			toolName: "kit_semantic",
			logger: createLoggerAdapter("semantic"),
			createCid: createCorrelationId,
		},
	),
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
	wrapToolHandler(
		async (args, format) => {
			const { function_name } = args as { function_name: string };
			const formatStr = format === ResponseFormat.JSON ? "json" : "markdown";
			const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || ".";

			const result = spawnSyncCollect(
				[
					"bun",
					"run",
					`${pluginRoot}/src/cli.ts`,
					"callers",
					function_name,
					"--format",
					formatStr,
				],
				{ env: { PATH: buildEnhancedPath() } },
			);

			if (result.exitCode !== 0) {
				throw new Error(result.stderr || "Failed to find callers");
			}

			return result.stdout;
		},
		{
			toolName: "kit_callers",
			logger: createLoggerAdapter("symbols"),
			createCid: createCorrelationId,
		},
	),
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
	wrapToolHandler(
		async (args, format) => {
			const { function_name } = args as { function_name: string };
			const formatStr = format === ResponseFormat.JSON ? "json" : "markdown";
			const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || ".";

			const result = spawnSyncCollect([
				"bun",
				"run",
				`${pluginRoot}/src/cli.ts`,
				"calls",
				function_name,
				"--format",
				formatStr,
			]);

			if (result.exitCode !== 0) {
				throw new Error(result.stderr || "Failed to find function calls");
			}

			return result.stdout;
		},
		{
			toolName: "kit_calls",
			logger: createLoggerAdapter("symbols"),
			createCid: createCorrelationId,
		},
	),
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
	wrapToolHandler(
		async (args, format) => {
			const { file_path } = args as { file_path: string };
			const formatStr = format === ResponseFormat.JSON ? "json" : "markdown";
			const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || ".";

			const result = spawnSyncCollect(
				[
					"bun",
					"run",
					`${pluginRoot}/src/cli.ts`,
					"deps",
					file_path,
					"--format",
					formatStr,
				],
				{ env: { PATH: buildEnhancedPath() } },
			);

			if (result.exitCode !== 0) {
				throw new Error(result.stderr || "Failed to analyze dependencies");
			}

			return result.stdout;
		},
		{
			toolName: "kit_deps",
			logger: createLoggerAdapter("symbols"),
			createCid: createCorrelationId,
		},
	),
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
	wrapToolHandler(
		async (args, format) => {
			const { path } = args as { path?: string };
			const formatStr = format === ResponseFormat.JSON ? "json" : "markdown";
			const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || ".";

			const cmd = path
				? [
						"run",
						`${pluginRoot}/src/cli.ts`,
						"dead",
						path,
						"--format",
						formatStr,
					]
				: ["run", `${pluginRoot}/src/cli.ts`, "dead", "--format", formatStr];

			const result = spawnSyncCollect(["bun", ...cmd], {
				env: { PATH: buildEnhancedPath() },
			});

			if (result.exitCode !== 0) {
				throw new Error(result.stderr || "Failed to find dead code");
			}

			return result.stdout;
		},
		{
			toolName: "kit_dead",
			logger: createLoggerAdapter("symbols"),
			createCid: createCorrelationId,
		},
	),
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
	wrapToolHandler(
		async (args, format) => {
			const { target } = args as { target: string };
			const formatStr = format === ResponseFormat.JSON ? "json" : "markdown";
			const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || ".";

			const result = spawnSyncCollect(
				[
					"bun",
					"run",
					`${pluginRoot}/src/cli.ts`,
					"blast",
					target,
					"--format",
					formatStr,
				],
				{ env: { PATH: buildEnhancedPath() } },
			);

			if (result.exitCode !== 0) {
				throw new Error(result.stderr || "Failed to analyze blast radius");
			}

			return result.stdout;
		},
		{
			toolName: "kit_blast",
			logger: createLoggerAdapter("symbols"),
			createCid: createCorrelationId,
		},
	),
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
	wrapToolHandler(
		async (args, format) => {
			const { directory } = args as { directory: string };
			const formatStr = format === ResponseFormat.JSON ? "json" : "markdown";
			const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || ".";

			const result = spawnSyncCollect(
				[
					"bun",
					"run",
					`${pluginRoot}/src/cli.ts`,
					"api",
					directory,
					"--format",
					formatStr,
				],
				{ env: { PATH: buildEnhancedPath() } },
			);

			if (result.exitCode !== 0) {
				throw new Error(result.stderr || "Failed to list API");
			}

			return result.stdout;
		},
		{
			toolName: "kit_api",
			logger: createLoggerAdapter("symbols"),
			createCid: createCorrelationId,
		},
	),
);

// ============================================================================
// Kit Grep Tool - DISABLED
// ============================================================================
//
// DEPRECATED: kit_grep has been disabled to encourage use of Priority 1/2 tools
// (index-based and graph-based search) which are 30-50x faster and don't timeout
// on large codebases.
//
// Use these alternatives instead:
// - kit_index_find: Fast symbol lookup from PROJECT_INDEX.json (~10ms)
// - kit_callers: Find who calls a function (~200ms)
// - kit_usages: Find all usages of a symbol (~200ms)
// - kit_ast_search: Find code by structure (async functions, classes, etc.)
//
// Rationale: Grep operations on large repos timeout at ~30s and hit Kit CLI
// limitations. Index-based tools provide the same results faster and more
// reliably.

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
	wrapToolHandler(
		async (args, format) => {
			const { dry_run, model } = args as { dry_run?: boolean; model?: string };
			const formatStr = format === ResponseFormat.JSON ? "json" : "markdown";
			const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || ".";

			// Default dry_run to true for safety
			const dryRun = dry_run !== false;

			const cmdArgs = [
				"run",
				`${pluginRoot}/src/cli.ts`,
				"commit",
				"--format",
				formatStr,
			];

			if (dryRun) {
				cmdArgs.push("--dry-run", "true");
			} else {
				cmdArgs.push("--dry-run", "false");
			}

			if (model) {
				cmdArgs.push("--model", model);
			}

			const result = spawnSyncCollect(["bun", ...cmdArgs], {
				env: { PATH: buildEnhancedPath() },
			});

			if (result.exitCode !== 0) {
				throw new Error(result.stderr || "Failed to generate commit message");
			}

			return result.stdout;
		},
		{
			toolName: "kit_commit",
			logger: createLoggerAdapter("commit"),
			createCid: createCorrelationId,
		},
	),
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
	wrapToolHandler(
		async (args, format) => {
			const { pr_url, update_pr_body, model } = args as {
				pr_url: string;
				update_pr_body?: boolean;
				model?: string;
			};
			const formatStr = format === ResponseFormat.JSON ? "json" : "markdown";
			const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || ".";

			const cmd = [
				"run",
				`${pluginRoot}/src/cli.ts`,
				"summarize",
				pr_url,
				"--format",
				formatStr,
			];

			if (update_pr_body) {
				cmd.push("--update-pr-body", "true");
			}

			if (model) {
				cmd.push("--model", model);
			}

			const result = spawnSyncCollect(["bun", ...cmd], {
				env: { PATH: buildEnhancedPath() },
			});

			if (result.exitCode !== 0) {
				throw new Error(result.stderr || "Failed to summarize PR");
			}

			return result.stdout;
		},
		{
			toolName: "kit_summarize",
			logger: createLoggerAdapter("summarize"),
			createCid: createCorrelationId,
		},
	),
);

// ============================================================================
// Kit AST Search Tool
// ============================================================================

tool(
	"kit_ast_search",
	{
		description: `AST pattern search using tree-sitter for structural code matching.

Find code by structure rather than text. More precise than grep for:
- "async function" - Find all async functions
- "try catch" - Find try-catch blocks
- "React hooks" - Find useState/useEffect calls
- "class extends" - Find class inheritance

Supports TypeScript, JavaScript, and Python.

Two modes:
- simple (default): Natural language patterns like "async function"
- pattern: JSON criteria like {"type": "function_declaration", "async": true}`,
		inputSchema: {
			pattern: z
				.string()
				.describe(
					'Search pattern. Simple mode: "async function", "try catch". Pattern mode: {"type": "function_declaration"}',
				),
			mode: z
				.enum(["simple", "pattern"])
				.optional()
				.describe(
					"Search mode: 'simple' (default) for natural language, 'pattern' for JSON criteria",
				),
			file_pattern: z
				.string()
				.optional()
				.describe(
					'File glob pattern to search (default: all supported files). Example: "*.ts"',
				),
			path: z
				.string()
				.optional()
				.describe("Repository path to search (default: current directory)"),
			max_results: z
				.number()
				.optional()
				.describe("Maximum results to return (default: 100)"),
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
	wrapToolHandler(
		async (args, format) => {
			const { pattern, mode, file_pattern, path, max_results } = args as {
				pattern: string;
				mode?: "simple" | "pattern";
				file_pattern?: string;
				path?: string;
				max_results?: number;
			};

			const result = await executeAstSearch({
				pattern,
				mode: mode === "pattern" ? SearchMode.PATTERN : SearchMode.SIMPLE,
				filePattern: file_pattern,
				path,
				maxResults: max_results,
			});

			// Convert error result to exception for wrapToolHandler
			if ("error" in result) {
				throw new Error(
					`${result.error}${result.hint ? `\nHint: ${result.hint}` : ""}`,
				);
			}

			// Format based on response_format
			if (format === ResponseFormat.JSON) {
				return JSON.stringify(result, null, 2);
			}

			// Format as markdown
			let markdown = `## AST Search Results\n\n`;
			markdown += `**Pattern:** \`${result.pattern}\`\n`;
			markdown += `**Mode:** ${result.mode}\n`;
			markdown += `**Matches:** ${result.count}\n\n`;

			if (result.matches.length === 0) {
				markdown += "_No matches found_\n";
			} else {
				for (const match of result.matches) {
					markdown += `### ${match.file}:${match.line}\n`;
					markdown += `**Node type:** \`${match.nodeType}\`\n`;
					if (match.context.parentFunction) {
						markdown += `**In function:** \`${match.context.parentFunction}\`\n`;
					}
					if (match.context.parentClass) {
						markdown += `**In class:** \`${match.context.parentClass}\`\n`;
					}
					markdown += `\`\`\`\n${match.text.slice(0, 300)}${match.text.length > 300 ? "..." : ""}\n\`\`\`\n\n`;
				}
			}

			return markdown;
		},
		{
			toolName: "kit_ast_search",
			logger: createLoggerAdapter("ast"),
			createCid: createCorrelationId,
		},
	),
);

// ============================================================================
// Kit Usages Tool
// ============================================================================

tool(
	"kit_usages",
	{
		description: `Find all usages of a symbol (function, class, type, constant).

Shows where a symbol is defined and referenced across the codebase. Great for:
- Understanding where a function/class/type is used
- Impact analysis before refactoring
- Finding all references to a constant or variable

Requires Kit CLI: uv tool install cased-kit`,
		inputSchema: {
			symbol: z
				.string()
				.describe('Symbol name to find usages of. Example: "UserService"'),
			symbol_type: z
				.string()
				.optional()
				.describe('Filter by symbol type: "function", "class", "type", etc.'),
			path: z
				.string()
				.optional()
				.describe("Repository path to search (default: current directory)"),
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
	wrapToolHandler(
		async (args, format) => {
			const { symbol, symbol_type, path } = args as {
				symbol: string;
				symbol_type?: string;
				path?: string;
			};

			const result = executeKitUsages({
				symbolName: symbol,
				symbolType: symbol_type,
				path,
			});

			// Convert error result to exception for wrapToolHandler
			if ("error" in result) {
				throw new Error(
					`${result.error}${result.hint ? `\nHint: ${result.hint}` : ""}`,
				);
			}

			// Format based on response_format
			if (format === ResponseFormat.JSON) {
				return JSON.stringify(result, null, 2);
			}

			// Format as markdown
			let markdown = `## Symbol Usages\n\n`;
			markdown += `**Symbol:** \`${result.symbolName}\`\n`;
			markdown += `**Usages found:** ${result.count}\n\n`;

			if (result.usages.length === 0) {
				markdown += "_No usages found_\n";
			} else {
				for (const usage of result.usages) {
					markdown += `### ${usage.file}${usage.line ? `:${usage.line}` : ""}\n`;
					markdown += `**Type:** \`${usage.type}\` | **Name:** \`${usage.name}\`\n`;
					if (usage.context) {
						markdown += `\`\`\`\n${usage.context}\n\`\`\`\n`;
					}
					markdown += "\n";
				}
			}

			return markdown;
		},
		{
			toolName: "kit_usages",
			logger: createLoggerAdapter("usages"),
			createCid: createCorrelationId,
		},
	),
);

// ============================================================================
// Kit File Tree Tool
// ============================================================================

tool(
	"kit_file_tree",
	{
		description: `Get repository file tree structure (~50ms).

Fast way to understand codebase layout without reading files. Returns:
- File and directory paths
- File sizes
- Directory structure

Useful for exploration and navigation.

Requires Kit CLI: uv tool install cased-kit`,
		inputSchema: {
			path: z
				.string()
				.optional()
				.describe("Repository path (default: current directory)"),
			subpath: z
				.string()
				.optional()
				.describe('Subdirectory to show tree for. Example: "src/components"'),
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
	wrapToolHandler(
		async (args, format) => {
			const { path, subpath } = args as { path?: string; subpath?: string };

			const result = executeKitFileTree({
				path,
				subpath,
			});

			// Convert error result to exception for wrapToolHandler
			if ("error" in result) {
				throw new Error(
					`${result.error}${result.hint ? `\nHint: ${result.hint}` : ""}`,
				);
			}

			// Format based on response_format
			if (format === ResponseFormat.JSON) {
				return JSON.stringify(result, null, 2);
			}

			// Format as markdown tree
			let markdown = `## File Tree\n\n`;
			markdown += `**Path:** \`${result.path}\`${result.subpath ? ` (subpath: \`${result.subpath}\`)` : ""}\n`;
			markdown += `**Entries:** ${result.count}\n\n`;

			if (result.entries.length === 0) {
				markdown += "_No entries found_\n";
			} else {
				markdown += "```\n";
				for (const entry of result.entries) {
					const icon = entry.isDir ? "📁" : "📄";
					const size = entry.isDir ? "" : ` (${formatBytes(entry.size)})`;
					markdown += `${icon} ${entry.path}${size}\n`;
				}
				markdown += "```\n";
			}

			return markdown;
		},
		{
			toolName: "kit_file_tree",
			logger: createLoggerAdapter("fileTree"),
			createCid: createCorrelationId,
		},
	),
);

// ============================================================================
// Kit File Content Tool
// ============================================================================

tool(
	"kit_file_content",
	{
		description: `Batch read multiple files efficiently.

Read content of one or more files in a single request. Reduces round trips compared to individual file reads.

Returns content for each file with success/failure status.

Requires Kit CLI: uv tool install cased-kit`,
		inputSchema: {
			files: z
				.array(z.string())
				.describe(
					'File paths to read (relative to repo root). Example: ["src/index.ts", "package.json"]',
				),
			path: z
				.string()
				.optional()
				.describe("Repository path (default: current directory)"),
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
	wrapToolHandler(
		async (args, format) => {
			const { files, path } = args as { files: string[]; path?: string };

			const result = executeKitFileContent({
				filePaths: files,
				path,
			});

			// Convert error result to exception for wrapToolHandler
			if ("error" in result) {
				throw new Error(
					`${result.error}${result.hint ? `\nHint: ${result.hint}` : ""}`,
				);
			}

			// Format based on response_format
			if (format === ResponseFormat.JSON) {
				return JSON.stringify(result, null, 2);
			}

			// Format as markdown
			let markdown = `## File Contents\n\n`;
			markdown += `**Files requested:** ${result.count}\n`;
			markdown += `**Found:** ${result.files.filter((f) => f.found).length}\n\n`;

			for (const file of result.files) {
				markdown += `### ${file.file}\n`;
				if (file.found) {
					// Detect language for syntax highlighting
					const ext = file.file.split(".").pop() || "";
					const lang =
						{
							ts: "typescript",
							js: "javascript",
							py: "python",
							json: "json",
							md: "markdown",
						}[ext] || "";
					markdown += `\`\`\`${lang}\n${file.content}\n\`\`\`\n`;
				} else {
					markdown += `_Not found: ${file.error || "File does not exist"}_\n`;
				}
				markdown += "\n";
			}

			return markdown;
		},
		{
			toolName: "kit_file_content",
			logger: createLoggerAdapter("fileContent"),
			createCid: createCorrelationId,
		},
	),
);

// ============================================================================
// Utility Functions - formatBytes now imported from @sidequest/core/formatters
// ============================================================================

// ============================================================================
// Start Server
// ============================================================================

startServer("kit", {
	version: "1.0.0",
	fileLogging: {
		enabled: true,
		subsystems: [
			"semantic",
			"symbols",
			"fileTree",
			"fileContent",
			"usages",
			"ast",
			"commit",
			"summarize",
		],
		level: "debug",
	},
});
