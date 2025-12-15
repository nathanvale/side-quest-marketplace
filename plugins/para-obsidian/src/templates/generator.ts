/**
 * Template generator for creating Templater-compatible templates.
 *
 * Orchestrates frontmatter and body generation to create complete
 * template files with interactive prompts and auto-fill fields.
 *
 * @module templates/generator
 */

import { generateFrontmatter } from "./services/frontmatter-builder";
import { generateBody } from "./services/section-builder";
import type { TemplateConfig } from "./types";

/**
 * Generates a complete Templater template from configuration.
 *
 * Creates a markdown file with YAML frontmatter and body sections,
 * using Templater syntax for interactive prompts and auto-fill fields.
 *
 * @param config - Template configuration
 * @returns Complete template content
 *
 * @example
 * ```typescript
 * const config = {
 *   name: "custom-project",
 *   displayName: "Custom Project",
 *   noteType: "custom-project",
 *   version: 1,
 *   fields: [
 *     { name: "title", displayName: "Title", type: "string", required: true },
 *     { name: "created", displayName: "Created", type: "date", required: true,
 *       autoFill: 'tp.date.now("YYYY-MM-DD")' },
 *     { name: "status", displayName: "Status", type: "enum", required: true,
 *       enumValues: ["active", "on-hold", "completed"], default: "active" },
 *     { name: "area", displayName: "Area", type: "wikilink", required: true }
 *   ],
 *   sections: [
 *     { heading: "Why This Matters", hasPrompt: true,
 *       promptText: "What is the goal?" },
 *     { heading: "Success Criteria", hasPrompt: true,
 *       promptText: "How will you know it's done?" },
 *     { heading: "Next Actions", hasPrompt: false }
 *   ]
 * };
 * const template = generateTemplate(config);
 * ```
 */
export function generateTemplate(config: TemplateConfig): string {
	const frontmatter = generateFrontmatter(config.fields, config.version);
	const body = generateBody(config.sections);

	return `${frontmatter}\n\n${body}`;
}
