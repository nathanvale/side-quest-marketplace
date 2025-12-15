/**
 * Frontmatter builder service for template generation.
 *
 * Generates YAML frontmatter with Templater prompts and auto-fill fields.
 * Handles proper quoting for wikilinks and multi-line values.
 *
 * @module templates/services/frontmatter-builder
 */
import type { TemplateField } from "../types";

/**
 * Generates YAML frontmatter from field definitions.
 *
 * Creates valid YAML with Templater prompt syntax for interactive fields
 * and auto-fill expressions for computed fields (like dates).
 *
 * @param fields - Frontmatter field definitions
 * @param version - Template version number
 * @returns YAML frontmatter block (with --- delimiters)
 *
 * @example
 * ```typescript
 * const fields = [
 *   { name: "title", displayName: "Title", type: "string", required: true },
 *   { name: "created", displayName: "Created", type: "date", required: true,
 *     autoFill: 'tp.date.now("YYYY-MM-DD")' },
 *   { name: "status", displayName: "Status", type: "enum", required: true,
 *     enumValues: ["active", "on-hold"], default: "active" }
 * ];
 * const yaml = generateFrontmatter(fields, 1);
 * // ---
 * // title: "<% tp.system.prompt("Title") %>"
 * // created: <% tp.date.now("YYYY-MM-DD") %>
 * // status: "<% tp.system.prompt("Status", "active") %>"
 * // template_version: 1
 * // ---
 * ```
 */
export function generateFrontmatter(
	fields: readonly TemplateField[],
	version: number,
): string {
	const lines = ["---"];

	for (const field of fields) {
		lines.push(buildFieldLine(field));
	}

	lines.push(`template_version: ${version}`);
	lines.push("---");

	return lines.join("\n");
}

/**
 * Builds a single YAML field line with appropriate Templater syntax.
 *
 * @param field - Field definition
 * @returns YAML line (e.g., 'title: "<% tp.system.prompt("Title") %>"')
 */
function buildFieldLine(field: TemplateField): string {
	const { name, displayName, autoFill, required, type } = field;

	// Auto-fill fields (dates, computed values) - no quotes
	if (autoFill) {
		return `${name}: <% ${autoFill} %>`;
	}

	// Wikilink fields need special quoting to preserve [[ ]]
	if (type === "wikilink") {
		return buildWikilinkField(name, displayName, required, field.default);
	}

	// Enum fields with default value
	if (type === "enum" && field.enumValues) {
		const defaultVal = field.default ?? field.enumValues[0] ?? "";
		return `${name}: "<% tp.system.prompt("${displayName}", "${defaultVal}") %>"`;
	}

	// Regular fields (string, number, array)
	if (required) {
		return `${name}: "<% tp.system.prompt("${displayName}") %>"`;
	}

	// Optional fields with default
	const defaultVal = field.default ?? "";
	return `${name}: "<% tp.system.prompt("${displayName}", "${defaultVal}") %>"`;
}

/**
 * Builds a wikilink field with proper quoting.
 *
 * Wikilinks in YAML frontmatter need to be quoted to preserve [[ ]].
 *
 * @param name - Field name
 * @param displayName - Human-readable name
 * @param required - Whether field is required
 * @param defaultValue - Default wikilink target (optional)
 * @returns YAML line with quoted wikilink
 */
function buildWikilinkField(
	name: string,
	displayName: string,
	required: boolean,
	defaultValue?: string,
): string {
	if (required) {
		return `${name}: "[[<% tp.system.prompt("${displayName}") %>]]"`;
	}

	const defaultVal = defaultValue ?? "";
	return `${name}: "[[<% tp.system.prompt("${displayName}", "${defaultVal}") %>]]"`;
}
