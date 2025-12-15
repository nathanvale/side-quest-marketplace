/**
 * Section builder service for template generation.
 *
 * Generates markdown body sections with headings and Templater prompts.
 *
 * @module templates/services/section-builder
 */
import type { TemplateSection } from "../types";

/**
 * Generates markdown body from section definitions.
 *
 * Creates level-2 headings with optional Templater prompts.
 * Includes title heading at the top.
 *
 * @param sections - Section definitions
 * @returns Markdown body content
 *
 * @example
 * ```typescript
 * const sections = [
 *   { heading: "Why This Matters", hasPrompt: true,
 *     promptText: "What is the goal?" },
 *   { heading: "Success Criteria", hasPrompt: true,
 *     promptText: "How will you know it's done?" },
 *   { heading: "Next Actions", hasPrompt: false }
 * ];
 * const body = generateBody(sections);
 * // # <% tp.system.prompt("Title") %>
 * //
 * // ## Why This Matters
 * //
 * // <% tp.system.prompt("What is the goal?") %>
 * //
 * // ## Success Criteria
 * //
 * // <% tp.system.prompt("How will you know it's done?") %>
 * //
 * // ## Next Actions
 * //
 * ```
 */
export function generateBody(sections: readonly TemplateSection[]): string {
	const lines: string[] = [
		'# <% tp.system.prompt("Title") %>',
		"", // Blank line after title
	];

	for (const section of sections) {
		lines.push(`## ${section.heading}`);
		lines.push(""); // Blank line after heading

		if (section.hasPrompt && section.promptText) {
			lines.push(`<% tp.system.prompt("${section.promptText}") %>`);
			lines.push(""); // Blank line after prompt
		}
	}

	// Add final newline
	return `${lines.join("\n")}\n`;
}
