/**
 * Template application module for clipping processing.
 *
 * Handles reading vault templates and substituting variables
 * to create typed notes from raw clippings.
 *
 * Templates use `{{variable}}` syntax for substitution.
 * Template locations: `Templates/Clippings/{type}.md`
 *
 * @module inbox/process/template-applier
 */

import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "../../config/index.js";
import type { ClippingType, TemplateVariables } from "./types.js";

/**
 * Get the path to a template file in the vault.
 *
 * @param type - Clipping type for template lookup
 * @returns Absolute path to template file
 *
 * @example
 * ```typescript
 * const path = getTemplatePath("youtube");
 * // => "/path/to/vault/Templates/Clippings/youtube.md"
 * ```
 */
export function getTemplatePath(type: ClippingType): string {
	const config = loadConfig();
	const templatesDir = config.templatesDir || join(config.vault, "Templates");
	// templatesDir may be absolute or relative; if absolute, use directly
	const templatesPath = templatesDir.startsWith("/")
		? templatesDir
		: join(config.vault, templatesDir);
	return join(templatesPath, "Clippings", `${type}.md`);
}

/**
 * Check if a template exists for the given clipping type.
 *
 * @param type - Clipping type to check
 * @returns True if template file exists and is readable
 *
 * @example
 * ```typescript
 * if (await templateExists("youtube")) {
 *   const template = await readTemplate("youtube");
 * }
 * ```
 */
export async function templateExists(type: ClippingType): Promise<boolean> {
	try {
		const path = getTemplatePath(type);
		await access(path);
		return true;
	} catch {
		return false;
	}
}

/**
 * Read a template file and return its content.
 * Tries in order: {type}-processor.md, {type}.md, generic.md
 *
 * @param type - Clipping type for template lookup
 * @returns Template content as string
 * @throws Error if no suitable template exists
 *
 * @example
 * ```typescript
 * // Tries: article-processor.md -> article.md -> generic.md
 * const template = await readTemplate("article");
 * ```
 */
export async function readTemplate(type: ClippingType): Promise<string> {
	const config = loadConfig();
	const templatesDir = config.templatesDir || join(config.vault, "Templates");
	const templatesPath = templatesDir.startsWith("/")
		? templatesDir
		: join(config.vault, templatesDir);
	const clippingsDir = join(templatesPath, "Clippings");

	// Try processor template first (e.g., article-processor.md)
	const processorPath = join(clippingsDir, `${type}-processor.md`);
	try {
		return await readFile(processorPath, "utf-8");
	} catch {
		// Try type-specific template (e.g., article.md)
		const typePath = join(clippingsDir, `${type}.md`);
		try {
			return await readFile(typePath, "utf-8");
		} catch {
			// Fall back to generic template
			if (type !== "generic") {
				const genericPath = join(clippingsDir, "generic.md");
				try {
					return await readFile(genericPath, "utf-8");
				} catch {
					throw new Error(
						`Template not found: ${type}-processor.md, ${type}.md, or generic.md`,
					);
				}
			}
			throw new Error(`Template not found: ${type}.md`);
		}
	}
}

/**
 * Remove empty sections from content.
 * Strips sections like "---\n\n## Highlights\n\n\n---" that have no actual content.
 * Also cleans up consecutive dividers left behind.
 *
 * @param content - Content string to clean
 * @returns Content with empty sections removed
 */
function removeEmptySections(content: string): string {
	// Remove empty Highlights section including surrounding dividers
	// Pattern: optional leading ---, ## Highlights, whitespace, optional trailing ---
	let cleaned = content
		.replace(/---\s*\n+## Highlights\s*\n+---/g, "---")
		.replace(/## Highlights\s*\n+---/g, "")
		.replace(/---\s*\n+## Highlights\s*$/g, "")
		.replace(/## Highlights\s*\n*$/g, "");

	// Clean up consecutive dividers (--- followed by whitespace and another ---)
	cleaned = cleaned.replace(/---\s*\n+\s*\n+---/g, "---");

	return cleaned;
}

/**
 * Substitute template variables with actual values.
 * Handles {{variable}} syntax with graceful handling of undefined values.
 *
 * @param template - Template string with {{variable}} placeholders
 * @param variables - Variable values for substitution
 * @returns Template with all variables replaced
 *
 * @example
 * ```typescript
 * const template = "# {{title}}\n\nSource: {{source}}\n\n{{transcript}}";
 * const result = applyTemplateVariables(template, {
 *   title: "My Video",
 *   source: "https://youtube.com/watch?v=abc",
 *   transcript: "Full transcript text..."
 * });
 * // => "# My Video\n\nSource: https://youtube.com/watch?v=abc\n\nFull transcript text..."
 * ```
 */
export function applyTemplateVariables(
	template: string,
	variables: TemplateVariables,
): string {
	// Clean empty sections from content variable
	const cleanedVariables = { ...variables };
	if (cleanedVariables.content) {
		cleanedVariables.content = removeEmptySections(cleanedVariables.content);
	}

	// Replace {{variable}} placeholders with values
	// Undefined values become empty strings
	return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
		const value = cleanedVariables[key as keyof TemplateVariables];
		return value !== undefined ? String(value) : "";
	});
}

/**
 * Main function: read template for type and apply variables.
 * Combines template reading and variable substitution in one operation.
 *
 * @param type - Clipping type for template selection
 * @param variables - Variable values for substitution
 * @returns Processed template content ready for note creation
 * @throws Error if template cannot be read
 *
 * @example
 * ```typescript
 * const content = await applyTemplate("youtube", {
 *   title: "TypeScript Tutorial",
 *   source: "https://youtube.com/watch?v=abc123",
 *   video_id: "abc123",
 *   transcript: "Welcome to this tutorial...",
 *   transcript_status: "available",
 *   clipped: "2024-01-15T10:30:00Z",
 *   domain: "youtube.com",
 *   content: "Original note content"
 * });
 * ```
 */
export async function applyTemplate(
	type: ClippingType,
	variables: TemplateVariables,
): Promise<string> {
	const template = await readTemplate(type);
	return applyTemplateVariables(template, variables);
}
