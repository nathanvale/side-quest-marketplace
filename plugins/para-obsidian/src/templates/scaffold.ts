/**
 * Basic template scaffold generator
 *
 * Generates simple Templater templates from classifier field definitions.
 * Uses Templater syntax for interactive prompts.
 *
 * @module templates/scaffold
 */

import type { FieldDefinition } from "../inbox/classify/classifiers/types";

/**
 * Configuration for basic template scaffold
 */
export interface ScaffoldConfig {
	/** Template name */
	readonly name: string;
	/** Note type (frontmatter type field) */
	readonly noteType: string;
	/** Template version */
	readonly version: number;
	/** Classifier field definitions */
	readonly fields: readonly FieldDefinition[];
	/** Field name to Templater prompt mapping */
	readonly fieldMappings: Readonly<Record<string, string>>;
}

/**
 * Generates a basic Templater template from classifier configuration.
 *
 * Creates a simple scaffold with:
 * - YAML frontmatter with Templater prompts
 * - Title prompt
 * - Details section with field prompts
 * - Notes section
 * - Processed timestamp
 *
 * @param config - Scaffold configuration
 * @returns Complete template content
 *
 * @example
 * ```typescript
 * const template = generateBasicScaffold({
 *   name: 'medical-bill',
 *   noteType: 'medical-bill',
 *   version: 1,
 *   fields: [
 *     { name: 'provider', type: 'string', description: '...', requirement: 'required' },
 *     { name: 'dateOfService', type: 'date', description: '...', requirement: 'required' }
 *   ],
 *   fieldMappings: {
 *     provider: 'Provider Name',
 *     dateOfService: 'Service Date (YYYY-MM-DD)'
 *   }
 * });
 * ```
 */
export function generateBasicScaffold(config: ScaffoldConfig): string {
	const lines: string[] = [];

	// Frontmatter
	lines.push("---");
	lines.push(`type: ${config.noteType}`);
	lines.push(`template_version: ${config.version}`);
	lines.push('created: <% tp.date.now("YYYY-MM-DD") %>');

	// Add frontmatter fields with prompts
	for (const field of config.fields) {
		const promptLabel = config.fieldMappings[field.name] ?? field.name;
		const isRequired = field.requirement === "required";

		if (field.type === "date") {
			// Date fields use date prompt
			lines.push(`${field.name}: <% tp.system.prompt("${promptLabel}") %>`);
		} else if (field.type === "currency" || field.type === "number") {
			// Numeric fields
			lines.push(`${field.name}: <% tp.system.prompt("${promptLabel}") %>`);
		} else {
			// String fields with optional indicator
			const suffix = isRequired ? "" : " (optional)";
			lines.push(
				`${field.name}: "<% tp.system.prompt("${promptLabel}${suffix}") %>"`,
			);
		}
	}

	lines.push("---");
	lines.push("");

	// Title
	lines.push('# <% tp.system.prompt("Title") %>');
	lines.push("");

	// Details section
	lines.push("## Details");
	lines.push("");

	for (const field of config.fields) {
		const promptLabel = config.fieldMappings[field.name] ?? field.name;
		// Reference frontmatter values instead of prompting again
		lines.push(`**${promptLabel}**: <% tp.frontmatter.${field.name} %>`);
	}

	lines.push("");

	// Notes section
	lines.push("## Notes");
	lines.push("");
	lines.push('<% tp.system.prompt("Additional notes (optional)") %>');
	lines.push("");

	// Footer
	lines.push("---");
	lines.push('*Processed from inbox: <% tp.date.now("YYYY-MM-DD HH:mm") %>*');

	return lines.join("\n");
}
