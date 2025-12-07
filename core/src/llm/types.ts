/**
 * Shared types for LLM utilities.
 *
 * These types define the interfaces that constraint builders and prompt
 * builders expect from template and configuration systems.
 *
 * @module llm/types
 */

/**
 * Describes a validation rule for a single frontmatter field.
 */
export interface FieldRule {
	/** The expected data type for this field. */
	readonly type: "string" | "date" | "array" | "wikilink" | "enum";
	/** For enum types, the allowed values. */
	readonly enum?: ReadonlyArray<string>;
	/** For array types, values that must be present in the array. */
	readonly includes?: ReadonlyArray<string>;
	/** Default value to use if field is missing. */
	readonly defaultValue?: string | ReadonlyArray<string>;
	/** Human-readable description of the field's purpose. */
	readonly description?: string;
	/** If true, the field is not required (validation won't fail if missing). */
	readonly optional?: boolean;
}

/**
 * Defines validation rules for frontmatter fields.
 */
export interface FrontmatterRules {
	/** Map of field names to their validation rules. */
	readonly required?: Record<string, FieldRule>;
}

/**
 * Describes a field within a template.
 */
export interface TemplateField {
	/** Field key (exact prompt text from template or frontmatter key) */
	readonly key: string;
	/** Whether this field is auto-generated (e.g., dates) */
	readonly isAutoDate: boolean;
	/** Whether this field appears in frontmatter (vs body) */
	readonly inFrontmatter: boolean;
}

/**
 * Information about a template file.
 */
export interface TemplateInfo {
	/** Template name (filename without .md extension). */
	readonly name: string;
	/** Absolute path to the template file. */
	readonly path: string;
	/** Configured template version number. */
	readonly version: number;
	/** Raw template content. */
	readonly content: string;
}
