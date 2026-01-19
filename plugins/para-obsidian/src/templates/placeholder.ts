/**
 * Native placeholder parsing and substitution.
 *
 * This module provides a simpler alternative to Templater syntax for
 * CLI-based note creation. The native placeholder format is:
 *
 * - `{{field}}` - Required field (must be provided via args)
 * - `{{field:default}}` - Optional field with default value
 * - `{{date}}` - Current date (YYYY-MM-DD)
 * - `{{date:format}}` - Current date with custom format
 * - `{{date:format:+7}}` - Date with offset (days)
 * - `{{title}}` - Note title (special, auto-injected)
 * - `{{content}}` - Embedded content (special, preserved)
 *
 * @module templates/placeholder
 */
import { addDays, format } from "date-fns";
import { convertTemplaterFormat } from "./index";

/**
 * Represents a parsed placeholder from template content.
 */
export interface Placeholder {
	/** Placeholder type: 'field' for user input, 'date' for auto-fill */
	readonly type: "field" | "date" | "special";
	/** Field name or 'date' for date placeholders */
	readonly name: string;
	/** Default value for optional fields */
	readonly default?: string;
	/** Date format string (for date placeholders) */
	readonly format?: string;
	/** Day offset for date placeholders (+7, -1, etc.) */
	readonly offset?: number;
	/** Original raw placeholder string including {{ }} */
	readonly raw: string;
}

/** Reserved placeholder names that have special handling */
const RESERVED_NAMES = new Set(["date", "title", "content"]);

/** Default date format when none specified */
const DEFAULT_DATE_FORMAT = "YYYY-MM-DD";

/**
 * Parses all placeholders from template content.
 *
 * Extracts both field placeholders (user input) and date placeholders
 * (auto-filled) from the template content.
 *
 * @param content - Template content containing placeholders
 * @returns Array of parsed placeholders
 *
 * @example
 * ```typescript
 * parsePlaceholders("{{title}} created on {{date:YYYY-MM-DD}}");
 * // Returns:
 * // [
 * //   { type: 'special', name: 'title', raw: '{{title}}' },
 * //   { type: 'date', name: 'date', format: 'YYYY-MM-DD', raw: '{{date:YYYY-MM-DD}}' }
 * // ]
 * ```
 */
export function parsePlaceholders(content: string): Placeholder[] {
	const placeholders: Placeholder[] = [];
	const seen = new Set<string>();

	// Match all {{...}} patterns
	// Captures: name, and optional colon-separated parts
	const pattern = /\{\{([^}]+)\}\}/g;

	for (const match of content.matchAll(pattern)) {
		const raw = match[0];
		const captured = match[1];
		if (!captured) continue;
		const inner = captured.trim();

		// Skip duplicates (same raw string)
		if (seen.has(raw)) continue;
		seen.add(raw);

		const placeholder = parseInnerPlaceholder(inner, raw);
		if (placeholder) {
			placeholders.push(placeholder);
		}
	}

	return placeholders;
}

/**
 * Parses the inner content of a placeholder (without {{ }}).
 */
function parseInnerPlaceholder(inner: string, raw: string): Placeholder | null {
	// Split by colon, but be careful with date formats that might contain colons
	// Date format: {{date}} or {{date:format}} or {{date:format:offset}}
	// Field format: {{field}} or {{field:default}}

	if (inner.startsWith("date")) {
		return parseDatePlaceholder(inner, raw);
	}

	if (inner === "title" || inner === "content") {
		return { type: "special", name: inner, raw };
	}

	return parseFieldPlaceholder(inner, raw);
}

/**
 * Parses a date placeholder: {{date}}, {{date:format}}, {{date:format:offset}}
 */
function parseDatePlaceholder(inner: string, raw: string): Placeholder {
	// Remove 'date' prefix and split remaining by colons
	const afterDate = inner.slice(4); // Remove 'date'

	if (!afterDate) {
		// Just {{date}}
		return {
			type: "date",
			name: "date",
			format: DEFAULT_DATE_FORMAT,
			raw,
		};
	}

	if (!afterDate.startsWith(":")) {
		// Not a date placeholder after all (e.g., {{dateField}})
		return parseFieldPlaceholder(inner, raw);
	}

	// Parse {{date:format}} or {{date:format:offset}}
	const parts = afterDate.slice(1).split(":"); // Remove leading colon

	if (parts.length === 1) {
		// {{date:format}}
		const formatPart = parts[0];
		return {
			type: "date",
			name: "date",
			format: formatPart ?? DEFAULT_DATE_FORMAT,
			raw,
		};
	}

	if (parts.length === 2) {
		// {{date:format:offset}}
		const formatPart = parts[0];
		const offsetStr = parts[1] ?? "";
		const offset = Number.parseInt(offsetStr, 10);

		return {
			type: "date",
			name: "date",
			format: formatPart ?? DEFAULT_DATE_FORMAT,
			offset: Number.isNaN(offset) ? undefined : offset,
			raw,
		};
	}

	// More than 2 colons - treat format as everything before last part
	const offsetStr = parts[parts.length - 1] ?? "";
	const offset = Number.parseInt(offsetStr, 10);

	if (!Number.isNaN(offset) && /^[-+]?\d+$/.test(offsetStr)) {
		// Last part is a valid offset
		return {
			type: "date",
			name: "date",
			format: parts.slice(0, -1).join(":"),
			offset,
			raw,
		};
	}

	// No valid offset, treat entire thing as format
	return {
		type: "date",
		name: "date",
		format: parts.join(":"),
		raw,
	};
}

/**
 * Parses a field placeholder: {{field}} or {{field:default}}
 */
function parseFieldPlaceholder(inner: string, raw: string): Placeholder {
	const colonIndex = inner.indexOf(":");

	if (colonIndex === -1) {
		// No colon: {{field}}
		return {
			type: "field",
			name: inner,
			raw,
		};
	}

	// Has colon: {{field:default}}
	const name = inner.slice(0, colonIndex);
	const defaultValue = inner.slice(colonIndex + 1);

	return {
		type: "field",
		name,
		default: defaultValue,
		raw,
	};
}

/**
 * Replaces field placeholders with provided values.
 *
 * @param content - Template content with placeholders
 * @param args - Key-value pairs for field substitution
 * @param options - Substitution options
 * @returns Content with field placeholders replaced
 *
 * @example
 * ```typescript
 * applyFieldSubstitutions(
 *   "Status: {{status:planning}}",
 *   { status: "active" }
 * );
 * // Returns: "Status: active"
 *
 * // With default value fallback
 * applyFieldSubstitutions(
 *   "Status: {{status:planning}}",
 *   {}
 * );
 * // Returns: "Status: planning"
 * ```
 */
export function applyFieldSubstitutions(
	content: string,
	args: Record<string, string>,
	options: {
		/** Remove unmatched required placeholders (default: false) */
		removeUnmatched?: boolean;
		/** Strip [[]] from arg values to prevent double-wrapping (default: true) */
		stripWikilinks?: boolean;
	} = {},
): string {
	const { removeUnmatched = false, stripWikilinks = true } = options;

	let result = content;

	// Match field placeholders: {{name}} or {{name:default}}
	// Don't match reserved names (date, title, content)
	const fieldPattern = /\{\{([^}:]+)(?::([^}]*))?\}\}/g;

	result = result.replace(
		fieldPattern,
		(match, name: string, defaultValue?: string) => {
			const trimmedName = name.trim();

			// Skip reserved names - they're handled elsewhere
			if (RESERVED_NAMES.has(trimmedName)) {
				return match;
			}

			// Look up value (try exact name, then trimmed)
			let value = args[trimmedName] ?? args[name];

			if (value === undefined) {
				// No value provided - use default or handle unmatched
				if (defaultValue !== undefined) {
					return defaultValue;
				}
				return removeUnmatched ? "" : match;
			}

			// Strip wikilinks if value is wrapped and placeholder is inside [[]]
			if (stripWikilinks && value.startsWith("[[") && value.endsWith("]]")) {
				value = value.slice(2, -2);
			}

			return value;
		},
	);

	return result;
}

/**
 * Replaces date placeholders with formatted dates.
 *
 * @param content - Template content with date placeholders
 * @param baseDate - Base date for formatting (default: current date)
 * @returns Content with date placeholders replaced
 *
 * @example
 * ```typescript
 * applyNativeDateSubstitutions("Created: {{date}}");
 * // Returns: "Created: 2025-01-16"
 *
 * applyNativeDateSubstitutions("Created: {{date:YYYY-MM-DDTHH:mm:ss}}");
 * // Returns: "Created: 2025-01-16T14:30:00"
 *
 * applyNativeDateSubstitutions("Due: {{date:YYYY-MM-DD:+7}}");
 * // Returns: "Due: 2025-01-23"
 * ```
 */
export function applyNativeDateSubstitutions(
	content: string,
	baseDate: Date = new Date(),
): string {
	let result = content;

	// Match date placeholders: {{date}}, {{date:...}}
	// We capture everything after 'date' and parse it separately to handle
	// formats containing colons (like HH:mm:ss)
	const datePattern = /\{\{date(:[^}]+)?\}\}/g;

	result = result.replace(datePattern, (_match, afterDate?: string) => {
		let momentFormat = DEFAULT_DATE_FORMAT;
		let offset = 0;

		if (afterDate) {
			// Remove leading colon and parse
			const inner = afterDate.slice(1);

			// Check if last colon-separated part is an offset (+N, -N, or just digits)
			const lastColonIndex = inner.lastIndexOf(":");
			if (lastColonIndex !== -1) {
				const possibleOffset = inner.slice(lastColonIndex + 1);
				if (/^[-+]?\d+$/.test(possibleOffset)) {
					// It's an offset
					offset = Number.parseInt(possibleOffset, 10);
					momentFormat = inner.slice(0, lastColonIndex);
				} else {
					// Not an offset, entire thing is format
					momentFormat = inner;
				}
			} else {
				// No colons (other than leading), entire thing is format
				momentFormat = inner;
			}
		}

		const date = offset === 0 ? baseDate : addDays(baseDate, offset);

		// Convert Moment.js-style format to date-fns format
		const dateFnsFormat = convertTemplaterFormat(momentFormat);

		try {
			return format(date, dateFnsFormat);
		} catch {
			return `[Invalid date format: ${momentFormat}]`;
		}
	});

	return result;
}

/**
 * Applies all native placeholder substitutions to template content.
 *
 * This is the main entry point for processing native placeholder syntax.
 * It handles fields, dates, and special placeholders in the correct order.
 *
 * @param content - Template content with placeholders
 * @param args - Field values for substitution
 * @param options - Processing options
 * @returns Fully processed content
 *
 * @example
 * ```typescript
 * applyNativePlaceholders(
 *   "# {{title}}\nCreated: {{date}}\nStatus: {{status:active}}",
 *   { title: "My Note", status: "planning" }
 * );
 * // Returns: "# My Note\nCreated: 2025-01-16\nStatus: planning"
 * ```
 */
export function applyNativePlaceholders(
	content: string,
	args: Record<string, string>,
	options: {
		baseDate?: Date;
		removeUnmatched?: boolean;
		stripWikilinks?: boolean;
	} = {},
): string {
	const {
		baseDate = new Date(),
		removeUnmatched = false,
		stripWikilinks = true,
	} = options;

	let result = content;

	// 1. Apply date substitutions first (they don't depend on args)
	result = applyNativeDateSubstitutions(result, baseDate);

	// 2. Apply field substitutions
	result = applyFieldSubstitutions(result, args, {
		removeUnmatched,
		stripWikilinks,
	});

	// 3. Handle {{title}} specially - it should come from args
	if (args.title) {
		result = result.replace(/\{\{title\}\}/g, args.title);
	}

	return result;
}

/**
 * Detects if content uses Templater syntax (for backward compatibility).
 *
 * @param content - Template content to check
 * @returns true if Templater syntax is detected
 */
export function hasTemplaterSyntax(content: string): boolean {
	return content.includes("<%") && content.includes("%>");
}

/**
 * Detects if content uses native placeholder syntax.
 *
 * @param content - Template content to check
 * @returns true if native placeholder syntax is detected
 */
export function hasNativePlaceholders(content: string): boolean {
	return /\{\{[^}]+\}\}/.test(content);
}

/**
 * Extracts field names from native placeholders (for field detection).
 *
 * Returns only user-input fields, not date or special placeholders.
 *
 * @param content - Template content
 * @returns Array of field names
 */
export function extractFieldNames(content: string): string[] {
	const placeholders = parsePlaceholders(content);
	return placeholders.filter((p) => p.type === "field").map((p) => p.name);
}
