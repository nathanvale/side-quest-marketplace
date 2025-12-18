/**
 * Export Web Clipper template CLI command handler.
 *
 * Exports a pre-configured bookmark template JSON that users can import
 * into Obsidian Web Clipper for optimized PARA workflow integration.
 *
 * @module cli/export-webclipper-template
 */

import path from "node:path";
import { pathExistsSync, writeTextFileSync } from "@sidequest/core/fs";
import { color } from "@sidequest/core/terminal";
import { getErrorMessage } from "@sidequest/core/utils";
import type { CommandContext, CommandResult } from "./types";

/**
 * Web Clipper template schema following Obsidian Web Clipper spec.
 *
 * @see https://github.com/obsidianmd/obsidian-clipper/blob/main/docs/templates.md
 */
interface WebClipperTemplate {
	readonly schemaVersion: string;
	readonly name: string;
	readonly behavior: "create" | "append" | "prepend";
	readonly noteNameFormat: string;
	readonly path: string;
	readonly noteContentFormat: string;
	readonly properties: ReadonlyArray<{
		readonly name: string;
		readonly value: string;
		readonly type: string;
	}>;
	readonly triggers: readonly unknown[];
}

/**
 * PARA-optimized bookmark template for Web Clipper.
 *
 * Configuration:
 * - Sends all clips to inbox for processing
 * - Sets type:bookmark automatically
 * - Extracts page content (first 2000 chars)
 * - Captures URL metadata (domain, title, date)
 * - Adds attribution footer
 *
 * Optional: Users can enable Interpreter for LLM summaries.
 */
const WEBCLIPPER_BOOKMARK_TEMPLATE: WebClipperTemplate = {
	schemaVersion: "0.1.0",
	name: "PARA Bookmark",
	behavior: "create",
	noteNameFormat: "{{title|safe_name}}",
	path: "00 Inbox", // Always to inbox for processing
	noteContentFormat: `{{contentHtml|remove_html:("table,.js-repo-nav,nav")|markdown|slice:0,3000}}

---
*Clipped from [{{domain}}]({{url}}) on {{date}}*`,
	properties: [
		{ name: "type", value: "bookmark", type: "text" },
		{ name: "title", value: "{{title}}", type: "text" },
		{ name: "url", value: "{{url}}", type: "text" },
		{ name: "clipped", value: "{{date}}", type: "date" },
		{ name: "domain", value: "{{domain}}", type: "text" },
		// Optional: Uncomment for LLM summary (requires Interpreter)
		// { name: "summary", value: "{{"a 2-3 sentence summary"}}", type: "text" },
	],
	triggers: [], // Manual template selection
};

/**
 * Resolves output path, expanding ~ and ensuring parent directory exists.
 *
 * @param outputPath - Path to resolve
 * @returns Absolute path
 * @throws Error if parent directory doesn't exist
 */
export function resolveOutputPath(outputPath: string): string {
	// Expand ~ to home directory
	const expanded = outputPath.startsWith("~/")
		? path.join(process.env.HOME ?? "", outputPath.slice(2))
		: outputPath;

	const absolute = path.isAbsolute(expanded)
		? expanded
		: path.join(process.cwd(), expanded);

	const parentDir = path.dirname(absolute);
	if (!pathExistsSync(parentDir)) {
		throw new Error(`Parent directory does not exist: ${parentDir}`);
	}

	return absolute;
}

/**
 * Exports Web Clipper template to JSON file.
 *
 * @param ctx - Command context
 * @returns Command result with success status
 *
 * @example
 * ```bash
 * # Export to current directory
 * para export-webclipper-template
 *
 * # Export to custom path
 * para export-webclipper-template -o ~/Downloads/template.json
 * ```
 */
export async function handleExportWebClipperTemplate(
	ctx: CommandContext,
): Promise<CommandResult> {
	try {
		const { flags, isJson } = ctx;

		// Parse output path flag
		const filename = "para-bookmark-template.json";
		const outputPath =
			typeof flags.output === "string" ? flags.output : filename;

		// Resolve and write template
		const resolvedPath = resolveOutputPath(outputPath);
		const templateJson = JSON.stringify(WEBCLIPPER_BOOKMARK_TEMPLATE, null, 2);
		writeTextFileSync(resolvedPath, templateJson);

		if (isJson) {
			console.log(
				JSON.stringify(
					{
						success: true,
						output_path: resolvedPath,
						template_name: WEBCLIPPER_BOOKMARK_TEMPLATE.name,
					},
					null,
					2,
				),
			);
		} else {
			console.log(color("green", `✓ Exported Web Clipper template to:`));
			console.log(color("cyan", `  ${resolvedPath}`));
			console.log("");
			console.log(color("dim", "To import into Obsidian Web Clipper:"));
			console.log(
				color("dim", "  1. Open the extension → Settings → Templates"),
			);
			console.log(color("dim", "  2. Click 'Import' in top right"));
			console.log(color("dim", `  3. Select ${path.basename(resolvedPath)}`));
			console.log("");
			console.log(
				color("dim", "Optional: Configure Interpreter for LLM summaries"),
			);
			console.log(
				color("dim", "  Settings → Interpreter → Enable + add provider"),
			);
			console.log(
				color("dim", "  (Supports Anthropic, OpenAI, Ollama, Google, etc.)"),
			);
		}

		return { success: true };
	} catch (error) {
		const msg = `Failed to export Web Clipper template: ${getErrorMessage(error)}`;
		if (ctx.isJson) {
			console.log(JSON.stringify({ success: false, error: msg }, null, 2));
		} else {
			console.error(color("red", msg));
		}
		return { success: false, error: msg, exitCode: 1 };
	}
}
