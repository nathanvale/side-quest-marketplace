/**
 * WebClipper template management CLI handler.
 *
 * Provides subcommands for listing, exporting, syncing, and converting
 * WebClipper templates to/from Templater format.
 *
 * @module cli/clipper
 */

import { bold, cyan, emphasize } from "@sidequest/core/terminal";
import {
	exportAllToTemplater,
	exportToTemplater,
	exportToWebClipperSettings,
	extractTemplateMetadata,
	getTemplate,
	listTemplates,
	syncFromWebClipperSettings,
} from "../clipper";
import {
	cliLogger,
	createCorrelationId,
	getLogFile,
	initLoggerWithNotice,
} from "../shared/logger";
import { startSession } from "./shared/session";
import type { CommandContext, CommandResult } from "./types";

/**
 * Handle clipper subcommand.
 *
 * Usage:
 *   para clipper list                    # List available templates
 *   para clipper export [--out path]     # Export to WebClipper settings.json
 *   para clipper sync <settings.json>    # Import changes from WebClipper
 *   para clipper convert <name> [--out]  # Convert single template to Templater MD
 *   para clipper convert-all [--out dir] # Convert all templates to Templater MD
 */
export async function handleClipper(
	ctx: CommandContext,
): Promise<CommandResult> {
	const { config, flags, isJson, subcommand, positional } = ctx;

	// Start session with correlation ID tracking
	const session = startSession("para clipper", { silent: isJson });
	const sessionCid = session.sessionCid;

	await initLoggerWithNotice();
	if (!isJson) {
		console.log(emphasize.info(`Logs: ${getLogFile()}`));
	}

	const cid = createCorrelationId();
	cliLogger.info`cli:clipper:start cid=${cid} sessionCid=${sessionCid} subcommand=${subcommand || "list"}`;

	let result: CommandResult;
	const startTime = Date.now();

	try {
		switch (subcommand) {
			case "list":
				result = handleClipperList(isJson, sessionCid, cid);
				break;
			case "export":
				result = await handleClipperExport(flags, isJson, sessionCid, cid);
				break;
			case "sync":
				result = await handleClipperSync(positional, isJson, sessionCid, cid);
				break;
			case "convert":
				result = await handleClipperConvert(
					positional,
					flags,
					config,
					isJson,
					sessionCid,
					cid,
				);
				break;
			case "convert-all":
				result = await handleClipperConvertAll(
					flags,
					config,
					isJson,
					sessionCid,
					cid,
				);
				break;
			default:
				// Default to list if no subcommand
				result = handleClipperList(isJson, sessionCid, cid);
		}
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		cliLogger.error`cli:clipper:error cid=${cid} sessionCid=${sessionCid} error=${errorMsg} durationMs=${Date.now() - startTime}`;
		session.end({ error: errorMsg });
		return { success: false, error: errorMsg };
	}

	cliLogger.info`cli:clipper:complete cid=${cid} sessionCid=${sessionCid} success=${result.success} durationMs=${Date.now() - startTime}`;

	session.end({ success: result.success });
	return result;
}

/**
 * List available WebClipper templates.
 */
function handleClipperList(
	isJson: boolean,
	sessionCid: string,
	cid: string,
): CommandResult {
	cliLogger.info`cli:clipper:list:start cid=${cid} sessionCid=${sessionCid}`;

	const { templates, error } = listTemplates();

	if (error) {
		return { success: false, error };
	}

	if (isJson) {
		console.log(JSON.stringify({ templates }, null, 2));
	} else {
		console.log(cyan("\nWebClipper Templates"));
		console.log(emphasize.dim("─".repeat(60)));

		for (const t of templates) {
			console.log(`  ${bold(t.name)}`);
			if (t.triggers.length > 0) {
				console.log(
					emphasize.dim(
						`    Triggers: ${t.triggers.slice(0, 3).join(", ")}${t.triggers.length > 3 ? "..." : ""}`,
					),
				);
			}
		}

		console.log(emphasize.dim("─".repeat(60)));
		console.log(`  ${templates.length} templates available\n`);
	}

	cliLogger.info`cli:clipper:list:complete cid=${cid} sessionCid=${sessionCid} templateCount=${templates.length}`;

	return { success: true };
}

/**
 * Export templates to WebClipper settings.json.
 */
async function handleClipperExport(
	flags: CommandContext["flags"],
	isJson: boolean,
	sessionCid: string,
	cid: string,
): Promise<CommandResult> {
	const outputPath =
		typeof flags.out === "string"
			? flags.out
			: "obsidian-web-clipper-settings.json";

	cliLogger.info`cli:clipper:export:start cid=${cid} sessionCid=${sessionCid} outputPath=${outputPath}`;

	const result = await exportToWebClipperSettings(outputPath);

	if (!result.success) {
		return { success: false, error: result.error };
	}

	if (isJson) {
		console.log(
			JSON.stringify(
				{
					success: true,
					outputPath: result.outputPath,
					templateCount: result.templateCount,
					warnings: result.warnings,
				},
				null,
				2,
			),
		);
	} else {
		console.log(
			emphasize.success(
				`\nExported ${result.templateCount} templates to ${result.outputPath}`,
			),
		);
		if (result.warnings && result.warnings.length > 0) {
			for (const w of result.warnings) {
				console.log(emphasize.warn(`  ⚠ ${w}`));
			}
		}
		console.log(
			emphasize.dim(
				"\nImport this file in Obsidian Web Clipper settings to sync templates.\n",
			),
		);
	}

	cliLogger.info`cli:clipper:export:complete cid=${cid} sessionCid=${sessionCid} outputPath=${result.outputPath} templateCount=${result.templateCount}`;

	return { success: true };
}

/**
 * Sync templates from WebClipper settings.json.
 */
async function handleClipperSync(
	positional: ReadonlyArray<string>,
	isJson: boolean,
	sessionCid: string,
	cid: string,
): Promise<CommandResult> {
	const settingsPath = positional[0];

	if (!settingsPath) {
		return {
			success: false,
			error:
				"Missing settings file path. Usage: para clipper sync <settings.json>",
		};
	}

	cliLogger.info`cli:clipper:sync:start cid=${cid} sessionCid=${sessionCid} settingsPath=${settingsPath}`;

	const result = await syncFromWebClipperSettings(settingsPath);

	if (!result.success) {
		return { success: false, error: result.error };
	}

	if (isJson) {
		console.log(
			JSON.stringify(
				{
					success: true,
					added: result.added,
					updated: result.updated,
					unchanged: result.unchanged,
					warnings: result.warnings,
				},
				null,
				2,
			),
		);
	} else {
		console.log(cyan("\nSync Results"));
		console.log(emphasize.dim("─".repeat(60)));

		if (result.added.length > 0) {
			console.log(emphasize.success(`  Added (${result.added.length}):`));
			for (const name of result.added) {
				console.log(`    + ${name}`);
			}
		}

		if (result.updated.length > 0) {
			console.log(emphasize.warn(`  Updated (${result.updated.length}):`));
			for (const name of result.updated) {
				console.log(`    ~ ${name}`);
			}
		}

		if (result.unchanged.length > 0) {
			console.log(
				emphasize.dim(`  Unchanged: ${result.unchanged.length} templates`),
			);
		}

		if (result.warnings && result.warnings.length > 0) {
			console.log(emphasize.warn("\n  Warnings:"));
			for (const w of result.warnings) {
				console.log(`    ⚠ ${w}`);
			}
		}

		console.log(emphasize.dim("─".repeat(60)));
		console.log("");
	}

	cliLogger.info`cli:clipper:sync:complete cid=${cid} sessionCid=${sessionCid} added=${result.added.length} updated=${result.updated.length} unchanged=${result.unchanged.length}`;

	return { success: true };
}

/**
 * Convert a single template to Templater MD format.
 */
async function handleClipperConvert(
	positional: ReadonlyArray<string>,
	flags: CommandContext["flags"],
	config: CommandContext["config"],
	isJson: boolean,
	sessionCid: string,
	cid: string,
): Promise<CommandResult> {
	const templateName = positional[0];

	if (!templateName) {
		return {
			success: false,
			error:
				"Missing template name. Usage: para clipper convert <template-name> [--out path]",
		};
	}

	const outputPath = typeof flags.out === "string" ? flags.out : undefined;

	cliLogger.info`cli:clipper:convert:start cid=${cid} sessionCid=${sessionCid} templateName=${templateName} outputPath=${outputPath || ""}`;

	// Get template metadata first
	const { template, error: templateError } = getTemplate(templateName);
	if (templateError || !template) {
		return { success: false, error: templateError || "Template not found" };
	}

	const metadata = extractTemplateMetadata(template);

	// Export to Templater format
	const result = await exportToTemplater(templateName, outputPath, config);

	if (!result.success) {
		return { success: false, error: result.error };
	}

	if (isJson) {
		console.log(
			JSON.stringify(
				{
					success: true,
					template: templateName,
					outputPath: result.outputPath,
					metadata,
					warnings: result.warnings,
				},
				null,
				2,
			),
		);
	} else {
		if (result.outputPath) {
			console.log(
				emphasize.success(
					`\nConverted "${templateName}" → ${result.outputPath}`,
				),
			);
		} else {
			// Content was returned in warnings (stdout mode)
			const contentWarning = result.warnings?.find((w) =>
				w.startsWith("Content:"),
			);
			if (contentWarning) {
				console.log(contentWarning.replace("Content:\n", ""));
			}
		}

		// Show metadata
		console.log(emphasize.dim("\nTemplate variables:"));
		for (const v of metadata.variables) {
			const label = v.promptLabel || v.name;
			const extra = v.isDate ? " (date)" : "";
			console.log(emphasize.dim(`  - ${label}${extra}`));
		}

		if (result.warnings) {
			const nonContentWarnings = result.warnings.filter(
				(w) => !w.startsWith("Content:"),
			);
			if (nonContentWarnings.length > 0) {
				console.log(emphasize.warn("\nWarnings:"));
				for (const w of nonContentWarnings) {
					console.log(`  ⚠ ${w}`);
				}
			}
		}
		console.log("");
	}

	cliLogger.info`cli:clipper:convert:complete cid=${cid} sessionCid=${sessionCid} templateName=${templateName} outputPath=${result.outputPath || ""}`;

	return { success: true };
}

/**
 * Convert all templates to Templater MD format.
 */
async function handleClipperConvertAll(
	flags: CommandContext["flags"],
	config: CommandContext["config"],
	isJson: boolean,
	sessionCid: string,
	cid: string,
): Promise<CommandResult> {
	const outputDir = typeof flags.out === "string" ? flags.out : undefined;

	cliLogger.info`cli:clipper:convert-all:start cid=${cid} sessionCid=${sessionCid} outputDir=${outputDir || ""}`;

	const result = await exportAllToTemplater(
		outputDir || config.templatesDir || `${config.vault}/Templates`,
		config,
	);

	if (!result.success) {
		return { success: false, error: result.error };
	}

	if (isJson) {
		console.log(
			JSON.stringify(
				{
					success: true,
					outputDir: result.outputPath,
					templateCount: result.templateCount,
					warnings: result.warnings,
				},
				null,
				2,
			),
		);
	} else {
		console.log(
			emphasize.success(
				`\nConverted ${result.templateCount} templates to ${result.outputPath}`,
			),
		);

		if (result.warnings && result.warnings.length > 0) {
			console.log(emphasize.warn("\nWarnings:"));
			for (const w of result.warnings) {
				console.log(`  ⚠ ${w}`);
			}
		}
		console.log("");
	}

	cliLogger.info`cli:clipper:convert-all:complete cid=${cid} sessionCid=${sessionCid} outputDir=${result.outputPath} templateCount=${result.templateCount}`;

	return { success: true };
}
