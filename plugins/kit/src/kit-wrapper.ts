/**
 * Kit CLI Wrapper
 *
 * Pure functions for executing Kit CLI commands with proper error handling.
 * Uses spawnSync for synchronous execution to fit MCP tool patterns.
 */

import {
	type SpawnSyncOptionsWithStringEncoding,
	spawnSync,
} from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Get enhanced PATH that includes common tool installation directories.
 * This ensures kit can be found even when running in non-interactive shells
 * (like Claude Code's MCP servers) that don't source .zshrc/.bashrc.
 */
function getEnhancedPath(): string {
	const currentPath = process.env.PATH || "";
	const home = homedir();

	// Common locations for uv/pipx installed tools
	const additionalPaths = [
		join(home, ".local", "bin"),
		"/opt/homebrew/bin",
		"/usr/local/bin",
	];

	// Add paths that aren't already in PATH
	const pathsToAdd = additionalPaths.filter(
		(p) => !currentPath.split(":").includes(p),
	);

	return pathsToAdd.length > 0
		? `${pathsToAdd.join(":")}:${currentPath}`
		: currentPath;
}

import {
	ASTSearcher,
	type ASTSearchOptions,
	type ASTSearchResult,
} from "./ast/index.js";
import {
	createErrorFromOutput,
	isSemanticUnavailableError,
	isTimeoutError,
	KitError,
	KitErrorType,
	SEMANTIC_INSTALL_HINT,
} from "./errors.js";
import {
	astLogger,
	commitLogger,
	createCorrelationId,
	fileContentLogger,
	fileTreeLogger,
	grepLogger,
	semanticLogger,
	summarizeLogger,
	symbolsLogger,
	usagesLogger,
} from "./logger.js";
import type {
	CodeSymbol,
	CommitOptions,
	CommitResult,
	FileContent,
	FileContentOptions,
	FileContentResult,
	FileTreeEntry,
	FileTreeOptions,
	FileTreeResult,
	GrepMatch,
	GrepOptions,
	GrepResult,
	KitResult,
	SemanticMatch,
	SemanticOptions,
	SemanticResult,
	SummarizeOptions,
	SummarizeResult,
	SymbolsOptions,
	SymbolsResult,
	SymbolUsage,
	UsagesOptions,
	UsagesResult,
} from "./types.js";
import {
	COMMIT_TIMEOUT,
	FILE_CONTENT_TIMEOUT,
	FILE_TREE_TIMEOUT,
	GREP_TIMEOUT,
	getDefaultKitPath,
	SEMANTIC_TIMEOUT,
	SUMMARIZE_TIMEOUT,
	SYMBOLS_TIMEOUT,
	USAGES_TIMEOUT,
} from "./types.js";

// ============================================================================
// Kit CLI Execution
// ============================================================================

/**
 * Check if Kit CLI is installed and available in PATH.
 * @returns True if kit command is available
 */
export function isKitInstalled(): boolean {
	try {
		const result = spawnSync("kit", ["--version"], {
			encoding: "utf8",
			timeout: 5000,
			env: {
				...process.env,
				PATH: getEnhancedPath(),
			},
		});
		return result.status === 0;
	} catch {
		return false;
	}
}

/**
 * Get Kit CLI version.
 * @returns Version string or null if not installed
 */
export function getKitVersion(): string | null {
	try {
		const result = spawnSync("kit", ["--version"], {
			encoding: "utf8",
			timeout: 5000,
			env: {
				...process.env,
				PATH: getEnhancedPath(),
			},
		});
		if (result.status === 0 && result.stdout) {
			return result.stdout.trim();
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Execute a Kit CLI command.
 * @param args - Arguments to pass to kit
 * @param options - Execution options
 * @returns Execution result with stdout, stderr, and exit code
 */
function executeKit(
	args: string[],
	options: {
		timeout?: number;
		cwd?: string;
	} = {},
): { stdout: string; stderr: string; exitCode: number } {
	const { timeout = 30000, cwd } = options;

	const spawnOptions: SpawnSyncOptionsWithStringEncoding = {
		encoding: "utf8",
		timeout,
		maxBuffer: 10 * 1024 * 1024, // 10MB
		env: {
			...process.env,
			PATH: getEnhancedPath(),
		},
		...(cwd && { cwd }),
	};

	const result = spawnSync("kit", args, spawnOptions);

	// Handle spawn errors (e.g., command not found)
	if (result.error) {
		const errorMessage = result.error.message || "Failed to execute kit";
		return {
			stdout: "",
			stderr: errorMessage,
			exitCode: 1,
		};
	}

	return {
		stdout: result.stdout || "",
		stderr: result.stderr || "",
		exitCode: result.status ?? 1,
	};
}

// ============================================================================
// Grep Execution
// ============================================================================

/**
 * Raw grep match as returned by Kit CLI.
 */
interface RawGrepMatch {
	file: string;
	line_number: number;
	line_content: string;
}

/**
 * Execute kit grep command.
 * @param options - Grep options
 * @returns Grep result or error
 */
export function executeKitGrep(options: GrepOptions): KitResult<GrepResult> {
	const cid = createCorrelationId();
	const startTime = Date.now();

	// Check if Kit is installed
	if (!isKitInstalled()) {
		grepLogger.error("Kit not installed", { cid });
		return new KitError(KitErrorType.KitNotInstalled).toJSON();
	}

	const {
		pattern,
		path = getDefaultKitPath(),
		caseSensitive = true,
		include,
		exclude,
		maxResults = 100,
		directory,
	} = options;

	// Build command arguments
	const args: string[] = ["grep", path, pattern];

	// Add options
	if (!caseSensitive) {
		args.push("--ignore-case");
	}

	if (include) {
		args.push("--include", include);
	}

	if (exclude) {
		args.push("--exclude", exclude);
	}

	args.push("--max-results", String(maxResults));

	if (directory) {
		args.push("--directory", directory);
	}

	// Use temp file for JSON output (kit grep doesn't support --format json)
	const tempFile = join(tmpdir(), `kit-grep-${cid}.json`);
	args.push("--output", tempFile);

	grepLogger.info("Executing kit grep", {
		cid,
		pattern,
		path,
		args,
	});

	try {
		const result = executeKit(args, { timeout: GREP_TIMEOUT });

		// Check for errors
		if (result.exitCode !== 0) {
			grepLogger.error("Grep failed", {
				cid,
				exitCode: result.exitCode,
				stderr: result.stderr,
				durationMs: Date.now() - startTime,
			});

			// Clean up temp file if it exists
			if (existsSync(tempFile)) {
				rmSync(tempFile);
			}

			return createErrorFromOutput(result.stderr, result.exitCode).toJSON();
		}

		// Read and parse JSON output
		if (!existsSync(tempFile)) {
			grepLogger.error("Temp file not created", { cid });
			return new KitError(
				KitErrorType.OutputParseError,
				"Grep completed but output file not found",
			).toJSON();
		}

		const jsonContent = readFileSync(tempFile, "utf8");
		rmSync(tempFile); // Clean up

		let rawMatches: RawGrepMatch[];
		try {
			rawMatches = JSON.parse(jsonContent);
		} catch {
			grepLogger.error("Failed to parse grep output", { cid, jsonContent });
			return new KitError(
				KitErrorType.OutputParseError,
				"Failed to parse grep JSON output",
			).toJSON();
		}

		// Transform to our format
		const matches: GrepMatch[] = rawMatches.map((m) => ({
			file: m.file,
			line: m.line_number,
			content: m.line_content,
		}));

		grepLogger.info("Grep completed", {
			cid,
			pattern,
			matchCount: matches.length,
			durationMs: Date.now() - startTime,
		});

		return {
			count: matches.length,
			matches,
			pattern,
			path,
		};
	} catch (error) {
		// Clean up temp file if it exists
		if (existsSync(tempFile)) {
			rmSync(tempFile);
		}

		const message = error instanceof Error ? error.message : "Unknown error";
		grepLogger.error("Grep threw exception", { cid, error: message });
		return new KitError(KitErrorType.KitCommandFailed, message).toJSON();
	}
}

// ============================================================================
// Symbols Execution
// ============================================================================

/**
 * Raw symbol as returned by Kit CLI.
 */
interface RawSymbol {
	name: string;
	type: string;
	file: string;
	start_line: number;
	end_line?: number;
	code?: string;
}

/**
 * Execute kit symbols command.
 * @param options - Symbols options
 * @returns Symbols result or error
 */
export function executeKitSymbols(
	options: SymbolsOptions,
): KitResult<SymbolsResult> {
	const cid = createCorrelationId();
	const startTime = Date.now();

	// Check if Kit is installed
	if (!isKitInstalled()) {
		symbolsLogger.error("Kit not installed", { cid });
		return new KitError(KitErrorType.KitNotInstalled).toJSON();
	}

	const { path = getDefaultKitPath(), pattern, symbolType, file } = options;

	// Build command arguments
	const args: string[] = ["symbols", path, "--format", "json"];

	// Add file filter if specified (much faster than full repo scan)
	if (file) {
		args.push("--file", file);
	}

	if (pattern) {
		// Kit symbols doesn't have a pattern filter, we'll filter in post
	}

	symbolsLogger.info("Executing kit symbols", {
		cid,
		path,
		pattern,
		symbolType,
	});

	try {
		const result = executeKit(args, { timeout: SYMBOLS_TIMEOUT });

		// Check for errors
		if (result.exitCode !== 0) {
			symbolsLogger.error("Symbols failed", {
				cid,
				exitCode: result.exitCode,
				stderr: result.stderr,
				durationMs: Date.now() - startTime,
			});
			return createErrorFromOutput(result.stderr, result.exitCode).toJSON();
		}

		// Parse JSON output
		let rawSymbols: RawSymbol[];
		try {
			rawSymbols = JSON.parse(result.stdout);
		} catch {
			symbolsLogger.error("Failed to parse symbols output", {
				cid,
				stdout: result.stdout,
			});
			return new KitError(
				KitErrorType.OutputParseError,
				"Failed to parse symbols JSON output",
			).toJSON();
		}

		// Transform and filter
		let symbols: CodeSymbol[] = rawSymbols.map((s) => ({
			name: s.name,
			type: s.type,
			file: s.file,
			startLine: s.start_line,
			endLine: s.end_line,
			code: s.code,
		}));

		// Filter by symbol type if specified
		if (symbolType) {
			symbols = symbols.filter(
				(s) => s.type.toLowerCase() === symbolType.toLowerCase(),
			);
		}

		// Filter by file pattern if specified (simple glob matching)
		if (pattern) {
			const regex = globToRegex(pattern);
			symbols = symbols.filter((s) => regex.test(s.file));
		}

		symbolsLogger.info("Symbols completed", {
			cid,
			symbolCount: symbols.length,
			durationMs: Date.now() - startTime,
		});

		return {
			count: symbols.length,
			symbols,
			path,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		symbolsLogger.error("Symbols threw exception", { cid, error: message });
		return new KitError(KitErrorType.KitCommandFailed, message).toJSON();
	}
}

// ============================================================================
// Semantic Search Execution
// ============================================================================

/**
 * Raw semantic match as returned by Kit CLI.
 */
interface RawSemanticMatch {
	file: string;
	code: string;
	name?: string;
	type?: string;
	score: number;
	start_line?: number;
	end_line?: number;
}

/**
 * Execute kit semantic search command.
 * @param options - Semantic search options
 * @returns Semantic result or error (with fallback to grep)
 */
export function executeKitSemantic(
	options: SemanticOptions,
): KitResult<SemanticResult> {
	const cid = createCorrelationId();
	const startTime = Date.now();

	// Check if Kit is installed
	if (!isKitInstalled()) {
		semanticLogger.error("Kit not installed", { cid });
		return new KitError(KitErrorType.KitNotInstalled).toJSON();
	}

	const {
		query,
		path = getDefaultKitPath(),
		topK = 5,
		chunkBy = "symbols",
		buildIndex = false,
	} = options;

	// Pre-flight check: if index not built and not forcing build, tell user to build it first
	if (!buildIndex && !isSemanticIndexBuilt(path)) {
		semanticLogger.info("Semantic index not built, instructing user to build", {
			cid,
			path,
		});

		const buildCommand = `kit search-semantic "${path}" "${query}" --build-index`;
		const error = new KitError(
			KitErrorType.SemanticIndexNotBuilt,
			`To use semantic search, build the vector index with:\n\n  ${buildCommand}\n\nAfter building (one-time), semantic search will be fast and cached.`,
		);
		return error.toJSON();
	}

	// Get global cache directory for this repo's vector index
	const persistDir = getSemanticCacheDir(path);

	// Build command arguments
	const args: string[] = [
		"search-semantic",
		path,
		query,
		"--top-k",
		String(topK),
		"--format",
		"json",
		"--chunk-by",
		chunkBy,
		"--persist-dir",
		persistDir,
	];

	if (buildIndex) {
		args.push("--build-index");
	}

	semanticLogger.info("Executing kit semantic search", {
		cid,
		query,
		path,
		topK,
		chunkBy,
		persistDir,
	});

	try {
		const result = executeKit(args, { timeout: SEMANTIC_TIMEOUT });

		// Check for semantic search unavailable (ML deps not installed)
		// Note: kit writes error messages to stdout, not stderr
		const combinedOutput = `${result.stdout}\n${result.stderr}`;
		if (result.exitCode !== 0 && isSemanticUnavailableError(combinedOutput)) {
			semanticLogger.warn("Semantic search unavailable, falling back to grep", {
				cid,
				output: combinedOutput.slice(0, 200),
			});

			// Fall back to grep search
			return fallbackToGrep(query, path, topK, cid);
		}

		// Check for timeout - DO NOT fall back to grep as it would also timeout
		if (result.exitCode !== 0 && isTimeoutError(combinedOutput)) {
			semanticLogger.warn("Semantic search timed out on large repository", {
				cid,
				query,
				durationMs: Date.now() - startTime,
			});
			return new KitError(
				KitErrorType.Timeout,
				`Semantic search timed out after ${SEMANTIC_TIMEOUT}ms. On first run, building the vector index may take longer. Try again to use the cached index.`,
			).toJSON();
		}

		// Check for other errors
		if (result.exitCode !== 0) {
			semanticLogger.error("Semantic search failed", {
				cid,
				exitCode: result.exitCode,
				output: combinedOutput.slice(0, 500),
				durationMs: Date.now() - startTime,
			});
			return createErrorFromOutput(combinedOutput, result.exitCode).toJSON();
		}

		// Parse JSON output
		let rawMatches: RawSemanticMatch[];
		try {
			rawMatches = JSON.parse(result.stdout);
		} catch {
			semanticLogger.error("Failed to parse semantic output", {
				cid,
				stdout: result.stdout,
			});
			return new KitError(
				KitErrorType.OutputParseError,
				"Failed to parse semantic search JSON output",
			).toJSON();
		}

		// Transform to our format
		const matches: SemanticMatch[] = rawMatches.map((m) => ({
			file: m.file,
			chunk: m.code,
			score: m.score,
			startLine: m.start_line,
			endLine: m.end_line,
		}));

		semanticLogger.info("Semantic search completed", {
			cid,
			query,
			matchCount: matches.length,
			durationMs: Date.now() - startTime,
		});

		return {
			count: matches.length,
			matches,
			query,
			path,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		semanticLogger.error("Semantic search threw exception", {
			cid,
			error: message,
		});
		return new KitError(KitErrorType.KitCommandFailed, message).toJSON();
	}
}

/**
 * Fall back to grep when semantic search is unavailable.
 */
function fallbackToGrep(
	query: string,
	path: string,
	limit: number,
	cid: string,
): KitResult<SemanticResult> {
	// Extract keywords from the query for grep
	const keywords = query
		.split(/\s+/)
		.filter((w) => w.length > 2)
		.slice(0, 3);

	const pattern = keywords.join("|");

	semanticLogger.info("Fallback grep search", { cid, pattern, path });

	const grepResult = executeKitGrep({
		pattern,
		path,
		maxResults: limit,
		caseSensitive: false,
	});

	if ("error" in grepResult) {
		return grepResult;
	}

	// Convert grep matches to semantic format
	// Score decreases by 0.05 per result, with minimum of 0.1 to avoid negative scores
	const matches: SemanticMatch[] = grepResult.matches.map((m, idx) => ({
		file: m.file,
		chunk: m.content,
		score: Math.max(0.1, 1 - idx * 0.05),
		startLine: m.line,
		endLine: m.line,
	}));

	return {
		count: matches.length,
		matches,
		query,
		path,
		fallback: true,
		installHint: SEMANTIC_INSTALL_HINT,
	};
}

// ============================================================================
// File Tree Execution
// ============================================================================

/**
 * Raw file tree entry as returned by Kit CLI.
 */
interface RawFileTreeEntry {
	path: string;
	name: string;
	is_dir: boolean;
	size: number;
}

/**
 * Execute kit file-tree command.
 * @param options - File tree options
 * @returns File tree result or error
 */
export function executeKitFileTree(
	options: FileTreeOptions,
): KitResult<FileTreeResult> {
	const cid = createCorrelationId();
	const startTime = Date.now();

	// Check if Kit is installed
	if (!isKitInstalled()) {
		fileTreeLogger.error("Kit not installed", { cid });
		return new KitError(KitErrorType.KitNotInstalled).toJSON();
	}

	const { path = getDefaultKitPath(), subpath } = options;

	// Use temp file for JSON output
	const tempFile = join(tmpdir(), `kit-file-tree-${cid}.json`);

	// Build command arguments
	const args: string[] = ["file-tree", path, "--output", tempFile];

	if (subpath) {
		args.push("--path", subpath);
	}

	fileTreeLogger.info("Executing kit file-tree", {
		cid,
		path,
		subpath,
		args,
	});

	try {
		const result = executeKit(args, { timeout: FILE_TREE_TIMEOUT });

		// Check for errors
		if (result.exitCode !== 0) {
			fileTreeLogger.error("File tree failed", {
				cid,
				exitCode: result.exitCode,
				stderr: result.stderr,
				durationMs: Date.now() - startTime,
			});

			// Clean up temp file if it exists
			if (existsSync(tempFile)) {
				rmSync(tempFile);
			}

			return createErrorFromOutput(result.stderr, result.exitCode).toJSON();
		}

		// Read and parse JSON output
		if (!existsSync(tempFile)) {
			fileTreeLogger.error("Temp file not created", { cid });
			return new KitError(
				KitErrorType.OutputParseError,
				"File tree completed but output file not found",
			).toJSON();
		}

		const jsonContent = readFileSync(tempFile, "utf8");
		rmSync(tempFile); // Clean up

		let rawEntries: RawFileTreeEntry[];
		try {
			rawEntries = JSON.parse(jsonContent);
		} catch {
			fileTreeLogger.error("Failed to parse file tree output", {
				cid,
				jsonContent,
			});
			return new KitError(
				KitErrorType.OutputParseError,
				"Failed to parse file tree JSON output",
			).toJSON();
		}

		// Transform to our format
		const entries: FileTreeEntry[] = rawEntries.map((e) => ({
			path: e.path,
			name: e.name,
			isDir: e.is_dir,
			size: e.size,
		}));

		fileTreeLogger.info("File tree completed", {
			cid,
			entryCount: entries.length,
			durationMs: Date.now() - startTime,
		});

		return {
			count: entries.length,
			entries,
			path,
			subpath,
		};
	} catch (error) {
		// Clean up temp file if it exists
		if (existsSync(tempFile)) {
			rmSync(tempFile);
		}

		const message = error instanceof Error ? error.message : "Unknown error";
		fileTreeLogger.error("File tree threw exception", { cid, error: message });
		return new KitError(KitErrorType.KitCommandFailed, message).toJSON();
	}
}

// ============================================================================
// File Content Execution
// ============================================================================

/**
 * Execute kit file-content command.
 * @param options - File content options
 * @returns File content result or error
 */
export function executeKitFileContent(
	options: FileContentOptions,
): KitResult<FileContentResult> {
	const cid = createCorrelationId();
	const startTime = Date.now();

	// Check if Kit is installed
	if (!isKitInstalled()) {
		fileContentLogger.error("Kit not installed", { cid });
		return new KitError(KitErrorType.KitNotInstalled).toJSON();
	}

	const { path = getDefaultKitPath(), filePaths } = options;

	if (!filePaths || filePaths.length === 0) {
		return new KitError(
			KitErrorType.InvalidInput,
			"At least one file path is required",
		).toJSON();
	}

	fileContentLogger.info("Executing kit file-content", {
		cid,
		path,
		fileCount: filePaths.length,
	});

	// Fetch each file individually to get proper error handling per file
	const files: FileContent[] = [];

	for (const filePath of filePaths) {
		const args: string[] = ["file-content", path, filePath];

		try {
			const result = executeKit(args, { timeout: FILE_CONTENT_TIMEOUT });

			if (result.exitCode !== 0) {
				// File not found or other error
				files.push({
					file: filePath,
					content: "",
					found: false,
					error: result.stderr.trim() || "File not found",
				});
			} else {
				files.push({
					file: filePath,
					content: result.stdout,
					found: true,
				});
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			fileContentLogger.warn("Failed to fetch file content", {
				cid,
				filePath,
				error: message,
			});
			files.push({
				file: filePath,
				content: "",
				found: false,
				error: message,
			});
		}
	}

	fileContentLogger.info("File content completed", {
		cid,
		fileCount: files.length,
		foundCount: files.filter((f) => f.found).length,
		durationMs: Date.now() - startTime,
	});

	return {
		count: files.length,
		files,
		path,
	};
}

// ============================================================================
// Symbol Usages Execution
// ============================================================================

/**
 * Raw symbol usage as returned by Kit CLI.
 */
interface RawSymbolUsage {
	file: string;
	type: string;
	name: string;
	line: number | null;
	context: string | null;
}

/**
 * Execute kit usages command to find symbol definitions.
 * @param options - Usages options
 * @returns Usages result or error
 */
export function executeKitUsages(
	options: UsagesOptions,
): KitResult<UsagesResult> {
	const cid = createCorrelationId();
	const startTime = Date.now();

	// Check if Kit is installed
	if (!isKitInstalled()) {
		usagesLogger.error("Kit not installed", { cid });
		return new KitError(KitErrorType.KitNotInstalled).toJSON();
	}

	const { path = getDefaultKitPath(), symbolName, symbolType } = options;

	if (!symbolName || symbolName.trim() === "") {
		return new KitError(
			KitErrorType.InvalidInput,
			"Symbol name is required",
		).toJSON();
	}

	// Use temp file for JSON output
	const tempFile = join(tmpdir(), `kit-usages-${cid}.json`);

	// Build command arguments
	const args: string[] = [
		"usages",
		path,
		symbolName.trim(),
		"--output",
		tempFile,
	];

	if (symbolType) {
		args.push("--type", symbolType);
	}

	usagesLogger.info("Executing kit usages", {
		cid,
		path,
		symbolName,
		symbolType,
		args,
	});

	try {
		const result = executeKit(args, { timeout: USAGES_TIMEOUT });

		// Check for errors
		if (result.exitCode !== 0) {
			usagesLogger.error("Usages failed", {
				cid,
				exitCode: result.exitCode,
				stderr: result.stderr,
				durationMs: Date.now() - startTime,
			});

			// Clean up temp file if it exists
			if (existsSync(tempFile)) {
				rmSync(tempFile);
			}

			return createErrorFromOutput(result.stderr, result.exitCode).toJSON();
		}

		// Read and parse JSON output
		if (!existsSync(tempFile)) {
			usagesLogger.error("Temp file not created", { cid });
			return new KitError(
				KitErrorType.OutputParseError,
				"Usages completed but output file not found",
			).toJSON();
		}

		const jsonContent = readFileSync(tempFile, "utf8");
		rmSync(tempFile); // Clean up

		let rawUsages: RawSymbolUsage[];
		try {
			rawUsages = JSON.parse(jsonContent);
		} catch {
			usagesLogger.error("Failed to parse usages output", {
				cid,
				jsonContent,
			});
			return new KitError(
				KitErrorType.OutputParseError,
				"Failed to parse usages JSON output",
			).toJSON();
		}

		// Transform to our format
		const usages: SymbolUsage[] = rawUsages.map((u) => ({
			file: u.file,
			type: u.type,
			name: u.name,
			line: u.line,
			context: u.context,
		}));

		usagesLogger.info("Usages completed", {
			cid,
			symbolName,
			usageCount: usages.length,
			durationMs: Date.now() - startTime,
		});

		return {
			count: usages.length,
			usages,
			symbolName: symbolName.trim(),
			path,
		};
	} catch (error) {
		// Clean up temp file if it exists
		if (existsSync(tempFile)) {
			rmSync(tempFile);
		}

		const message = error instanceof Error ? error.message : "Unknown error";
		usagesLogger.error("Usages threw exception", { cid, error: message });
		return new KitError(KitErrorType.KitCommandFailed, message).toJSON();
	}
}

// ============================================================================
// Commit Execution
// ============================================================================

/**
 * Execute kit commit command to generate AI-powered commit messages.
 * @param options - Commit options
 * @returns Commit result or error
 */
export function executeKitCommit(
	options: CommitOptions,
): KitResult<CommitResult> {
	const cid = createCorrelationId();
	const startTime = Date.now();

	// Check if Kit is installed
	if (!isKitInstalled()) {
		commitLogger.error("Kit not installed", { cid });
		return new KitError(KitErrorType.KitNotInstalled).toJSON();
	}

	const { dryRun = true, model, cwd } = options;

	// Build command arguments
	const args: string[] = ["commit"];

	if (dryRun) {
		args.push("--dry-run");
	}

	if (model) {
		args.push("--model", model);
	}

	commitLogger.info("Executing kit commit", {
		cid,
		dryRun,
		model,
		cwd,
		args,
	});

	try {
		const result = executeKit(args, { timeout: COMMIT_TIMEOUT, cwd });

		// Check for errors
		if (result.exitCode !== 0) {
			commitLogger.error("Commit failed", {
				cid,
				exitCode: result.exitCode,
				stderr: result.stderr,
				durationMs: Date.now() - startTime,
			});
			return createErrorFromOutput(result.stderr, result.exitCode).toJSON();
		}

		// Parse output - kit commit writes to stdout
		const output = result.stdout.trim();

		commitLogger.info("Commit completed", {
			cid,
			dryRun,
			committed: !dryRun,
			durationMs: Date.now() - startTime,
		});

		return {
			message: output,
			committed: !dryRun,
			model,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		commitLogger.error("Commit threw exception", { cid, error: message });
		return new KitError(KitErrorType.KitCommandFailed, message).toJSON();
	}
}

// ============================================================================
// AST Search Execution (tree-sitter powered)
// ============================================================================

/** Default timeout for AST search operations (ms) */
const AST_SEARCH_TIMEOUT = 60000;

/**
 * Execute AST-based code search using tree-sitter.
 *
 * Unlike other Kit commands, this uses an internal tree-sitter
 * implementation rather than shelling out to the Kit CLI.
 *
 * @param options - AST search options
 * @returns AST search result or error
 */
export async function executeAstSearch(
	options: ASTSearchOptions,
): Promise<KitResult<ASTSearchResult>> {
	const cid = createCorrelationId();
	const startTime = Date.now();

	const { pattern, mode, filePattern, path, maxResults } = options;

	astLogger.info("Executing AST search", {
		cid,
		pattern,
		mode,
		filePattern,
		path,
		maxResults,
	});

	try {
		const searcher = new ASTSearcher(path);

		// Use Promise.race with timeout
		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(
				() => reject(new Error("AST search timed out")),
				AST_SEARCH_TIMEOUT,
			);
		});

		const result = await Promise.race([
			searcher.searchPattern(options),
			timeoutPromise,
		]);

		astLogger.info("AST search completed", {
			cid,
			pattern,
			matchCount: result.count,
			durationMs: Date.now() - startTime,
		});

		return result;
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		astLogger.error("AST search failed", { cid, error: message });
		return new KitError(KitErrorType.KitCommandFailed, message).toJSON();
	}
}

// ============================================================================
// Summarize Execution
// ============================================================================

/**
 * Execute kit summarize command to generate PR summary.
 * @param options - Summarize options
 * @returns Summarize result or error
 */
export function executeKitSummarize(
	options: SummarizeOptions,
): KitResult<SummarizeResult> {
	const cid = createCorrelationId();
	const startTime = Date.now();

	// Check if Kit is installed
	if (!isKitInstalled()) {
		summarizeLogger.error("Kit not installed", { cid });
		return new KitError(KitErrorType.KitNotInstalled).toJSON();
	}

	const {
		prUrl,
		updatePrBody = false, // Default to false for safety
		model,
		repoPath,
	} = options;

	// Build command arguments
	const args: string[] = ["summarize", prUrl];

	// Add flags
	if (updatePrBody) {
		args.push("--update-pr-body");
	}

	if (model) {
		args.push("--model", model);
	}

	if (repoPath) {
		args.push("--repo-path", repoPath);
	}

	// Use --plain for consistent output (no formatting)
	args.push("--plain");

	summarizeLogger.info("Executing kit summarize", {
		cid,
		prUrl,
		updatePrBody,
		model,
		repoPath,
	});

	try {
		const result = executeKit(args, { timeout: SUMMARIZE_TIMEOUT });

		// Check for errors
		if (result.exitCode !== 0) {
			summarizeLogger.error("Summarize failed", {
				cid,
				exitCode: result.exitCode,
				stderr: result.stderr,
				durationMs: Date.now() - startTime,
			});
			return createErrorFromOutput(result.stderr, result.exitCode).toJSON();
		}

		// Extract summary from stdout
		const summary = result.stdout.trim();

		if (!summary) {
			summarizeLogger.error("Empty summary returned", { cid });
			return new KitError(
				KitErrorType.OutputParseError,
				"Summarize completed but returned empty output",
			).toJSON();
		}

		summarizeLogger.info("Summarize completed", {
			cid,
			prUrl,
			updated: updatePrBody,
			summaryLength: summary.length,
			durationMs: Date.now() - startTime,
		});

		return {
			prUrl,
			summary,
			updated: updatePrBody,
			...(model && { model }),
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		summarizeLogger.error("Summarize threw exception", {
			cid,
			error: message,
		});
		return new KitError(KitErrorType.KitCommandFailed, message).toJSON();
	}
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Convert a simple glob pattern to a regex.
 * Supports * and ** patterns.
 */
function globToRegex(pattern: string): RegExp {
	const escaped = pattern
		.replace(/[.+^${}()|[\]\\]/g, "\\$&")
		.replace(/\*\*/g, "{{GLOBSTAR}}")
		.replace(/\*/g, "[^/]*")
		.replace(/{{GLOBSTAR}}/g, ".*");

	return new RegExp(escaped);
}

/**
 * Get the persist directory for a repo's semantic search vector index.
 * Creates the directory if it doesn't exist.
 *
 * Per-repo caching strategy: Each repository gets its own .kit/vector_db/
 * directory for isolated, portable vector indexes. This ensures:
 * - Cache is scoped to the repo being searched
 * - No cross-contamination between different repos
 * - Cache travels with the repo context in Claude Code sessions
 * - Easy cleanup (delete .kit/ when done with project)
 *
 * Structure: <repo-path>/.kit/vector_db/
 *
 * @param repoPath - Absolute path to the repository
 * @returns Path to the persist directory for this repo's vector index
 */
export function getSemanticCacheDir(repoPath: string): string {
	const cacheDir = join(repoPath, ".kit", "vector_db");

	// Ensure directory exists
	if (!existsSync(cacheDir)) {
		mkdirSync(cacheDir, { recursive: true });
	}

	return cacheDir;
}

/**
 * Check if semantic search vector index has been built for a repository.
 * @param repoPath - Path to the repository
 * @returns True if vector index exists and has been built
 */
export function isSemanticIndexBuilt(repoPath: string): boolean {
	const cacheDir = join(repoPath, ".kit", "vector_db");

	// If cache directory doesn't exist, index hasn't been built
	if (!existsSync(cacheDir)) {
		return false;
	}

	// Check if there are files in the cache directory (indicating a built index)
	// Kit creates metadata and index files when building
	try {
		const files = require("node:fs").readdirSync(cacheDir);
		return files.length > 0;
	} catch {
		return false;
	}
}
