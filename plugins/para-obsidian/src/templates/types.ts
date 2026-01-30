/**
 * Type definitions for template creation system.
 *
 * Defines the structure for creating Templater-compatible note templates
 * with interactive field prompts and markdown sections.
 *
 * @module templates/types
 */

// Re-export TemplateSection and TemplateBodyConfig from the single source of truth (defaults.ts)
import type {
	TemplateBodyConfig as TemplateBodyConfigImport,
	TemplateSection as TemplateSectionImport,
} from "../config/defaults.js";
export type TemplateSection = TemplateSectionImport;
export type TemplateBodyConfig = TemplateBodyConfigImport;

/**
 * Field type for frontmatter values.
 */
export type FieldType =
	| "string"
	| "number"
	| "date"
	| "array"
	| "wikilink"
	| "enum";

/**
 * Definition of a frontmatter field in a template.
 */
export interface TemplateField {
	/** Field name in frontmatter (e.g., "title", "status"). */
	readonly name: string;
	/** Human-readable field name for prompts (e.g., "Title", "Project Status"). */
	readonly displayName: string;
	/** Type of value this field accepts. */
	readonly type: FieldType;
	/** Whether this field is required. */
	readonly required: boolean;
	/** Default value if field is optional. */
	readonly default?: string;
	/** Templater auto-fill expression (e.g., 'tp.date.now("YYYY-MM-DD")'). */
	readonly autoFill?: string;
	/** Valid values for enum type. */
	readonly enumValues?: readonly string[];
}

/**
 * Complete configuration for generating a template.
 */
export interface TemplateConfig {
	/** Template filename (kebab-case, without .md extension). */
	readonly name: string;
	/** Human-readable template name. */
	readonly displayName: string;
	/** Note type identifier (matches frontmatter type field). */
	readonly noteType: string;
	/** Template version number. */
	readonly version: number;
	/** Frontmatter field definitions. */
	readonly fields: readonly TemplateField[];
	/** Body section definitions. */
	readonly sections: readonly TemplateSection[];
	/** Optional body configuration overrides (custom H1, preamble). */
	readonly bodyConfig?: TemplateBodyConfig;
}

/**
 * Result of template validation.
 */
export interface TemplateValidationResult {
	/** Whether the template is valid. */
	readonly isValid: boolean;
	/** Validation error messages. */
	readonly errors: readonly string[];
	/** Non-blocking warnings. */
	readonly warnings: readonly string[];
}
