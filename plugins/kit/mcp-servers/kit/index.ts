#!/usr/bin/env bun

/**
 * Kit MCP Server
 *
 * Provides grep, semantic search, and symbol extraction tools
 * using the Kit CLI (cased-kit).
 */

import { startServer, tool, z } from "mcpez";

import {
	createCorrelationId,
	executeAstSearch,
	executeKitFileContent,
	executeKitFileTree,
	executeKitGrep,
	executeKitSemantic,
	executeKitSymbols,
	executeKitUsages,
	formatAstSearchResults,
	formatFileContentResults,
	formatFileTreeResults,
	formatGrepResults,
	formatSemanticResults,
	formatSymbolsResults,
	formatUsagesResults,
	getKitLogger,
	initLogger,
	isError,
	ResponseFormat,
	SearchMode,
	validateAstSearchInputs,
	validateFileContentInputs,
	validateFileTreeInputs,
	validateGrepInputs,
	validateSemanticInputs,
	validateSymbolsInputs,
	validateUsagesInputs,
} from "../../src/index.js";

// Initialize logging
initLogger().catch(console.error);

/** MCP layer logger for request/response tracking */
const mcpLogger = getKitLogger();

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
			case_sensitive: z
				.boolean()
				.optional()
				.describe("Case sensitive search (default: true)"),
			include: z
				.string()
				.optional()
				.describe('Include files matching pattern. Example: "*.ts"'),
			exclude: z
				.string()
				.optional()
				.describe('Exclude files matching pattern. Example: "*.test.ts"'),
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
		case_sensitive?: boolean;
		include?: string;
		exclude?: string;
		max_results?: number;
		directory?: string;
		response_format?: string;
	}) => {
		const mcpCid = createCorrelationId();
		const mcpStartTime = Date.now();
		mcpLogger.info("MCP tool request", {
			cid: mcpCid,
			tool: "kit_grep",
			args: { pattern: args.pattern, path: args.path },
		});

		// Validate inputs
		const validation = validateGrepInputs({
			pattern: args.pattern,
			path: args.path,
			include: args.include,
			exclude: args.exclude,
			maxResults: args.max_results,
		});

		if (!validation.valid) {
			mcpLogger.warn("MCP validation failed", {
				cid: mcpCid,
				tool: "kit_grep",
				errors: validation.errors,
			});
			return {
				isError: true,
				content: [
					{
						type: "text" as const,
						text: `**Validation Error:**\n\n${validation.errors.join("\n")}`,
					},
				],
			};
		}

		const { validated } = validation;

		// Execute grep
		const result = executeKitGrep({
			pattern: validated!.pattern,
			path: validated!.path,
			caseSensitive: args.case_sensitive,
			include: validated!.include,
			exclude: validated!.exclude,
			maxResults: validated!.maxResults,
			directory: args.directory,
		});

		// Format output
		const format =
			args.response_format === "json"
				? ResponseFormat.JSON
				: ResponseFormat.MARKDOWN;

		const mcpDuration = Date.now() - mcpStartTime;
		mcpLogger.info("MCP tool response", {
			cid: mcpCid,
			tool: "kit_grep",
			success: !isError(result),
			durationMs: mcpDuration,
		});

		return {
			...(isError(result) ? { isError: true } : {}),
			content: [
				{ type: "text" as const, text: formatGrepResults(result, format) },
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
			args: { query: args.query, path: args.path },
		});

		// Validate inputs
		const validation = validateSemanticInputs({
			query: args.query,
			path: args.path,
			topK: args.top_k,
		});

		if (!validation.valid) {
			mcpLogger.warn("MCP validation failed", {
				cid: mcpCid,
				tool: "kit_semantic",
				errors: validation.errors,
			});
			return {
				isError: true,
				content: [
					{
						type: "text" as const,
						text: `**Validation Error:**\n\n${validation.errors.join("\n")}`,
					},
				],
			};
		}

		const { validated } = validation;

		// Execute semantic search
		const result = executeKitSemantic({
			query: validated!.query,
			path: validated!.path,
			topK: validated!.topK,
			chunkBy: args.chunk_by,
			buildIndex: args.build_index,
		});

		// Format output
		const format =
			args.response_format === "json"
				? ResponseFormat.JSON
				: ResponseFormat.MARKDOWN;

		const mcpDuration = Date.now() - mcpStartTime;
		mcpLogger.info("MCP tool response", {
			cid: mcpCid,
			tool: "kit_semantic",
			success: !isError(result),
			durationMs: mcpDuration,
		});

		return {
			...(isError(result) ? { isError: true } : {}),
			content: [
				{ type: "text" as const, text: formatSemanticResults(result, format) },
			],
		};
	},
);

// ============================================================================
// Kit Symbols Tool
// ============================================================================

tool(
	"kit_symbols",
	{
		description: `Extract code symbols (functions, classes, etc.) from the repository.

Lists all defined symbols with their locations. Great for:
- Getting an overview of code structure
- Finding function and class definitions
- Understanding module APIs

TIP: Use the 'file' parameter to extract symbols from a specific file (much faster than scanning entire repo).`,
		inputSchema: {
			path: z
				.string()
				.optional()
				.describe(
					"Repository path to analyze (default: current directory, or KIT_DEFAULT_PATH env var)",
				),
			file: z
				.string()
				.optional()
				.describe(
					"Extract symbols from a specific file only (relative to repo root). Much faster than full repo scan.",
				),
			pattern: z
				.string()
				.optional()
				.describe('Filter files by pattern. Example: "*.ts"'),
			symbol_type: z
				.enum([
					"function",
					"class",
					"variable",
					"type",
					"interface",
					"method",
					"property",
					"constant",
				])
				.optional()
				.describe("Filter by symbol type"),
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
		path?: string;
		file?: string;
		pattern?: string;
		symbol_type?: string;
		response_format?: string;
	}) => {
		const mcpCid = createCorrelationId();
		const mcpStartTime = Date.now();
		mcpLogger.info("MCP tool request", {
			cid: mcpCid,
			tool: "kit_symbols",
			args: { path: args.path, file: args.file },
		});

		// Validate inputs
		const validation = validateSymbolsInputs({
			path: args.path,
			file: args.file,
			pattern: args.pattern,
			symbolType: args.symbol_type,
		});

		if (!validation.valid) {
			mcpLogger.warn("MCP validation failed", {
				cid: mcpCid,
				tool: "kit_symbols",
				errors: validation.errors,
			});
			return {
				isError: true,
				content: [
					{
						type: "text" as const,
						text: `**Validation Error:**\n\n${validation.errors.join("\n")}`,
					},
				],
			};
		}

		const { validated } = validation;

		// Execute symbols extraction
		const result = executeKitSymbols({
			path: validated!.path,
			file: validated!.file,
			pattern: validated!.pattern,
			symbolType: validated!.symbolType,
		});

		// Format output
		const format =
			args.response_format === "json"
				? ResponseFormat.JSON
				: ResponseFormat.MARKDOWN;

		const mcpDuration = Date.now() - mcpStartTime;
		mcpLogger.info("MCP tool response", {
			cid: mcpCid,
			tool: "kit_symbols",
			success: !isError(result),
			durationMs: mcpDuration,
		});

		return {
			...(isError(result) ? { isError: true } : {}),
			content: [
				{ type: "text" as const, text: formatSymbolsResults(result, format) },
			],
		};
	},
);

// ============================================================================
// Kit File Tree Tool
// ============================================================================

tool(
	"kit_file_tree",
	{
		description: `Get the file tree structure of a repository.

Returns all files and directories with their sizes. Great for:
- Understanding repository structure
- Finding files by location
- Exploring unfamiliar codebases

Use 'subpath' to focus on a specific directory.`,
		inputSchema: {
			path: z
				.string()
				.optional()
				.describe(
					"Repository path (default: current directory, or KIT_DEFAULT_PATH env var)",
				),
			subpath: z
				.string()
				.optional()
				.describe(
					'Subdirectory to show tree for (relative to repo root). Example: "src/components"',
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
		path?: string;
		subpath?: string;
		response_format?: string;
	}) => {
		const mcpCid = createCorrelationId();
		const mcpStartTime = Date.now();
		mcpLogger.info("MCP tool request", {
			cid: mcpCid,
			tool: "kit_file_tree",
			args: { path: args.path },
		});

		// Validate inputs
		const validation = validateFileTreeInputs({
			path: args.path,
			subpath: args.subpath,
		});

		if (!validation.valid) {
			mcpLogger.warn("MCP validation failed", {
				cid: mcpCid,
				tool: "kit_file_tree",
				errors: validation.errors,
			});
			return {
				isError: true,
				content: [
					{
						type: "text" as const,
						text: `**Validation Error:**\n\n${validation.errors.join("\n")}`,
					},
				],
			};
		}

		const { validated } = validation;

		// Execute file tree
		const result = executeKitFileTree({
			path: validated!.path,
			subpath: validated!.subpath,
		});

		// Format output
		const format =
			args.response_format === "json"
				? ResponseFormat.JSON
				: ResponseFormat.MARKDOWN;

		const mcpDuration = Date.now() - mcpStartTime;
		mcpLogger.info("MCP tool response", {
			cid: mcpCid,
			tool: "kit_file_tree",
			success: !isError(result),
			durationMs: mcpDuration,
		});

		return {
			...(isError(result) ? { isError: true } : {}),
			content: [
				{ type: "text" as const, text: formatFileTreeResults(result, format) },
			],
		};
	},
);

// ============================================================================
// Kit File Content Tool
// ============================================================================

tool(
	"kit_file_content",
	{
		description: `Get the content of one or more files in the repository.

Retrieves file contents with proper error handling for missing files. Great for:
- Reading multiple related files at once
- Examining implementation details
- Code review workflows

Supports up to 20 files per request.`,
		inputSchema: {
			path: z
				.string()
				.optional()
				.describe(
					"Repository path (default: current directory, or KIT_DEFAULT_PATH env var)",
				),
			file_paths: z
				.array(z.string())
				.describe(
					'File paths to retrieve (relative to repo root). Example: ["src/index.ts", "package.json"]',
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
		path?: string;
		file_paths: string[];
		response_format?: string;
	}) => {
		const mcpCid = createCorrelationId();
		const mcpStartTime = Date.now();
		mcpLogger.info("MCP tool request", {
			cid: mcpCid,
			tool: "kit_file_content",
			args: { path: args.path },
		});

		// Validate inputs
		const validation = validateFileContentInputs({
			path: args.path,
			filePaths: args.file_paths,
		});

		if (!validation.valid) {
			mcpLogger.warn("MCP validation failed", {
				cid: mcpCid,
				tool: "kit_file_content",
				errors: validation.errors,
			});
			return {
				isError: true,
				content: [
					{
						type: "text" as const,
						text: `**Validation Error:**\n\n${validation.errors.join("\n")}`,
					},
				],
			};
		}

		const { validated } = validation;

		// Execute file content retrieval
		const result = executeKitFileContent({
			path: validated!.path,
			filePaths: validated!.filePaths,
		});

		// Format output
		const format =
			args.response_format === "json"
				? ResponseFormat.JSON
				: ResponseFormat.MARKDOWN;

		const mcpDuration = Date.now() - mcpStartTime;
		mcpLogger.info("MCP tool response", {
			cid: mcpCid,
			tool: "kit_file_content",
			success: !isError(result),
			durationMs: mcpDuration,
		});

		return {
			...(isError(result) ? { isError: true } : {}),
			content: [
				{
					type: "text" as const,
					text: formatFileContentResults(result, format),
				},
			],
		};
	},
);

// ============================================================================
// Kit Usages Tool
// ============================================================================

tool(
	"kit_usages",
	{
		description: `Find where a symbol is defined in the codebase (AST-powered).

Uses tree-sitter AST parsing to locate symbol definitions. Great for:
- Finding where a function/class is declared
- Locating type definitions
- Understanding code structure

NOTE: This finds DEFINITIONS, not all references/usages.`,
		inputSchema: {
			path: z
				.string()
				.optional()
				.describe(
					"Repository path (default: current directory, or KIT_DEFAULT_PATH env var)",
				),
			symbol_name: z
				.string()
				.describe(
					'Name of the symbol to find definitions for. Example: "AuthService"',
				),
			symbol_type: z
				.enum([
					"function",
					"class",
					"variable",
					"type",
					"interface",
					"method",
					"property",
					"constant",
				])
				.optional()
				.describe("Filter by symbol type"),
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
		path?: string;
		symbol_name: string;
		symbol_type?: string;
		response_format?: string;
	}) => {
		const mcpCid = createCorrelationId();
		const mcpStartTime = Date.now();
		mcpLogger.info("MCP tool request", {
			cid: mcpCid,
			tool: "kit_usages",
			args: { path: args.path },
		});

		// Validate inputs
		const validation = validateUsagesInputs({
			path: args.path,
			symbolName: args.symbol_name,
			symbolType: args.symbol_type,
		});

		if (!validation.valid) {
			mcpLogger.warn("MCP validation failed", {
				cid: mcpCid,
				tool: "kit_usages",
				errors: validation.errors,
			});
			return {
				isError: true,
				content: [
					{
						type: "text" as const,
						text: `**Validation Error:**\n\n${validation.errors.join("\n")}`,
					},
				],
			};
		}

		const { validated } = validation;

		// Execute usages search
		const result = executeKitUsages({
			path: validated!.path,
			symbolName: validated!.symbolName,
			symbolType: validated!.symbolType,
		});

		// Format output
		const format =
			args.response_format === "json"
				? ResponseFormat.JSON
				: ResponseFormat.MARKDOWN;

		const mcpDuration = Date.now() - mcpStartTime;
		mcpLogger.info("MCP tool response", {
			cid: mcpCid,
			tool: "kit_usages",
			success: !isError(result),
			durationMs: mcpDuration,
		});

		return {
			...(isError(result) ? { isError: true } : {}),
			content: [
				{ type: "text" as const, text: formatUsagesResults(result, format) },
			],
		};
	},
);

// ============================================================================
// Kit AST Search Tool
// ============================================================================

tool(
	"kit_ast_search",
	{
		description: `Search code using AST patterns (tree-sitter powered).

Find code by structure rather than text. Supports two modes:

**Simple mode** (default):
- "async function" - Find async function declarations
- "function" - Find all function declarations
- "class" - Find class definitions
- "try" - Find try statements
- "import" - Find import statements
- "export" - Find export statements

**Pattern mode** (JSON criteria):
- {"type": "function_declaration"} - Find by node type
- {"type": "function_declaration", "async": true} - With modifiers
- {"type": "class_declaration", "name": "MyClass"} - By name
- {"textMatch": "TODO"} - Text within nodes

Supports TypeScript, JavaScript, and Python files.

Examples:
- kit_ast_search("async function") - All async functions
- kit_ast_search("class") - All class definitions
- kit_ast_search('{"type": "arrow_function"}', mode="pattern")`,
		inputSchema: {
			pattern: z.string().describe("Search pattern (natural language or JSON)"),
			mode: z
				.enum(["simple", "pattern"])
				.optional()
				.describe("Search mode: 'simple' (default) or 'pattern'"),
			file_pattern: z
				.string()
				.optional()
				.describe('File glob pattern (e.g., "*.ts", "**/*.tsx")'),
			path: z
				.string()
				.optional()
				.describe(
					"Repository path (default: current directory, or KIT_DEFAULT_PATH env var)",
				),
			max_results: z
				.number()
				.optional()
				.describe("Maximum results to return (default: 100, max: 500)"),
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
		mode?: "simple" | "pattern";
		file_pattern?: string;
		path?: string;
		max_results?: number;
		response_format?: string;
	}) => {
		const mcpCid = createCorrelationId();
		const mcpStartTime = Date.now();
		mcpLogger.info("MCP tool request", {
			cid: mcpCid,
			tool: "kit_ast_search",
			args: { pattern: args.pattern, path: args.path },
		});

		// Validate inputs
		const validation = validateAstSearchInputs({
			pattern: args.pattern,
			mode: args.mode,
			filePattern: args.file_pattern,
			path: args.path,
			maxResults: args.max_results,
		});

		if (!validation.valid) {
			mcpLogger.warn("MCP validation failed", {
				cid: mcpCid,
				tool: "kit_ast_search",
				errors: validation.errors,
			});
			return {
				isError: true,
				content: [
					{
						type: "text" as const,
						text: `**Validation Error:**\n\n${validation.errors.join("\n")}`,
					},
				],
			};
		}

		const { validated } = validation;

		// Execute AST search
		const result = await executeAstSearch({
			pattern: validated!.pattern,
			mode:
				validated!.mode === "pattern" ? SearchMode.PATTERN : SearchMode.SIMPLE,
			filePattern: validated!.filePattern,
			path: validated!.path,
			maxResults: validated!.maxResults,
		});

		// Format output
		const format =
			args.response_format === "json"
				? ResponseFormat.JSON
				: ResponseFormat.MARKDOWN;

		const mcpDuration = Date.now() - mcpStartTime;
		mcpLogger.info("MCP tool response", {
			cid: mcpCid,
			tool: "kit_ast_search",
			success: !isError(result),
			durationMs: mcpDuration,
		});

		return {
			...(isError(result) ? { isError: true } : {}),
			content: [
				{ type: "text" as const, text: formatAstSearchResults(result, format) },
			],
		};
	},
);

// ============================================================================
// Start Server
// ============================================================================

startServer();
