/**
 * Note creation from templates.
 *
 * This module handles creating new notes from Templater-style templates.
 * It supports:
 * - Title Case filename generation
 * - Template argument substitution
 * - Automatic template_version injection
 * - Title field injection
 *
 * @module create
 */
import fs from "node:fs";
import path from "node:path";

import type { ParaObsidianConfig } from "./config";
import { parseFrontmatter, serializeFrontmatter } from "./frontmatter";
import { resolveVaultPath } from "./fs";
import { applyDateSubstitutions, getTemplate } from "./templates";

/**
 * Options for creating a new note from a template.
 */
export interface CreateOptions {
	/** Template name (without .md extension). */
	readonly template: string;
	/** Title for the new note. Will be used for filename and title field. */
	readonly title: string;
	/** Destination directory relative to vault. Defaults to vault root. */
	readonly dest?: string;
	/** Arguments to substitute for Templater prompts in the template. */
	readonly args?: Record<string, string>;
}

/**
 * Converts a note title to a valid Title Case filename.
 *
 * Removes invalid filename characters, applies Title Case,
 * and appends .md extension.
 *
 * @param title - The note title to convert
 * @returns Sanitized filename with .md extension
 *
 * @example
 * ```typescript
 * titleToFilename('my new project'); // 'My New Project.md'
 * titleToFilename('what/is:this?');  // 'What Is This.md'
 * ```
 */
function titleToFilename(title: string): string {
	const cleaned = title
		.trim()
		// Remove invalid filename characters
		.replace(/[/\\:*?"<>|]/g, "")
		.replace(/'/g, "")
		.split(" ")
		.filter(Boolean)
		// Apply Title Case to each word
		.map((w, i) => {
			if (i === 0) return w[0]?.toUpperCase() + w.slice(1);
			return w[0]?.toUpperCase() + w.slice(1);
		})
		.join(" ");
	return `${cleaned}.md`;
}

/**
 * Substitutes Templater-style prompt placeholders with provided values.
 *
 * Replaces patterns like `<% tp.system.prompt("key") %>` with the
 * corresponding value from the args object.
 *
 * @param content - Template content with Templater prompts
 * @param args - Key-value pairs to substitute
 * @returns Content with prompts replaced by values
 *
 * @example
 * ```typescript
 * const template = 'Project: <% tp.system.prompt("name") %>';
 * applyArgsToTemplate(template, { name: 'My Project' });
 * // 'Project: My Project'
 * ```
 */
export function applyArgsToTemplate(
	content: string,
	args: Record<string, string>,
): string {
	let output = content;
	for (const [key, value] of Object.entries(args)) {
		const needle = `<% tp.system.prompt("${key}") %>`;
		output = output.replaceAll(needle, value);
	}
	return output;
}

/**
 * Creates a new note from a template.
 *
 * This function:
 * 1. Loads the specified template
 * 2. Replaces all `<% tp.date.now(...) %>` patterns with actual dates
 * 3. Replaces all `<% tp.system.prompt(...) %>` patterns with provided args
 * 4. Injects template_version and title into frontmatter
 * 5. Creates the file with Title Case filename
 *
 * @param config - Para-obsidian configuration
 * @param options - Creation options (template, title, dest, args)
 * @returns Created file path and content
 * @throws Error if template not found or file already exists
 *
 * @example
 * ```typescript
 * const { filePath, content } = createFromTemplate(config, {
 *   template: 'project',
 *   title: 'New Feature',
 *   dest: 'Projects',
 *   args: {
 *     'Project title': 'New Feature',
 *     'Target completion date (YYYY-MM-DD)': '2025-12-31',
 *     'Area': '[[Development]]'
 *   }
 * });
 * // Creates 'Projects/New Feature.md' with dates auto-filled
 * ```
 */
export function createFromTemplate(
	config: ParaObsidianConfig,
	options: CreateOptions,
): { filePath: string; content: string } {
	const tpl = getTemplate(config, options.template);
	if (!tpl) throw new Error(`Template not found: ${options.template}`);

	const destDir = options.dest ?? "";
	const filename = titleToFilename(options.title);
	const target = resolveVaultPath(config.vault, path.join(destDir, filename));

	if (fs.existsSync(target.absolute)) {
		throw new Error(`File already exists: ${target.relative}`);
	}

	// Apply template substitutions:
	// 1. First, replace all date patterns (tp.date.now) with actual dates
	// 2. Then, replace all prompt patterns (tp.system.prompt) with provided args
	//    - Auto-include "Title" from options.title so templates with title prompts work
	let filled = applyDateSubstitutions(tpl.content);
	const argsWithTitle = { Title: options.title, ...options.args };
	filled = applyArgsToTemplate(filled, argsWithTitle);

	const { attributes, body } = parseFrontmatter(filled);

	// Inject template_version if not present and configured
	if (
		attributes.template_version === undefined &&
		config.templateVersions?.[options.template] !== undefined
	) {
		attributes.template_version = config.templateVersions[options.template];
	}

	// Inject title if not provided by args/template substitution
	if (!attributes.title) {
		attributes.title = options.title;
	}
	const content = serializeFrontmatter(attributes, body);

	// Create directory structure and write file
	fs.mkdirSync(path.dirname(target.absolute), { recursive: true });
	fs.writeFileSync(target.absolute, content, "utf8");

	return { filePath: target.relative, content };
}
