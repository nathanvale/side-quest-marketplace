/**
 * Kit Plugin Formatters
 *
 * Response formatters for MCP tool output in markdown and JSON formats.
 */

import type { ASTSearchResult } from "./ast/types.js";
import type {
	ErrorResult,
	FileContentResult,
	FileTreeResult,
	GrepResult,
	KitResult,
	SemanticResult,
	SymbolsResult,
	UsagesResult,
} from "./types.js";
import { isError, ResponseFormat } from "./types.js";

// ============================================================================
// Grep Formatters
// ============================================================================

/**
 * Format grep results for display.
 * @param result - Grep result or error
 * @param format - Output format (markdown or json)
 * @returns Formatted string
 */
export function formatGrepResults(
	result: KitResult<GrepResult>,
	format: ResponseFormat = ResponseFormat.MARKDOWN,
): string {
	if (isError(result)) {
		return formatError(result, format);
	}

	if (format === ResponseFormat.JSON) {
		return JSON.stringify(result, null, 2);
	}

	// Markdown format
	const lines: string[] = [];

	lines.push(`## Grep Results`);
	lines.push("");
	lines.push(`Found **${result.count}** matches for \`${result.pattern}\``);
	lines.push("");

	if (result.matches.length === 0) {
		lines.push("_No matches found._");
		return lines.join("\n");
	}

	// Group matches by file
	const byFile = new Map<string, typeof result.matches>();
	for (const match of result.matches) {
		const existing = byFile.get(match.file) ?? [];
		existing.push(match);
		byFile.set(match.file, existing);
	}

	for (const [file, matches] of byFile) {
		lines.push(`### ${file}`);
		lines.push("");

		for (const match of matches) {
			const lineNum = match.line ? `:${match.line}` : "";
			lines.push(`- **${file}${lineNum}**: ${truncate(match.content, 100)}`);
		}
		lines.push("");
	}

	return lines.join("\n");
}

// ============================================================================
// Semantic Formatters
// ============================================================================

/**
 * Format semantic search results for display.
 * @param result - Semantic result or error
 * @param format - Output format (markdown or json)
 * @returns Formatted string
 */
export function formatSemanticResults(
	result: KitResult<SemanticResult>,
	format: ResponseFormat = ResponseFormat.MARKDOWN,
): string {
	if (isError(result)) {
		return formatError(result, format);
	}

	if (format === ResponseFormat.JSON) {
		return JSON.stringify(result, null, 2);
	}

	// Markdown format
	const lines: string[] = [];

	lines.push(`## Semantic Search Results`);
	lines.push("");

	// Show fallback notice if applicable
	if (result.fallback && result.installHint) {
		lines.push(`> **Note:** ${result.installHint.split("\n")[0]}`);
		lines.push(">");
		lines.push(
			"> Using text search fallback. Results may be less relevant than semantic search.",
		);
		lines.push("");
	}

	lines.push(
		`Found **${result.count}** matches for query: _"${result.query}"_`,
	);
	lines.push("");

	if (result.matches.length === 0) {
		lines.push("_No matches found._");
		return lines.join("\n");
	}

	result.matches.forEach((match, i) => {
		const score = (match.score * 100).toFixed(1);
		const lineInfo =
			match.startLine && match.endLine
				? `:${match.startLine}-${match.endLine}`
				: match.startLine
					? `:${match.startLine}`
					: "";

		lines.push(`### ${i + 1}. ${match.file}${lineInfo} (${score}% relevance)`);
		lines.push("");
		lines.push("```");
		lines.push(truncate(match.chunk, 500));
		lines.push("```");
		lines.push("");
	});

	return lines.join("\n");
}

// ============================================================================
// Symbols Formatters
// ============================================================================

/**
 * Format symbols results for display.
 * @param result - Symbols result or error
 * @param format - Output format (markdown or json)
 * @returns Formatted string
 */
export function formatSymbolsResults(
	result: KitResult<SymbolsResult>,
	format: ResponseFormat = ResponseFormat.MARKDOWN,
): string {
	if (isError(result)) {
		return formatError(result, format);
	}

	if (format === ResponseFormat.JSON) {
		return JSON.stringify(result, null, 2);
	}

	// Markdown format
	const lines: string[] = [];

	lines.push(`## Code Symbols`);
	lines.push("");
	lines.push(`Found **${result.count}** symbols in \`${result.path}\``);
	lines.push("");

	if (result.symbols.length === 0) {
		lines.push("_No symbols found._");
		return lines.join("\n");
	}

	// Group by type
	const byType = new Map<string, typeof result.symbols>();
	for (const symbol of result.symbols) {
		const existing = byType.get(symbol.type) ?? [];
		existing.push(symbol);
		byType.set(symbol.type, existing);
	}

	// Sort types for consistent output
	const sortedTypes = [...byType.keys()].sort();

	for (const type of sortedTypes) {
		const symbols = byType.get(type)!;
		const icon = getSymbolIcon(type);

		lines.push(`### ${icon} ${capitalize(type)}s (${symbols.length})`);
		lines.push("");

		for (const symbol of symbols) {
			const loc = symbol.endLine
				? `${symbol.startLine}-${symbol.endLine}`
				: String(symbol.startLine);
			lines.push(`- **${symbol.name}** - \`${symbol.file}:${loc}\``);
		}
		lines.push("");
	}

	return lines.join("\n");
}

// ============================================================================
// Error Formatters
// ============================================================================

/**
 * Format an error result.
 * @param error - Error result
 * @param format - Output format
 * @returns Formatted string
 */
export function formatError(
	error: ErrorResult,
	format: ResponseFormat = ResponseFormat.MARKDOWN,
): string {
	if (format === ResponseFormat.JSON) {
		return JSON.stringify(error, null, 2);
	}

	const lines: string[] = [];
	lines.push(`## Error`);
	lines.push("");
	lines.push(`**${error.error}**`);

	if (error.hint) {
		lines.push("");
		lines.push(`💡 **Hint:** ${error.hint}`);
	}

	return lines.join("\n");
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Truncate a string to a maximum length.
 */
function truncate(str: string, maxLength: number): string {
	if (str.length <= maxLength) return str;
	return `${str.slice(0, maxLength - 3)}...`;
}

/**
 * Capitalize the first letter of a string.
 */
function capitalize(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Get an icon for a symbol type.
 */
function getSymbolIcon(type: string): string {
	const icons: Record<string, string> = {
		function: "📦",
		class: "📚",
		method: "🔧",
		property: "🏷️",
		variable: "📌",
		constant: "🔒",
		type: "📝",
		interface: "📋",
		enum: "📊",
		module: "📁",
	};
	return icons[type.toLowerCase()] ?? "•";
}

// ============================================================================
// File Tree Formatters
// ============================================================================

/**
 * Format file tree results for display.
 * @param result - File tree result or error
 * @param format - Output format (markdown or json)
 * @returns Formatted string
 */
export function formatFileTreeResults(
	result: KitResult<FileTreeResult>,
	format: ResponseFormat = ResponseFormat.MARKDOWN,
): string {
	if (isError(result)) {
		return formatError(result, format);
	}

	if (format === ResponseFormat.JSON) {
		return JSON.stringify(result, null, 2);
	}

	// Markdown format
	const lines: string[] = [];

	lines.push(`## File Tree`);
	lines.push("");

	if (result.subpath) {
		lines.push(`Showing \`${result.subpath}\` in \`${result.path}\``);
	} else {
		lines.push(`Repository: \`${result.path}\``);
	}

	lines.push("");
	lines.push(`**${result.count}** entries`);
	lines.push("");

	if (result.entries.length === 0) {
		lines.push("_No files found._");
		return lines.join("\n");
	}

	// Build tree structure
	for (const entry of result.entries) {
		const icon = entry.isDir ? "📁" : "📄";
		const size = entry.isDir ? "" : ` (${formatBytes(entry.size)})`;
		lines.push(`- ${icon} \`${entry.path}\`${size}`);
	}

	return lines.join("\n");
}

/**
 * Format bytes to human-readable size.
 */
function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

// ============================================================================
// File Content Formatters
// ============================================================================

/**
 * Format file content results for display.
 * @param result - File content result or error
 * @param format - Output format (markdown or json)
 * @returns Formatted string
 */
export function formatFileContentResults(
	result: KitResult<FileContentResult>,
	format: ResponseFormat = ResponseFormat.MARKDOWN,
): string {
	if (isError(result)) {
		return formatError(result, format);
	}

	if (format === ResponseFormat.JSON) {
		return JSON.stringify(result, null, 2);
	}

	// Markdown format
	const lines: string[] = [];

	lines.push(`## File Contents`);
	lines.push("");

	const found = result.files.filter((f) => f.found).length;
	const notFound = result.files.length - found;

	lines.push(`**${found}** of **${result.count}** files retrieved`);

	if (notFound > 0) {
		lines.push(` (${notFound} not found)`);
	}

	lines.push("");

	for (const file of result.files) {
		lines.push(`### ${file.file}`);
		lines.push("");

		if (!file.found) {
			lines.push(`> **Error:** ${file.error || "File not found"}`);
		} else {
			// Detect language for syntax highlighting
			const ext = file.file.split(".").pop() || "";
			const lang = getLanguageForExtension(ext);

			lines.push(`\`\`\`${lang}`);
			lines.push(truncate(file.content, 5000));
			lines.push("```");
		}

		lines.push("");
	}

	return lines.join("\n");
}

/**
 * Get syntax highlighting language for a file extension.
 */
function getLanguageForExtension(ext: string): string {
	const langMap: Record<string, string> = {
		ts: "typescript",
		tsx: "tsx",
		js: "javascript",
		jsx: "jsx",
		py: "python",
		rb: "ruby",
		go: "go",
		rs: "rust",
		java: "java",
		kt: "kotlin",
		swift: "swift",
		c: "c",
		cpp: "cpp",
		h: "c",
		hpp: "cpp",
		cs: "csharp",
		php: "php",
		sh: "bash",
		bash: "bash",
		zsh: "bash",
		json: "json",
		yaml: "yaml",
		yml: "yaml",
		toml: "toml",
		xml: "xml",
		html: "html",
		css: "css",
		scss: "scss",
		md: "markdown",
		sql: "sql",
	};
	return langMap[ext.toLowerCase()] || "";
}

// ============================================================================
// Usages Formatters
// ============================================================================

/**
 * Format symbol usages results for display.
 * @param result - Usages result or error
 * @param format - Output format (markdown or json)
 * @returns Formatted string
 */
export function formatUsagesResults(
	result: KitResult<UsagesResult>,
	format: ResponseFormat = ResponseFormat.MARKDOWN,
): string {
	if (isError(result)) {
		return formatError(result, format);
	}

	if (format === ResponseFormat.JSON) {
		return JSON.stringify(result, null, 2);
	}

	// Markdown format
	const lines: string[] = [];

	lines.push(`## Symbol Definitions`);
	lines.push("");
	lines.push(
		`Found **${result.count}** definition(s) for \`${result.symbolName}\``,
	);
	lines.push("");

	if (result.usages.length === 0) {
		lines.push("_No definitions found._");
		return lines.join("\n");
	}

	for (const usage of result.usages) {
		const icon = getSymbolTypeIcon(usage.type);
		const lineInfo = usage.line ? `:${usage.line}` : "";

		lines.push(`### ${icon} ${usage.name}`);
		lines.push("");
		lines.push(`- **Type:** ${usage.type}`);
		lines.push(`- **File:** \`${usage.file}${lineInfo}\``);

		if (usage.context) {
			lines.push("");
			lines.push("```");
			lines.push(usage.context);
			lines.push("```");
		}

		lines.push("");
	}

	return lines.join("\n");
}

/**
 * Get an icon for a symbol type (usages variant).
 */
function getSymbolTypeIcon(type: string): string {
	const icons: Record<string, string> = {
		function: "📦",
		class: "📚",
		method: "🔧",
		property: "🏷️",
		variable: "📌",
		constant: "🔒",
		type: "📝",
		interface: "📋",
		enum: "📊",
		module: "📁",
	};
	return icons[type.toLowerCase()] ?? "•";
}

// ============================================================================
// AST Search Formatters
// ============================================================================

/**
 * Format AST search results for display.
 * @param result - AST search result or error
 * @param format - Output format (markdown or json)
 * @returns Formatted string
 */
export function formatAstSearchResults(
	result: KitResult<ASTSearchResult>,
	format: ResponseFormat = ResponseFormat.MARKDOWN,
): string {
	if (isError(result)) {
		return formatError(result, format);
	}

	if (format === ResponseFormat.JSON) {
		return JSON.stringify(result, null, 2);
	}

	// Markdown format
	const lines: string[] = [];

	lines.push("## AST Search Results");
	lines.push("");
	lines.push(
		`Found **${result.count}** matches for pattern \`${result.pattern}\` (${result.mode} mode)`,
	);
	lines.push("");

	if (result.matches.length === 0) {
		lines.push("_No matches found._");
		return lines.join("\n");
	}

	// Group by file
	const byFile = new Map<string, typeof result.matches>();
	for (const match of result.matches) {
		const existing = byFile.get(match.file) ?? [];
		existing.push(match);
		byFile.set(match.file, existing);
	}

	for (const [file, matches] of byFile) {
		lines.push(`### ${file}`);
		lines.push("");

		for (const m of matches) {
			const ctx = m.context.parentFunction
				? ` in \`${m.context.parentFunction}\``
				: m.context.parentClass
					? ` in class \`${m.context.parentClass}\``
					: "";

			lines.push(`- **L${m.line}** \`${m.nodeType}\`${ctx}`);
			lines.push("```");
			lines.push(truncate(m.text, 200));
			lines.push("```");
		}

		lines.push("");
	}

	return lines.join("\n");
}
