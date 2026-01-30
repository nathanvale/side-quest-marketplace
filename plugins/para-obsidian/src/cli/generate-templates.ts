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
import { fileURLToPath } from "node:url";
import { color } from "@sidequest/core/terminal";
import { generateWebClipperJson } from "../clipper/converter";
import type { ParaObsidianConfig } from "../config/index";
import { generateTemplate } from "../templates/generator";
import {
	buildTemplateConfig,
	fieldRulesToTemplateFields,
} from "../templates/services/field-bridge";
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
	const templateBodyConfig = config.templateBodyConfig ?? {};

	for (const templateName of Object.keys(frontmatterRules)) {
		const templateConfig = buildTemplateConfig(templateName, config);
		if (!templateConfig) continue;

		const content = generateTemplate(templateConfig, { syntax: "native" });

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

	// Generate Web Clipper JSON for templates with body config
	const pluginRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
	for (const [templateName, bodyConf] of Object.entries(templateBodyConfig)) {
		if (!bodyConf) continue;
		const rules = frontmatterRules[templateName];
		if (!rules) continue;

		const fields = fieldRulesToTemplateFields(rules);
		const sections = templateSections[templateName] ?? [];
		const titlePrefixes = config.titlePrefixes ?? {};
		const destinations = config.defaultDestinations ?? {};

		const json = generateWebClipperJson({
			templateName,
			displayName: "Capture",
			fields,
			sections,
			bodyConfig: bodyConf,
			titlePrefix: titlePrefixes[templateName] ?? "",
			destination: destinations[templateName] ?? "00 Inbox",
		});

		const jsonContent = `${JSON.stringify(json, null, "\t")}\n`;
		const jsonRelativePath = "templates/webclipper/capture.json";
		const jsonResult: GenerateResult = {
			templateName: `${templateName} (webclipper)`,
			filePath: jsonRelativePath,
			written: false,
			content: jsonContent,
		};

		if (dryRun) {
			results.push({ ...jsonResult, reason: "dry-run" });
			continue;
		}

		// Web Clipper JSON is written to plugin root, not vault
		const jsonFullPath = path.join(pluginRoot, jsonRelativePath);
		const jsonDir = path.dirname(jsonFullPath);
		fs.mkdirSync(jsonDir, { recursive: true });

		if (fs.existsSync(jsonFullPath)) {
			const existing = fs.readFileSync(jsonFullPath, "utf-8");
			if (existing === jsonContent) {
				results.push({ ...jsonResult, reason: "unchanged" });
				continue;
			}
		}

		fs.writeFileSync(jsonFullPath, jsonContent, "utf-8");
		results.push({ ...jsonResult, written: true });
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
