/**
 * Shared MCP server utilities.
 *
 * Provides logging, formatting, and helper functions used across
 * all tool modules.
 *
 * @module mcp/utils
 */

import { coerceValue as coreCoerceValue } from "@sidequest/core/cli";
import {
	getLogFile as coreGetLogFile,
	log as coreLog,
	setLogFile as coreSetLogFile,
	setMcpLogger as coreSetMcpLogger,
	withLogFile as coreWithLogFile,
	type LogEntry,
} from "@sidequest/core/mcp-response";
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
 * Configures core mcp-response logging module with plugin logger.
 */
export async function initMcpLogger(): Promise<void> {
	await initLogger();
	// Configure core mcp-response logging module
	coreSetMcpLogger(mcpLogger);
	const logFile = getLogFile();
	if (logFile) {
		coreSetLogFile(logFile);
	}
}

// Re-export core logging functions for convenience
export { coreLog as log, type LogEntry };
export { createCorrelationId };
export { coreGetLogFile as getLogFile };

// ============================================================================
// Response Formatting
// ============================================================================

// Re-export core response formatting utilities for backward compatibility
export {
	formatError,
	parseResponseFormat,
	ResponseFormat,
	respondError,
	respondText,
} from "@sidequest/core/mcp-response";

// Import ResponseFormat for use in local functions
import type { ResponseFormat } from "@sidequest/core/mcp-response";

/**
 * Append log file path to response text.
 *
 * @deprecated Use the core version via `import { withLogFile } from "@sidequest/core/mcp-response"`.
 * This wrapper is kept for backwards compatibility.
 */
export function withLogFile(text: string, format: ResponseFormat): string {
	return coreWithLogFile(text, format);
}

// ============================================================================
// Helper Functions
// ============================================================================

// Re-export core CLI utilities for backward compatibility
export {
	parseDirs,
	parseKeyValuePairs,
} from "@sidequest/core/cli";

/**
 * Coerce string value to appropriate JavaScript type.
 *
 * Wraps core coerceValue with frontmatter-specific handling:
 * - "null" → null (for clearing optional fields)
 *
 * Core handles: booleans, numbers (including negative), JSON arrays/objects,
 * comma-separated arrays, quoted strings.
 */
export function coerceValue(value: string): unknown {
	// Handle null specially for frontmatter field clearing
	if (value === "null") return null;
	return coreCoerceValue(value);
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
		| "enum"
		| "boolean";
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
