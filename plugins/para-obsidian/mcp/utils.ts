/**
 * Shared MCP server utilities.
 *
 * Provides logging, formatting, and helper functions used across
 * all tool modules.
 *
 * @module mcp/utils
 */

import type { ParaObsidianConfig } from "../src/config";
import {
	createCorrelationId,
	getLogFile,
	initLogger,
	mcpLogger,
} from "../src/shared/logger";

// ============================================================================
// Logging
// ============================================================================

/**
 * Initialize the MCP logger (called once at startup).
 */
export async function initMcpLogger(): Promise<void> {
	await initLogger();
}

/**
 * Log entry structure for MCP tool invocations.
 *
 * Required fields:
 * - cid: Correlation ID for request tracing
 * - tool: Tool name (e.g., "para_config")
 *
 * For MetricsCollector compatibility (on response/error events):
 * - durationMs: Execution time in milliseconds
 * - success: Whether the tool succeeded
 */
export interface LogEntry {
	cid: string;
	tool: string;
	durationMs?: number;
	success?: boolean;
	[key: string]: unknown;
}

/**
 * Categorize an error based on its message.
 */
function categorizeError(error: unknown): {
	category: string;
	code: string;
} {
	const message =
		error instanceof Error ? error.message : String(error || "Unknown error");

	// Network errors (transient - can retry)
	if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|fetch failed/i.test(message)) {
		return { category: "transient", code: "NETWORK_ERROR" };
	}

	// Not found errors (permanent - won't be fixed by retrying)
	if (/not found|ENOENT|404/i.test(message)) {
		return { category: "permanent", code: "NOT_FOUND" };
	}

	// Validation errors (permanent - requires code/data fix)
	if (/invalid|validation|schema|required/i.test(message)) {
		return { category: "permanent", code: "VALIDATION" };
	}

	// Permission errors (configuration - requires setup/auth fix)
	if (/permission|EACCES|EPERM|unauthorized/i.test(message)) {
		return { category: "configuration", code: "PERMISSION" };
	}

	// Default
	return { category: "unknown", code: "UNKNOWN_ERROR" };
}

/**
 * Log an MCP tool event.
 *
 * Uses standard LogTape signature: logger.info(message, properties)
 * This format enables MetricsCollector to parse tool invocation metrics.
 *
 * Required properties for metrics collection:
 * - tool: Tool name
 * - durationMs: Execution time in milliseconds
 * - success: Whether the tool succeeded
 */
export function log(entry: LogEntry): void {
	if (!mcpLogger) return;

	const { error, success, ...rest } = entry;
	const timestamp = new Date().toISOString();

	// Successful operation - log as info
	if (success !== false) {
		mcpLogger.info("MCP tool response", {
			...rest,
			timestamp,
		});
		return;
	}

	// Failed operation - enhance error logging
	const errorMessage =
		error instanceof Error ? error.message : String(error || "Unknown error");
	const { category, code } = categorizeError(error);

	const properties: Record<string, unknown> = {
		...rest,
		error: errorMessage,
		errorCategory: category,
		errorCode: code,
		timestamp,
	};

	// Add stack trace for Error objects
	if (error instanceof Error && error.stack) {
		properties.stack = error.stack;
	}

	mcpLogger.error("MCP tool response", properties);
}

// Re-export for convenience
export { createCorrelationId, getLogFile };

// ============================================================================
// Response Formatting
// ============================================================================

/** Response format enum for tool outputs. */
export enum ResponseFormat {
	MARKDOWN = "markdown",
	JSON = "json",
}

/**
 * Parse response_format parameter to enum.
 */
export function parseResponseFormat(value?: string): ResponseFormat {
	return value === "json" ? ResponseFormat.JSON : ResponseFormat.MARKDOWN;
}

/**
 * Format an error for MCP response.
 */
export function formatError(error: unknown, format: ResponseFormat): string {
	const message = error instanceof Error ? error.message : String(error);
	if (format === ResponseFormat.JSON) {
		return JSON.stringify({ error: message, isError: true }, null, 2);
	}
	return `**Error:** ${message}`;
}

/**
 * Append log file path to response text.
 */
export function withLogFile(text: string, format: ResponseFormat): string {
	const currentLogFile = getLogFile();
	if (!currentLogFile) return text;

	if (format === ResponseFormat.JSON) {
		try {
			const parsed = JSON.parse(text);
			if (Array.isArray(parsed)) {
				return JSON.stringify(
					{ data: parsed, logFile: currentLogFile },
					null,
					2,
				);
			}
			if (parsed && typeof parsed === "object") {
				return JSON.stringify({ ...parsed, logFile: currentLogFile }, null, 2);
			}
		} catch {
			// Fall through to wrapping below
		}
		return JSON.stringify({ data: text, logFile: currentLogFile }, null, 2);
	}

	return `${text}\n\nLogs: ${currentLogFile}`;
}

/**
 * Create a successful text response.
 */
export function respondText(format: ResponseFormat, text: string) {
	return {
		content: [{ type: "text" as const, text: withLogFile(text, format) }],
	};
}

/**
 * Create an error response with isError flag.
 */
export function respondError(format: ResponseFormat, error: unknown) {
	return {
		isError: true,
		content: [
			{
				type: "text" as const,
				text: withLogFile(formatError(error, format), format),
			},
		],
	};
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse comma-separated directory list.
 */
export function parseDirs(
	value: string | undefined,
): ReadonlyArray<string> | undefined {
	if (!value) return undefined;
	return value
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

/**
 * Parse key=value pairs from string array.
 */
export function parseKeyValuePairs(pairs: string[]): Record<string, string> {
	const result: Record<string, string> = {};
	for (const pair of pairs) {
		const [key, ...rest] = pair.split("=");
		if (key && rest.length > 0) {
			result[key.trim()] = rest.join("=").trim();
		}
	}
	return result;
}

/**
 * Coerce string value to appropriate JavaScript type.
 */
export function coerceValue(value: string): unknown {
	// Try parsing as JSON first
	if (value === "true") return true;
	if (value === "false") return false;
	if (value === "null") return null;
	if (/^\d+$/.test(value)) return Number.parseInt(value, 10);
	if (/^\d+\.\d+$/.test(value)) return Number.parseFloat(value);
	if (value.startsWith("[") && value.endsWith("]")) {
		try {
			return JSON.parse(value);
		} catch {
			// Fall through to string
		}
	}
	return value;
}

// ============================================================================
// Frontmatter Hints
// ============================================================================

/**
 * Frontmatter field hint information.
 * Provides helpful suggestions for setting frontmatter fields.
 */
export interface FrontmatterHint {
	/** Allowed enum values for this field (if applicable). */
	readonly allowedValues?: ReadonlyArray<string>;
	/** Expected data type for this field. */
	readonly expectedType?:
		| "string"
		| "date"
		| "number"
		| "array"
		| "wikilink"
		| "enum";
	/** Example values for this field. */
	readonly examples?: ReadonlyArray<string>;
	/** Human-readable description of the field. */
	readonly description?: string;
	/** Additional notes or warnings for this field type. */
	readonly notes?: string;
}

/**
 * Computes helpful hints for a frontmatter field based on note type and field name.
 *
 * Looks up the field in the frontmatter rules for the note type and provides
 * suggestions including allowed enum values, expected type, and examples.
 *
 * @param config - Para-obsidian configuration with frontmatter rules
 * @param noteType - Note type (e.g., "project", "area", "task")
 * @param field - Field name to get hints for
 * @returns Hint object with suggestions, or undefined if no specific hints available
 */
export function computeFrontmatterHint(
	config: ParaObsidianConfig,
	noteType: string,
	field: string,
): FrontmatterHint | undefined {
	const rules = config.frontmatterRules?.[noteType];
	if (!rules?.required) return undefined;

	const rule = rules.required[field];
	if (!rule) return undefined;

	// Build hint object with all properties at creation time
	const hintProps: FrontmatterHint = {
		expectedType: rule.type,
		description: rule.description,
	};

	// Add enum-specific hints
	if (rule.type === "enum" && rule.enum) {
		return {
			...hintProps,
			allowedValues: rule.enum,
			examples: [rule.enum[0]!], // First enum value as example
		};
	}

	// Add array-specific hints
	if (rule.type === "array") {
		return {
			...hintProps,
			examples: rule.includes
				? [`[${rule.includes.map((v) => `"${v}"`).join(", ")}]`]
				: ['["tag1", "tag2"]'],
		};
	}

	// Add date-specific hints
	if (rule.type === "date") {
		const today = new Date().toISOString().split("T")[0]!;
		return {
			...hintProps,
			examples: [today],
		};
	}

	// Add wikilink-specific hints
	if (rule.type === "wikilink") {
		return {
			...hintProps,
			examples: ["[[Note Name]]"],
			notes:
				'IMPORTANT: Do NOT quote wikilinks in YAML frontmatter for Dataview compatibility. Use [[Note]] not "[[Note]]"',
		};
	}

	return hintProps;
}

/**
 * Formats a frontmatter hint as a human-readable string.
 *
 * @param field - Field name
 * @param hint - Hint object with suggestions
 * @returns Formatted hint string for display
 */
export function formatFrontmatterHint(
	field: string,
	hint: FrontmatterHint,
): string {
	const parts: string[] = [];

	if (hint.description) {
		parts.push(hint.description);
	}

	if (hint.expectedType) {
		parts.push(`Type: ${hint.expectedType}`);
	}

	if (hint.allowedValues && hint.allowedValues.length > 0) {
		parts.push(`Allowed values: ${hint.allowedValues.join(", ")}`);
	}

	if (hint.examples && hint.examples.length > 0) {
		parts.push(`Example: ${field}: ${hint.examples[0]}`);
	}

	return parts.length > 0
		? `\n\n**Hint for ${field}:**\n${parts.join("\n")}`
		: "";
}
