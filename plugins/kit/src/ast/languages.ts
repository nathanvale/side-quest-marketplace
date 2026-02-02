/**
 * Language Registry
 *
 * Maps file extensions to tree-sitter languages and provides
 * lazy-loaded parser instances using WASM grammars.
 */

import { createRequire } from "node:module";
import { ResourcePool } from "@side-quest/core/concurrency";
import { Language, type Node, Parser } from "web-tree-sitter";
import { getAstLogger } from "../logger.js";

// Create require for resolving WASM paths
const require = createRequire(import.meta.url);

/**
 * File extension to tree-sitter language mapping.
 * Ported from Kit's LANGUAGES dict in tree_sitter_symbol_extractor.py
 */
export const LANGUAGES: Record<string, string> = {
	".ts": "typescript",
	".tsx": "tsx",
	".mts": "typescript",
	".cts": "typescript",
	".js": "javascript",
	".jsx": "javascript",
	".mjs": "javascript",
	".cjs": "javascript",
	".py": "python",
};

/**
 * Languages we support for AST search.
 */
export const SUPPORTED_LANGUAGES = [
	"typescript",
	"tsx",
	"javascript",
	"python",
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// Resource pools for cached instances
const languagePool = new ResourcePool<SupportedLanguage, Language>();
const parserPool = new ResourcePool<SupportedLanguage, Parser>();

let initialized = false;

/**
 * Initialize the tree-sitter parser.
 * Must be called before any parsing operations.
 */
export async function initParser(): Promise<void> {
	if (initialized) return;

	const logger = getAstLogger();
	logger.debug("Initializing tree-sitter parser");

	try {
		await Parser.init();
		initialized = true;
		logger.debug("Tree-sitter parser initialized successfully");
	} catch (error) {
		logger.error("Failed to initialize tree-sitter parser", {
			error: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}
}

/**
 * Get a parser configured for a specific language.
 *
 * Each language gets its own dedicated parser instance to avoid race conditions
 * when concurrent requests for different languages would otherwise swap the
 * language on a shared parser mid-parse.
 *
 * @param language - The language name (e.g., "typescript")
 * @returns Configured parser instance for this language
 */
export async function getParser(language: SupportedLanguage): Promise<Parser> {
	await initParser();

	const logger = getAstLogger();

	return parserPool.getOrCreate(language, async (lang) => {
		logger.debug("Creating new parser for language", { language: lang });

		const parser = new Parser();
		const grammar = await loadLanguage(lang);
		parser.setLanguage(grammar);

		return parser;
	});
}

/**
 * Load a language grammar from WASM.
 *
 * @param language - The language name
 * @returns Loaded language instance
 */
async function loadLanguage(language: SupportedLanguage): Promise<Language> {
	const logger = getAstLogger();

	return languagePool.getOrCreate(language, async (lang) => {
		logger.debug("Loading language grammar from WASM", { language: lang });

		try {
			const wasmPath = require.resolve(
				`tree-sitter-wasms/out/tree-sitter-${lang}.wasm`,
			);
			const grammar = await Language.load(wasmPath);
			logger.debug("Language grammar loaded successfully", {
				language: lang,
				wasmPath,
			});
			return grammar;
		} catch (error) {
			logger.error("Failed to load language grammar", {
				language: lang,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	});
}

/**
 * Detect language from file path by extension.
 *
 * @param filePath - Path to the file
 * @returns Language name or null if unsupported
 */
export function detectLanguage(filePath: string): SupportedLanguage | null {
	const lastDot = filePath.lastIndexOf(".");
	if (lastDot === -1) return null;

	const ext = filePath.substring(lastDot).toLowerCase();
	const language = LANGUAGES[ext];

	if (language && SUPPORTED_LANGUAGES.includes(language as SupportedLanguage)) {
		return language as SupportedLanguage;
	}

	return null;
}

/**
 * Check if a file is supported for AST parsing.
 *
 * @param filePath - Path to the file
 * @returns True if the file can be parsed
 */
export function isSupported(filePath: string): boolean {
	return detectLanguage(filePath) !== null;
}

/**
 * Get all supported file extensions as a glob pattern.
 *
 * @returns Glob pattern matching all supported files
 */
export function getSupportedGlob(): string {
	const extensions = Object.keys(LANGUAGES).map((ext) => ext.slice(1));
	return `**/*.{${extensions.join(",")}}`;
}

// Re-export types from web-tree-sitter for convenience
// Note: web-tree-sitter exports 'Node' not 'SyntaxNode'
export type { Node as SyntaxNode };
