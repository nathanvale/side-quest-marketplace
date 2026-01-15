/**
 * Config and info CLI commands.
 *
 * Handles commands for displaying configuration, templates, and areas.
 *
 * Commands:
 * - config: Display current configuration
 * - templates: List available templates with versions
 * - list-areas: List all areas in 02 Areas/
 * - template-fields: Show fields for a specific template
 *
 * @module cli/config
 */

import { emphasize } from "@sidequest/core/terminal";
import { listTemplateVersions } from "../config/index";
import { listAreas } from "../search/indexer";
import { getTemplate, getTemplateFields } from "../templates/index";
import type { CommandContext, CommandHandler, CommandResult } from "./types";

/**
 * Handle the 'config' command.
 */
export const handleConfig: CommandHandler = async (
	ctx: CommandContext,
): Promise<CommandResult> => {
	const { config, isJson } = ctx;

	if (isJson) {
		console.log(JSON.stringify(config, null, 2));
	} else {
		console.log(emphasize.info(`Vault: ${config.vault}`));
		console.log(emphasize.info(`Templates: ${config.templatesDir}`));
		if (config.indexPath)
			console.log(emphasize.info(`Index: ${config.indexPath}`));
		if (config.autoCommit !== undefined) {
			console.log(emphasize.info(`Auto-commit: ${config.autoCommit}`));
			if (config.gitCommitMessageTemplate) {
				console.log(
					emphasize.info(`Commit template: ${config.gitCommitMessageTemplate}`),
				);
			}
		}
	}

	return { success: true };
};

/**
 * Handle the 'templates' command.
 */
export const handleTemplates: CommandHandler = async (
	ctx: CommandContext,
): Promise<CommandResult> => {
	const { config, isJson } = ctx;

	const templates = listTemplateVersions(config);

	if (isJson) {
		console.log(
			JSON.stringify(
				{ templates, defaultSearchDirs: config.defaultSearchDirs },
				null,
				2,
			),
		);
	} else {
		for (const tpl of templates) {
			console.log(emphasize.info(`${tpl.name}: v${tpl.version}`));
		}
	}

	return { success: true };
};

/**
 * Handle the 'list-areas' command.
 */
export const handleListAreas: CommandHandler = async (
	ctx: CommandContext,
): Promise<CommandResult> => {
	const { config, isJson } = ctx;

	const areas = listAreas(config);

	if (isJson) {
		console.log(JSON.stringify({ areas, count: areas.length }, null, 2));
	} else {
		if (areas.length === 0) {
			console.log(emphasize.warn("No areas found in 02 Areas/"));
		} else {
			console.log(emphasize.info(`Found ${areas.length} areas:`));
			for (const area of areas) {
				console.log(`  ${area}`);
			}
		}
	}

	return { success: true };
};

/**
 * Handle the 'template-fields' command.
 */
export const handleTemplateFields: CommandHandler = async (
	ctx: CommandContext,
): Promise<CommandResult> => {
	const { config, isJson, subcommand } = ctx;

	const templateName = subcommand;
	if (!templateName) {
		console.error("template-fields requires <template> argument");
		return { success: false, exitCode: 1 };
	}

	const template = getTemplate(config, templateName);
	if (!template) {
		console.error(`Template not found: ${templateName}`);
		return { success: false, exitCode: 1 };
	}

	const fields = getTemplateFields(template);
	const requiredFields = fields.filter((f) => !f.isAutoDate && f.inFrontmatter);
	const autoFields = fields.filter((f) => f.isAutoDate);
	const bodyFields = fields.filter((f) => !f.isAutoDate && !f.inFrontmatter);

	if (isJson) {
		// Build enhanced field info with type hints
		const enhancedRequired = requiredFields.map((f) => {
			const result: {
				key: string;
				type?: string;
				example?: string;
			} = { key: f.key };

			// Check if template wraps this prompt in wikilinks
			const promptPattern = `<% tp.system.prompt("${f.key}") %>`;
			const isWrappedInWikilinks = template.content.includes(
				`[[${promptPattern}]]`,
			);

			// Infer type and example from key name
			if (f.key.toLowerCase().includes("date")) {
				result.type = "date";
				result.example = new Date().toISOString().split("T")[0];
			} else if (
				f.key.toLowerCase().includes("area") ||
				f.key.toLowerCase().includes("project")
			) {
				result.type = "wikilink";
				result.example = isWrappedInWikilinks ? "Note Name" : "[[Note Name]]";
			} else {
				result.type = "string";
			}

			return result;
		});

		// Build frontmatter hints from config rules
		const rules = config.frontmatterRules?.[templateName];
		const frontmatterHints: Record<
			string,
			{
				type: string;
				values?: readonly string[];
				default?: string;
				required?: readonly string[];
				suggested?: readonly string[];
			}
		> = {};

		if (rules?.required) {
			for (const [fieldName, rule] of Object.entries(rules.required)) {
				if (rule.type === "enum" && rule.enum) {
					frontmatterHints[fieldName] = {
						type: "enum",
						values: rule.enum,
						default: rule.enum[0],
					};
				} else if (rule.type === "array" && rule.includes) {
					frontmatterHints[fieldName] = {
						type: "array",
						required: rule.includes,
						suggested: config.suggestedTags ?? [],
					};
				}
			}
		}

		console.log(
			JSON.stringify(
				{
					template: templateName,
					version: template.version,
					fields: {
						required: enhancedRequired,
						auto: autoFields.map((f) => f.key),
						body: bodyFields.map((f) => f.key),
					},
					frontmatter_hints: frontmatterHints,
					example: Object.fromEntries(
						enhancedRequired.map((f) => [f.key, f.example ?? "..."]),
					),
				},
				null,
				2,
			),
		);
	} else {
		console.log(
			emphasize.info(`Template Fields: ${templateName} (v${template.version})`),
		);
		console.log("");

		if (requiredFields.length > 0) {
			console.log(emphasize.info("Required Fields (provide in args):"));
			for (const f of requiredFields) {
				console.log(`  - ${f.key}`);
			}
			console.log("");
		}

		if (autoFields.length > 0) {
			console.log(emphasize.info("Auto-filled Fields:"));
			for (const f of autoFields) {
				console.log(`  - ${f.key}`);
			}
			console.log("");
		}

		if (bodyFields.length > 0) {
			console.log(emphasize.info("Body Fields:"));
			for (const f of bodyFields) {
				console.log(`  - ${f.key}`);
			}
		}
	}

	return { success: true };
};
