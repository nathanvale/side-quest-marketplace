/**
 * AST Searcher
 *
 * Searches files using tree-sitter AST patterns.
 * Ported from Kit's ASTSearcher class in ast_search.py.
 *
 * Performance optimizations:
 * - Uses fs/promises for non-blocking I/O
 * - Parses files in parallel chunks to maximize throughput
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { processInParallelChunks } from "@sidequest/core/concurrency";
import { getAstLogger } from "../logger.js";
import { getDefaultKitPath } from "../types.js";
import type { SyntaxNode } from "./languages.js";
import { detectLanguage, getParser, isSupported } from "./languages.js";
import { ASTPattern } from "./pattern.js";
import {
	type ASTMatch,
	type ASTMatchContext,
	type ASTSearchOptions,
	type ASTSearchResult,
	SearchMode,
} from "./types.js";

/**
 * Maximum file size to parse (5MB).
 * Larger files are skipped to prevent memory issues.
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Maximum text length to include in match results.
 */
const MAX_TEXT_LENGTH = 500;

/**
 * Number of files to parse in parallel.
 * Balances throughput vs memory usage.
 */
const PARALLEL_CHUNK_SIZE = 10;

/**
 * Directories to skip during traversal.
 */
const SKIP_DIRS = new Set([
	"node_modules",
	".git",
	".svn",
	".hg",
	"__pycache__",
	".pytest_cache",
	".mypy_cache",
	"dist",
	"build",
	".next",
	".nuxt",
	"coverage",
	".coverage",
	"venv",
	".venv",
	"env",
	".env",
]);

/**
 * ASTSearcher performs AST-based code search using tree-sitter.
 *
 * It traverses the file system, parses supported files, and matches
 * AST nodes against the given pattern.
 */
export class ASTSearcher {
	private readonly repoPath: string;

	/**
	 * Create a new AST searcher.
	 *
	 * @param repoPath - Repository path to search (defaults to KIT_DEFAULT_PATH or cwd)
	 */
	constructor(repoPath?: string) {
		this.repoPath = repoPath ?? getDefaultKitPath();
	}

	/**
	 * Search for AST patterns in the repository.
	 *
	 * Files are parsed in parallel chunks for better performance.
	 *
	 * @param options - Search options
	 * @returns Search results with matching AST nodes
	 */
	async searchPattern(options: ASTSearchOptions): Promise<ASTSearchResult> {
		const {
			pattern,
			mode = SearchMode.SIMPLE,
			filePattern,
			maxResults = 100,
		} = options;

		const astPattern = new ASTPattern(pattern, mode);

		// Get all files to search (async directory traversal)
		const files = await this.getMatchingFiles(filePattern);

		// Debug logging for MCP issues
		const logger = getAstLogger();
		logger.debug("File search results", {
			fileCount: files.length,
			repoPath: this.repoPath,
			filePattern,
			firstFiles: files.slice(0, 3),
		});

		// Process files in parallel chunks using core utility
		const matches = await processInParallelChunks({
			items: files,
			chunkSize: PARALLEL_CHUNK_SIZE,
			maxResults,
			processor: (filePath) => this.searchFile(filePath, astPattern),
			onError: (filePath, error) => {
				logger.error("Error parsing file", {
					filePath,
					error: error.message,
				});
				return [];
			},
		});

		return {
			count: matches.length,
			matches,
			pattern,
			mode,
			path: this.repoPath,
		};
	}

	/**
	 * Get all files matching the pattern.
	 *
	 * @param filePattern - Optional glob pattern to filter files
	 * @returns Array of absolute file paths
	 */
	private async getMatchingFiles(filePattern?: string): Promise<string[]> {
		const files: string[] = [];
		await this.walkDirectory(this.repoPath, files, filePattern);
		return files;
	}

	/**
	 * Recursively walk directory and collect matching files.
	 * Uses async fs methods to avoid blocking the event loop.
	 */
	private async walkDirectory(
		dir: string,
		files: string[],
		filePattern?: string,
	): Promise<void> {
		const logger = getAstLogger();

		let entries: string[];
		try {
			entries = await readdir(dir);
		} catch (error) {
			// Directory doesn't exist or can't be read
			logger.warn("Failed to read directory", {
				dir,
				error: error instanceof Error ? error.message : String(error),
			});
			return;
		}

		// Process entries in parallel for faster traversal
		await Promise.all(
			entries.map(async (entry) => {
				// Skip hidden and ignored directories
				if (SKIP_DIRS.has(entry) || entry.startsWith(".")) return;

				const fullPath = join(dir, entry);

				let stats: Awaited<ReturnType<typeof stat>>;
				try {
					stats = await stat(fullPath);
				} catch (error) {
					logger.debug("Failed to stat entry", {
						path: fullPath,
						error: error instanceof Error ? error.message : String(error),
					});
					return;
				}

				if (stats.isDirectory()) {
					await this.walkDirectory(fullPath, files, filePattern);
				} else if (stats.isFile()) {
					// Skip large files
					if (stats.size > MAX_FILE_SIZE) {
						logger.warn("Skipping large file", {
							path: fullPath,
							size: stats.size,
							maxSize: MAX_FILE_SIZE,
						});
						return;
					}

					// Check if file is supported for parsing
					if (!isSupported(fullPath)) return;

					// Apply file pattern filter if provided
					if (filePattern && !this.matchesFilePattern(fullPath, filePattern)) {
						return;
					}

					files.push(fullPath);
				}
			}),
		);
	}

	/**
	 * Check if a file matches the given pattern.
	 * Uses Bun.Glob for proper glob pattern matching.
	 */
	private matchesFilePattern(filePath: string, pattern: string): boolean {
		const relativePath = relative(this.repoPath, filePath);

		// Use Bun.Glob for proper glob matching
		const glob = new Bun.Glob(pattern);
		return glob.match(relativePath);
	}

	/**
	 * Search a single file for pattern matches.
	 *
	 * @param filePath - Absolute path to the file
	 * @param pattern - AST pattern to match
	 * @returns Array of matches found in the file
	 */
	private async searchFile(
		filePath: string,
		pattern: ASTPattern,
	): Promise<ASTMatch[]> {
		const language = detectLanguage(filePath);
		if (!language) return [];

		const parser = await getParser(language);
		const source = await readFile(filePath, "utf8");
		const tree = parser.parse(source);

		// Handle parse failure
		if (!tree) return [];

		const matches: ASTMatch[] = [];
		this.searchNode(tree.rootNode, source, pattern, filePath, matches);
		return matches;
	}

	/**
	 * Recursively search AST nodes for pattern matches.
	 */
	private searchNode(
		node: SyntaxNode,
		source: string,
		pattern: ASTPattern,
		filePath: string,
		matches: ASTMatch[],
	): void {
		// Check if this node matches the pattern
		if (pattern.matches(node, source)) {
			const match = this.createMatch(node, source, filePath);
			matches.push(match);
		}

		// Recurse into children
		for (let i = 0; i < node.childCount; i++) {
			const child = node.child(i);
			if (child) {
				this.searchNode(child, source, pattern, filePath, matches);
			}
		}
	}

	/**
	 * Create an ASTMatch from a matching node.
	 */
	private createMatch(
		node: SyntaxNode,
		source: string,
		filePath: string,
	): ASTMatch {
		return {
			file: relative(this.repoPath, filePath),
			line: node.startPosition.row + 1,
			column: node.startPosition.column,
			nodeType: node.type,
			text: this.truncateText(source.substring(node.startIndex, node.endIndex)),
			context: this.getContext(node, source),
		};
	}

	/**
	 * Get context information about a matched node.
	 */
	private getContext(node: SyntaxNode, source: string): ASTMatchContext {
		const context: ASTMatchContext = { nodeType: node.type };

		// Walk up the tree to find parent function or class
		let parent = node.parent;
		while (parent) {
			if (this.isFunctionNode(parent.type)) {
				context.parentFunction = this.getNodeName(parent, source);
				break;
			}
			if (this.isClassNode(parent.type)) {
				context.parentClass = this.getNodeName(parent, source);
				break;
			}
			parent = parent.parent;
		}

		return context;
	}

	/**
	 * Get the name of a named node (function, class, etc.).
	 */
	private getNodeName(node: SyntaxNode, source: string): string | undefined {
		// Try named children first
		const nameChild = node.childForFieldName("name");
		if (nameChild) {
			return source.substring(nameChild.startIndex, nameChild.endIndex);
		}

		// Look for identifier children
		for (let i = 0; i < node.childCount; i++) {
			const child = node.child(i);
			if (
				child &&
				(child.type === "identifier" || child.type === "type_identifier")
			) {
				return source.substring(child.startIndex, child.endIndex);
			}
		}

		return undefined;
	}

	/**
	 * Check if a node type is a function.
	 */
	private isFunctionNode(type: string): boolean {
		return [
			"function_declaration",
			"function_definition",
			"function_expression",
			"arrow_function",
			"method_definition",
			"generator_function_declaration",
		].includes(type);
	}

	/**
	 * Check if a node type is a class.
	 */
	private isClassNode(type: string): boolean {
		return [
			"class_declaration",
			"class_definition",
			"class_expression",
		].includes(type);
	}

	/**
	 * Truncate text to maximum length.
	 */
	private truncateText(text: string): string {
		if (text.length <= MAX_TEXT_LENGTH) return text;
		return `${text.slice(0, MAX_TEXT_LENGTH - 3)}...`;
	}
}
