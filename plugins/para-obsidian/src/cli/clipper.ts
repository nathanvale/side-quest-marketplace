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
 * Validate output path to prevent directory traversal attacks.
 * Rejects paths containing ".." segments.
 */
function validateOutputPath(outputPath: string): {
	valid: boolean;
	error?: string;
} {
	if (outputPath.includes("..")) {
		return {
			valid: false,
			error: "Invalid output path: path traversal detected (contains '..')",
		};
	}
	return { valid: true };
}

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
				result = await handleClipperExport(
					flags,
					positional,
					config,
					isJson,
					sessionCid,
					cid,
				);
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
		return { success: false, error: errorMsg, exitCode: 1 };
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
		return { success: false, error, exitCode: 1 };
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
 * Export templates to WebClipper settings.json or individual JSON files.
 *
 * If outputPath ends with "/" or doesn't end with ".json", exports individual files.
 * Otherwise exports a single WebClipper settings bundle.
 *
 * With --templater flag, also exports Templater .md files to the vault Templates folder.
 */
async function handleClipperExport(
	flags: CommandContext["flags"],
	positional: ReadonlyArray<string>,
	config: CommandContext["config"],
	isJson: boolean,
	sessionCid: string,
	cid: string,
): Promise<CommandResult> {
	// Accept output path from positional arg or --out flag
	const outputPath =
		positional[0] ||
		(typeof flags.out === "string" ? flags.out : null) ||
		"obsidian-web-clipper-settings.json";

	// Validate output path to prevent directory traversal
	const validation = validateOutputPath(outputPath);
	if (!validation.valid) {
		return { success: false, error: validation.error, exitCode: 1 };
	}

	const includeTemplater = flags.templater === true;

	cliLogger.info`cli:clipper:export:start cid=${cid} sessionCid=${sessionCid} outputPath=${outputPath} includeTemplater=${includeTemplater}`;

	const result = await exportToWebClipperSettings(outputPath);

	if (!result.success) {
		return { success: false, error: result.error, exitCode: 1 };
	}

	// Also export Templater .md files if --templater flag is set
	let templaterResult: {
		success: boolean;
		outputPath?: string;
		templateCount?: number;
		error?: string;
		warnings?: string[];
	} | null = null;
	if (includeTemplater) {
		const templaterDir =
			config.templatesDir || `${config.vault}/Templates/Clippings`;
		templaterResult = await exportAllToTemplater(templaterDir, config);
	}

	if (isJson) {
		console.log(
			JSON.stringify(
				{
					success: true,
					outputPath: result.outputPath,
					templateCount: result.templateCount,
					warnings: result.warnings,
					templater: templaterResult
						? {
								outputPath: templaterResult.outputPath,
								templateCount: templaterResult.templateCount,
								warnings: templaterResult.warnings,
							}
						: undefined,
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

		if (templaterResult?.success) {
			console.log(
				emphasize.success(
					`Exported ${templaterResult.templateCount} Templater templates to ${templaterResult.outputPath}`,
				),
			);
			if (templaterResult.warnings && templaterResult.warnings.length > 0) {
				for (const w of templaterResult.warnings) {
					console.log(emphasize.warn(`  ⚠ ${w}`));
				}
			}
		} else if (templaterResult && !templaterResult.success) {
			console.log(
				emphasize.warn(`\nTemplater export failed: ${templaterResult.error}`),
			);
		}

		console.log(
			emphasize.dim(
				"\nImport this file in Obsidian Web Clipper settings to sync templates.\n",
			),
		);
	}

	cliLogger.info`cli:clipper:export:complete cid=${cid} sessionCid=${sessionCid} outputPath=${result.outputPath} templateCount=${result.templateCount} templaterExported=${templaterResult?.success ?? false}`;

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
			exitCode: 1,
		};
	}

	// H8: Validate null bytes in positional argument
	if (settingsPath.includes("\0")) {
		return {
			success: false,
			error: "Invalid settings path: contains null bytes",
			exitCode: 1,
		};
	}

	cliLogger.info`cli:clipper:sync:start cid=${cid} sessionCid=${sessionCid} settingsPath=${settingsPath}`;

	const result = await syncFromWebClipperSettings(settingsPath);

	if (!result.success) {
		return { success: false, error: result.error, exitCode: 1 };
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
			exitCode: 1,
		};
	}

	// H8: Validate null bytes in positional argument
	if (templateName.includes("\0")) {
		return {
			success: false,
			error: "Invalid template name: contains null bytes",
			exitCode: 1,
		};
	}

	const outputPath = typeof flags.out === "string" ? flags.out : undefined;

	// Validate output path to prevent directory traversal
	if (outputPath) {
		const validation = validateOutputPath(outputPath);
		if (!validation.valid) {
			return { success: false, error: validation.error, exitCode: 1 };
		}
	}

	cliLogger.info`cli:clipper:convert:start cid=${cid} sessionCid=${sessionCid} templateName=${templateName} outputPath=${outputPath || ""}`;

	// Get template metadata first
	const { template, error: templateError } = getTemplate(templateName);
	if (templateError || !template) {
		return {
			success: false,
			error: templateError || "Template not found",
			exitCode: 1,
		};
	}

	const metadata = extractTemplateMetadata(template);

	// Export to Templater format
	const result = await exportToTemplater(templateName, outputPath, config);

	if (!result.success) {
		return { success: false, error: result.error, exitCode: 1 };
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

	// Validate output path to prevent directory traversal
	if (outputDir) {
		const validation = validateOutputPath(outputDir);
		if (!validation.valid) {
			return { success: false, error: validation.error, exitCode: 1 };
		}
	}

	cliLogger.info`cli:clipper:convert-all:start cid=${cid} sessionCid=${sessionCid} outputDir=${outputDir || ""}`;

	const result = await exportAllToTemplater(
		outputDir || config.templatesDir || `${config.vault}/Templates`,
		config,
	);

	if (!result.success) {
		return { success: false, error: result.error, exitCode: 1 };
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
