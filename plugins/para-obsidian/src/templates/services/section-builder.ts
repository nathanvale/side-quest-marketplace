/**
 * Section builder service for template generation.
 *
 * Generates markdown body sections with headings, optional content,
 * and Templater or native syntax prompts.
 *
 * @module templates/services/section-builder
 */
import type { TemplateBodyConfig, TemplateSection } from "../types";
import type { TemplateSyntax } from "./frontmatter-builder";

/**
 * Generates markdown body from section definitions.
 *
 * Creates level-2 headings with optional content blocks and Templater/native prompts.
 * Includes title heading at the top.
 *
 * @param sections - Section definitions
 * @param syntax - Template syntax mode (default: "templater")
 * @returns Markdown body content
 *
 * @example
 * ```typescript
 * const sections = [
 *   { heading: "Notes", hasPrompt: false, content: "- [ ] " },
 *   { heading: "Details", hasPrompt: false }
 * ];
 * const body = generateBody(sections, "native");
 * // # {{title}}
 * //
 * // ## Notes
 * //
 * // - [ ]
 * //
 * // ## Details
 * //
 * ```
 */
export function generateBody(
	sections: readonly TemplateSection[],
	syntax: TemplateSyntax = "templater",
	bodyConfig?: TemplateBodyConfig,
): string {
	const titleLine =
		bodyConfig?.titleLine ??
		(syntax === "native" ? "# {{title}}" : '# <% tp.system.prompt("Title") %>');

	const lines: string[] = [
		titleLine,
		"", // Blank line after title
	];

	// Emit preamble (e.g., Source/Clipped metadata block) if configured
	if (bodyConfig?.preamble) {
		lines.push(bodyConfig.preamble);
		lines.push(""); // Blank line after preamble
	}

	for (const section of sections) {
		lines.push(`## ${section.heading}`);
		lines.push(""); // Blank line after heading

		// Emit guidance comment if defined
		if (section.comment) {
			lines.push(`<!-- ${section.comment} -->`);
			lines.push(""); // Blank line after comment
		}

		// Emit content block if defined
		if (section.content) {
			lines.push(section.content);
			lines.push(""); // Blank line after content
		}

		// Emit Templater prompt if applicable (only in templater mode)
		if (syntax === "templater" && section.hasPrompt && section.promptText) {
			lines.push(`<% tp.system.prompt("${section.promptText}") %>`);
			lines.push(""); // Blank line after prompt
		}
	}

	// Add final newline
	return `${lines.join("\n")}\n`;
}
