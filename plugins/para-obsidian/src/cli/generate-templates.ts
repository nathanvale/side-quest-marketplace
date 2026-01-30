/**
 * CLI command handler for generating vault template files from defaults.ts.
 *
 * Generates all template `.md` files using the single source of truth in
 * `defaults.ts`. Supports dry-run mode and custom output directory.
 *
 * Usage:
 *   para generate-templates [--dry-run] [--output <dir>]
 *
 * @module cli/generate-templates
 */
import fs from "node:fs";
import path from "node:path";
import { color } from "@sidequest/core/terminal";
import type { ParaObsidianConfig } from "../config/index";
import { generateTemplate } from "../templates/generator";
import { fieldRulesToTemplateFields } from "../templates/services/field-bridge";
import type { CommandContext, CommandResult } from "./types";

/**
 * Maps a template name from defaults.ts to its vault-relative file path.
 *
 * All templates live flat in `Templates/<name>.md` — no subdirectories.
 *
 * @param templateName - Template key from DEFAULT_FRONTMATTER_RULES
 * @returns Vault-relative file path
 */
export function templateNameToFilePath(templateName: string): string {
	return `Templates/${templateName}.md`;
}

/**
 * Result of generating a single template.
 */
export interface GenerateResult {
	/** Template name from defaults.ts. */
	readonly templateName: string;
	/** Vault-relative file path. */
	readonly filePath: string;
	/** Whether the file was written (false in dry-run or unchanged). */
	readonly written: boolean;
	/** Generated content. */
	readonly content: string;
	/** Reason for skipping, if applicable. */
	readonly reason?: string;
}

/**
 * Generates all template files from merged configuration.
 *
 * Iterates over every template in config.frontmatterRules, converts
 * rules to TemplateField definitions via field-bridge, gets sections
 * and version from config, and generates native-syntax template files.
 *
 * @param config - Loaded para-obsidian configuration (merged defaults + user overrides)
 * @param options - Generation options
 * @returns Array of results for each template
 */
export function generateAllTemplates(
	config: ParaObsidianConfig,
	options?: {
		/** Base output directory (absolute path). If not set, uses vault Templates dir. */
		readonly outputDir?: string;
		/** Preview only, don't write files. */
		readonly dryRun?: boolean;
	},
): GenerateResult[] {
	const results: GenerateResult[] = [];
	const dryRun = options?.dryRun ?? false;
	const outputDir = options?.outputDir;

	const frontmatterRules = config.frontmatterRules ?? {};
	const templateSections = config.templateSections ?? {};
	const templateVersions = config.templateVersions ?? {};

	for (const templateName of Object.keys(frontmatterRules)) {
		const rules = frontmatterRules[templateName];
		if (!rules) continue;

		const fields = fieldRulesToTemplateFields(rules);
		const sections = templateSections[templateName] ?? [];
		const version = templateVersions[templateName] ?? 1;

		// Determine the noteType — strip clipping-/processor- prefixes
		const noteType = templateName
			.replace(/^clipping-/, "")
			.replace(/^processor-/, "");

		const content = generateTemplate(
			{
				name: templateName,
				displayName: templateName,
				noteType,
				version,
				fields,
				sections,
			},
			{ syntax: "native" },
		);

		const relativePath = templateNameToFilePath(templateName);
		const result: GenerateResult = {
			templateName,
			filePath: relativePath,
			written: false,
			content,
		};

		if (dryRun) {
			results.push({ ...result, reason: "dry-run" });
			continue;
		}

		if (outputDir) {
			const fullPath = path.join(outputDir, relativePath);
			const dir = path.dirname(fullPath);
			fs.mkdirSync(dir, { recursive: true });

			// Check if content is unchanged
			if (fs.existsSync(fullPath)) {
				const existing = fs.readFileSync(fullPath, "utf-8");
				if (existing === content) {
					results.push({ ...result, reason: "unchanged" });
					continue;
				}
			}

			fs.writeFileSync(fullPath, content, "utf-8");
			results.push({ ...result, written: true });
		} else {
			// No output dir — just report what would be generated
			results.push({ ...result, reason: "no-output-dir" });
		}
	}

	return results;
}

/**
 * CLI handler for `para generate-templates`.
 *
 * @param ctx - Command context with flags and config
 * @returns Command result
 */
export async function handleGenerateTemplates(
	ctx: CommandContext,
): Promise<CommandResult> {
	const dryRun = ctx.flags["dry-run"] === true;
	const outputFlag = ctx.flags.output;
	const outputDir =
		typeof outputFlag === "string"
			? path.resolve(outputFlag)
			: path.join(ctx.config.vault, "");

	const results = generateAllTemplates(ctx.config, { outputDir, dryRun });

	const written = results.filter((r) => r.written);
	const unchanged = results.filter((r) => r.reason === "unchanged");
	const skipped = results.filter(
		(r) => r.reason === "dry-run" || r.reason === "no-output-dir",
	);

	if (ctx.isJson) {
		console.log(
			JSON.stringify(
				{
					total: results.length,
					written: written.length,
					unchanged: unchanged.length,
					skipped: skipped.length,
					dryRun,
					outputDir,
					templates: results.map((r) => ({
						name: r.templateName,
						path: r.filePath,
						written: r.written,
						reason: r.reason,
					})),
				},
				null,
				2,
			),
		);
	} else {
		if (dryRun) {
			console.log(color("cyan", "Dry run — no files written.\n"));
		}

		for (const r of results) {
			const status = r.written
				? color("green", "WRITE")
				: r.reason === "unchanged"
					? color("cyan", "SKIP (unchanged)")
					: color("yellow", "PREVIEW");
			console.log(`  ${status}  ${r.filePath}`);
		}

		console.log(
			`\n${color("cyan", "Summary:")} ${results.length} templates, ${written.length} written, ${unchanged.length} unchanged`,
		);
	}

	return { success: true };
}
