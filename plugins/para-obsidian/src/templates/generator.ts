/**
 * Template generator for creating Templater-compatible or native templates.
 *
 * Orchestrates frontmatter and body generation to create complete
 * template files with interactive prompts and auto-fill fields.
 *
 * @module templates/generator
 */

import {
	generateFrontmatter,
	type TemplateSyntax,
} from "./services/frontmatter-builder";
import { generateBody } from "./services/section-builder";
import type { TemplateConfig } from "./types";

/**
 * Options for template generation.
 */
export interface GenerateTemplateOptions {
	/** Template syntax mode (default: "templater"). */
	readonly syntax?: TemplateSyntax;
}

/**
 * Generates a complete template from configuration.
 *
 * Creates a markdown file with YAML frontmatter and body sections,
 * using either Templater or native syntax for prompts and auto-fill fields.
 *
 * @param config - Template configuration
 * @param options - Generation options
 * @returns Complete template content
 */
export function generateTemplate(
	config: TemplateConfig,
	options?: GenerateTemplateOptions,
): string {
	const syntax = options?.syntax ?? "templater";
	const frontmatter = generateFrontmatter(
		config.fields,
		config.version,
		syntax,
	);
	const body = generateBody(config.sections, syntax);

	return `${frontmatter}\n\n${body}`;
}

// Re-export for convenience
export type { TemplateSyntax } from "./services/frontmatter-builder";
