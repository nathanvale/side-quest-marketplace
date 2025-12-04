/**
 * Template management utilities.
 *
 * This module handles listing and retrieving note templates from
 * the configured templates directory. Templates are Markdown files
 * that can contain Templater prompts for dynamic content.
 *
 * @module templates
 */
import fs from "node:fs";
import path from "node:path";

import type { ParaObsidianConfig } from "./config";
import { DEFAULT_TEMPLATE_VERSIONS } from "./defaults";

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

/**
 * Lists all available templates.
 *
 * Scans the configured templates directory for .md files and
 * returns metadata including version from config.
 *
 * @param config - Para-obsidian configuration with templatesDir
 * @returns Array of template info objects, sorted by name
 *
 * @example
 * ```typescript
 * const templates = listTemplates(config);
 * for (const tpl of templates) {
 *   console.log(`${tpl.name} (v${tpl.version})`);
 * }
 * ```
 */
export function listTemplates(config: ParaObsidianConfig): TemplateInfo[] {
	const dir = config.templatesDir;
	if (!dir || !fs.existsSync(dir)) return [];

	const entries = fs
		.readdirSync(dir)
		.filter((f) => f.endsWith(".md"))
		.sort();

	return entries.map((file) => {
		const name = file.replace(/\.md$/, "");
		const version =
			config.templateVersions?.[name] ?? DEFAULT_TEMPLATE_VERSIONS[name] ?? 1;
		const fullPath = path.join(dir, file);
		const content = fs.readFileSync(fullPath, "utf8");
		return { name, path: fullPath, version, content };
	});
}

/**
 * Gets a specific template by name.
 *
 * @param config - Para-obsidian configuration
 * @param name - Template name (without .md extension)
 * @returns Template info, or undefined if not found
 *
 * @example
 * ```typescript
 * const projectTemplate = getTemplate(config, 'project');
 * if (projectTemplate) {
 *   console.log(projectTemplate.content);
 * }
 * ```
 */
export function getTemplate(
	config: ParaObsidianConfig,
	name: string,
): TemplateInfo | undefined {
	return listTemplates(config).find((t) => t.name === name);
}
