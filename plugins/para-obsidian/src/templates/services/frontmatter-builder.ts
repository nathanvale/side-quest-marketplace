/**
 * Frontmatter builder service for template generation.
 *
 * Generates YAML frontmatter with Templater prompts or native {{field}} syntax.
 * Handles proper quoting for wikilinks and multi-line values.
 *
 * @module templates/services/frontmatter-builder
 */
import type { TemplateField } from "../types";

/** Template syntax mode for generation. */
export type TemplateSyntax = "templater" | "native";

/**
 * Generates YAML frontmatter from field definitions.
 *
 * Creates valid YAML with either Templater prompt syntax or native {{field}}
 * placeholders, depending on the `syntax` option.
 *
 * @param fields - Frontmatter field definitions
 * @param version - Template version number
 * @param syntax - Template syntax mode (default: "templater")
 * @returns YAML frontmatter block (with --- delimiters)
 *
 * @example
 * ```typescript
 * const fields = [
 *   { name: "title", displayName: "Title", type: "string", required: true },
 *   { name: "created", displayName: "Created", type: "date", required: true,
 *     autoFill: 'tp.date.now("YYYY-MM-DD")' },
 * ];
 * // Templater:
 * generateFrontmatter(fields, 1);
 * // ---
 * // title: "<% tp.system.prompt("Title") %>"
 * // created: <% tp.date.now("YYYY-MM-DD") %>
 * // template_version: 1
 * // ---
 *
 * // Native:
 * generateFrontmatter(fields, 1, "native");
 * // ---
 * // title: "{{Title}}"
 * // created: "{{date:YYYY-MM-DDTHH:mm:ss}}"
 * // template_version: 1
 * // ---
 * ```
 */
export function generateFrontmatter(
	fields: readonly TemplateField[],
	version: number,
	syntax: TemplateSyntax = "templater",
	options?: { skipTemplateVersion?: boolean },
): string {
	const lines = ["---"];

	for (const field of fields) {
		lines.push(
			syntax === "native" ? buildNativeFieldLine(field) : buildFieldLine(field),
		);
	}

	if (!options?.skipTemplateVersion) {
		lines.push(`template_version: ${version}`);
	}
	lines.push("---");

	return lines.join("\n");
}

/**
 * Builds a single YAML field line with Templater syntax.
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
 * Builds a single YAML field line with native {{field}} syntax.
 *
 * @param field - Field definition
 * @returns YAML line (e.g., 'title: "{{Title}}"')
 */
function buildNativeFieldLine(field: TemplateField): string {
	const { name, displayName, autoFill, type } = field;

	// Auto-fill date fields → native {{date:FORMAT}} syntax
	if (autoFill) {
		const formatMatch = autoFill.match(/tp\.date\.now\("([^"]+)"\)/);
		const format = formatMatch?.[1] ?? "YYYY-MM-DD";
		return `${name}: "{{date:${format}}}"`;
	}

	// Wikilink fields → "[[{{Field Name}}]]"
	if (type === "wikilink") {
		return `${name}: "[[{{${displayName}}}]]"`;
	}

	// Array fields → literal empty array
	if (type === "array") {
		return `${name}: []`;
	}

	// Enum fields with default → {{Field Name:default}}
	if (type === "enum" && field.enumValues) {
		const defaultVal = field.default ?? field.enumValues[0] ?? "";
		return `${name}: "{{${displayName}:${defaultVal}}}"`;
	}

	// Fields with a default value → {{Field Name:default}}
	if (field.default && field.default !== "" && field.default !== "[]") {
		return `${name}: "{{${displayName}:${field.default}}}"`;
	}

	// Optional fields with no default → empty value (not a prompt)
	if (!field.required && (!field.default || field.default === "")) {
		return `${name}: ""`;
	}

	// Required prompted fields → {{Field Name}}
	return `${name}: "{{${displayName}}}"`;
}

/**
 * Builds a wikilink field with proper quoting (Templater syntax).
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
