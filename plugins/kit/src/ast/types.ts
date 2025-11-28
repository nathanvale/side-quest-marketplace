/**
 * AST Search Types
 *
 * Type definitions for AST-based code search using tree-sitter.
 */

/**
 * Search mode for AST patterns.
 *
 * - `simple`: Natural language patterns like "async function", "class"
 * - `pattern`: JSON object criteria like {"type": "function_declaration"}
 */
export enum SearchMode {
	/** Natural language patterns: "async function", "class", "try" */
	SIMPLE = "simple",
	/** JSON criteria: {"type": "function_declaration", "async": true} */
	PATTERN = "pattern",
}

/**
 * A single AST match found during search.
 */
export interface ASTMatch {
	/** File path relative to repository root */
	file: string;
	/** Line number (1-indexed) */
	line: number;
	/** Column number (0-indexed) */
	column: number;
	/** Tree-sitter node type (e.g., "function_declaration") */
	nodeType: string;
	/** Matched source text (truncated to 500 chars) */
	text: string;
	/** Context about where the match was found */
	context: ASTMatchContext;
}

/**
 * Context information for an AST match.
 */
export interface ASTMatchContext {
	/** The tree-sitter node type */
	nodeType: string;
	/** Parent function name, if match is inside a function */
	parentFunction?: string;
	/** Parent class name, if match is inside a class */
	parentClass?: string;
}

/**
 * Options for AST search.
 */
export interface ASTSearchOptions {
	/** Search pattern (natural language or JSON depending on mode) */
	pattern: string;
	/** Search mode: 'simple' or 'pattern' */
	mode?: SearchMode;
	/** File glob pattern (default: all supported files) */
	filePattern?: string;
	/** Repository path to search */
	path?: string;
	/** Maximum results to return (default: 100) */
	maxResults?: number;
}

/**
 * Result of an AST search operation.
 */
export interface ASTSearchResult {
	/** Number of matches found */
	count: number;
	/** Array of AST matches */
	matches: ASTMatch[];
	/** The search pattern used */
	pattern: string;
	/** The search mode used */
	mode: SearchMode;
	/** Repository path searched */
	path: string;
}

/**
 * Criteria for pattern mode matching.
 */
export interface PatternCriteria {
	/** Tree-sitter node type to match */
	type?: string;
	/** Whether node should be async */
	async?: boolean;
	/** Text that must appear in the node */
	textMatch?: string;
	/** Name of the symbol to match */
	name?: string;
}

/**
 * Timeout for AST search operations (ms).
 */
export const AST_SEARCH_TIMEOUT = 60000;
