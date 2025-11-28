/**
 * AST Pattern
 *
 * Compiles and matches AST search patterns against tree-sitter nodes.
 * Ported from Kit's ASTPattern class in ast_search.py.
 */

import { getAstLogger } from "../logger.js";
import type { SyntaxNode } from "./languages.js";
import { type PatternCriteria, SearchMode } from "./types.js";

/**
 * Node types that represent function definitions across languages.
 */
const FUNCTION_NODE_TYPES = [
	// TypeScript/JavaScript
	"function_declaration",
	"function_expression",
	"arrow_function",
	"method_definition",
	"generator_function_declaration",
	// Python
	"function_definition",
];

/**
 * Node types that represent class definitions across languages.
 */
const CLASS_NODE_TYPES = [
	// TypeScript/JavaScript
	"class_declaration",
	"class_expression",
	// Python
	"class_definition",
];

/**
 * Node types that represent try/catch statements.
 */
const TRY_NODE_TYPES = [
	"try_statement", // TypeScript/JavaScript and Python
];

/**
 * ASTPattern compiles search patterns and matches them against AST nodes.
 *
 * Supports two modes:
 * - `simple`: Natural language patterns like "async function", "class"
 * - `pattern`: JSON object criteria like {"type": "function_declaration"}
 */
export class ASTPattern {
	readonly pattern: string;
	readonly mode: SearchMode;

	// Simple mode flags (parsed from natural language)
	private isAsync = false;
	private isDef = false;
	private isClass = false;
	private isTry = false;
	private isImport = false;
	private isExport = false;

	// Pattern mode criteria (parsed from JSON)
	private criteria: PatternCriteria = {};

	/**
	 * Create a new AST pattern.
	 *
	 * @param pattern - The search pattern string
	 * @param mode - The search mode (simple or pattern)
	 */
	constructor(pattern: string, mode: SearchMode = SearchMode.SIMPLE) {
		this.pattern = pattern;
		this.mode = mode;
		this.compile();
	}

	/**
	 * Compile the pattern based on mode.
	 */
	private compile(): void {
		if (this.mode === SearchMode.SIMPLE) {
			this.compileSimple();
		} else if (this.mode === SearchMode.PATTERN) {
			this.compilePattern();
		}
	}

	/**
	 * Compile simple mode pattern from natural language.
	 * Parses keywords like "async", "function", "class", etc.
	 */
	private compileSimple(): void {
		const lower = this.pattern.toLowerCase();

		// Check for keywords
		this.isAsync = lower.includes("async");
		this.isDef =
			lower.includes("function") ||
			lower.includes("def") ||
			lower.includes("method");
		this.isClass = lower.includes("class");
		this.isTry = lower.includes("try") || lower.includes("catch");
		this.isImport = lower.includes("import");
		this.isExport = lower.includes("export");

		// If no specific keywords matched, treat as text search
		if (
			!this.isAsync &&
			!this.isDef &&
			!this.isClass &&
			!this.isTry &&
			!this.isImport &&
			!this.isExport
		) {
			// Fall back to text matching mode
			this.criteria = { textMatch: this.pattern };
		}
	}

	/**
	 * Compile pattern mode from JSON criteria.
	 */
	private compilePattern(): void {
		try {
			this.criteria = JSON.parse(this.pattern);
		} catch (error) {
			// If JSON parsing fails, treat as text match
			// Log at debug level since this is often intentional (user typed plain text)
			const logger = getAstLogger();
			logger.debug("Pattern JSON parse failed, using text match fallback", {
				pattern: this.pattern,
				error: error instanceof Error ? error.message : String(error),
			});
			this.criteria = { textMatch: this.pattern };
		}
	}

	/**
	 * Check if a node matches this pattern.
	 *
	 * @param node - The tree-sitter syntax node
	 * @param source - The source code string
	 * @returns True if the node matches
	 */
	matches(node: SyntaxNode, source: string): boolean {
		if (this.mode === SearchMode.SIMPLE) {
			return this.matchesSimple(node, source);
		} else if (this.mode === SearchMode.PATTERN) {
			return this.matchesPattern(node, source);
		}
		return false;
	}

	/**
	 * Match a node against simple mode pattern.
	 */
	private matchesSimple(node: SyntaxNode, source: string): boolean {
		const nodeType = node.type;

		// If we're looking for specific constructs
		if (
			this.isDef ||
			this.isClass ||
			this.isTry ||
			this.isImport ||
			this.isExport
		) {
			// Check construct type
			if (this.isDef && !this.isFunctionNode(nodeType)) return false;
			if (this.isClass && !this.isClassNode(nodeType)) return false;
			if (this.isTry && !TRY_NODE_TYPES.includes(nodeType)) return false;
			if (this.isImport && !nodeType.includes("import")) return false;
			if (this.isExport && !nodeType.includes("export")) return false;

			// Check async modifier (only for functions)
			if (this.isAsync && this.isDef) {
				if (!this.hasAsyncModifier(node)) return false;
			}

			return true;
		}

		// Text match fallback
		if (this.criteria.textMatch) {
			const text = this.getNodeText(node, source);
			return text.includes(this.criteria.textMatch);
		}

		return false;
	}

	/**
	 * Match a node against pattern mode criteria.
	 */
	private matchesPattern(node: SyntaxNode, source: string): boolean {
		// Match node type
		if (this.criteria.type && node.type !== this.criteria.type) {
			return false;
		}

		// Match async modifier
		if (this.criteria.async !== undefined) {
			if (this.hasAsyncModifier(node) !== this.criteria.async) {
				return false;
			}
		}

		// Match symbol name
		if (this.criteria.name) {
			const name = this.getNodeName(node, source);
			if (name !== this.criteria.name) {
				return false;
			}
		}

		// Match text content
		if (this.criteria.textMatch) {
			const text = this.getNodeText(node, source);
			if (!text.includes(this.criteria.textMatch)) {
				return false;
			}
		}

		// If no criteria specified, don't match anything
		if (
			!this.criteria.type &&
			!this.criteria.async &&
			!this.criteria.name &&
			!this.criteria.textMatch
		) {
			return false;
		}

		return true;
	}

	/**
	 * Check if a node type is a function node.
	 */
	private isFunctionNode(type: string): boolean {
		return FUNCTION_NODE_TYPES.includes(type);
	}

	/**
	 * Check if a node type is a class node.
	 */
	private isClassNode(type: string): boolean {
		return CLASS_NODE_TYPES.includes(type);
	}

	/**
	 * Check if a node has an async modifier.
	 * Works for both direct 'async' child and keyword in text.
	 */
	private hasAsyncModifier(node: SyntaxNode): boolean {
		// Check for 'async' child node (TypeScript/JavaScript)
		for (const child of node.children) {
			if (child && child.type === "async") return true;
		}

		// Check for async keyword in first few characters
		// This handles cases where async is part of the node text
		const firstPart = node.text?.slice(0, 10) ?? "";
		return firstPart.includes("async");
	}

	/**
	 * Get the name of a named node (function, class, etc.)
	 */
	private getNodeName(node: SyntaxNode, source: string): string | undefined {
		// Look for identifier or name child
		for (const child of node.children) {
			if (!child) continue;
			if (
				child.type === "identifier" ||
				child.type === "type_identifier" ||
				child.type === "property_identifier"
			) {
				return source.substring(child.startIndex, child.endIndex);
			}
		}

		// Check named children
		const nameChild = node.childForFieldName("name");
		if (nameChild) {
			return source.substring(nameChild.startIndex, nameChild.endIndex);
		}

		return undefined;
	}

	/**
	 * Get the text content of a node.
	 */
	private getNodeText(node: SyntaxNode, source: string): string {
		return source.substring(node.startIndex, node.endIndex);
	}
}
