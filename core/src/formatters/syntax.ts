/**
 * Syntax highlighting utilities
 *
 * Language detection from file extensions for code formatting and syntax highlighting.
 *
 * @example
 * ```ts
 * import { getLanguageForExtension } from "@sidequest/core/formatters/syntax";
 *
 * getLanguageForExtension("ts"); // "typescript"
 * getLanguageForExtension(".js"); // "javascript"
 * getLanguageForExtension("unknown"); // "text"
 * ```
 */

/**
 * Extension to language mapping
 *
 * Maps 39 file extensions to their corresponding language identifiers
 * for syntax highlighting and code formatting tools.
 */
const EXTENSION_MAP: Record<string, string> = {
	// JavaScript/TypeScript
	ts: "typescript",
	tsx: "tsx",
	js: "javascript",
	jsx: "jsx",

	// Common languages
	py: "python",
	rb: "ruby",
	go: "go",
	rs: "rust",
	java: "java",
	kt: "kotlin",
	swift: "swift",

	// C family
	c: "c",
	cpp: "cpp",
	h: "c",
	hpp: "cpp",
	cs: "csharp",

	// Web & scripting
	php: "php",
	sh: "bash",
	bash: "bash",
	zsh: "zsh",
	fish: "fish",
	ps1: "powershell",

	// Data formats
	json: "json",
	yaml: "yaml",
	yml: "yaml",
	toml: "toml",
	xml: "xml",

	// Stylesheets
	html: "html",
	css: "css",
	scss: "scss",
	less: "less",

	// Query & config
	sql: "sql",
	md: "markdown",
	mdx: "mdx",
	graphql: "graphql",
	gql: "graphql",
	proto: "protobuf",
	tf: "hcl",
	hcl: "hcl",
};

/**
 * Get language identifier for a file extension
 *
 * Maps file extensions to language identifiers for syntax highlighting.
 * Handles extensions with or without leading dot. Returns "text" for
 * unknown extensions.
 *
 * @param ext - File extension (e.g., "ts", ".ts", "JS")
 * @returns Language identifier (e.g., "typescript", "javascript", "text")
 *
 * @example
 * ```ts
 * getLanguageForExtension("ts"); // "typescript"
 * getLanguageForExtension(".js"); // "javascript"
 * getLanguageForExtension("PY"); // "python" (case-insensitive)
 * getLanguageForExtension("unknown"); // "text"
 * getLanguageForExtension(""); // "text"
 * ```
 */
export function getLanguageForExtension(ext: string): string {
	const normalized = ext.toLowerCase().replace(/^\./, "");
	return EXTENSION_MAP[normalized] || "text";
}
