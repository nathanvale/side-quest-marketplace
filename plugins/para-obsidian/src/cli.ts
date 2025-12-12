#!/usr/bin/env bun

import path from "node:path";

/**
 * PARA Obsidian CLI
 *
 * Command-line interface for managing a PARA-style Obsidian vault.
 * Mirrors Kit CLI style: subcommands with minimal flags, JSON/MD output.
 */

import {
	coerceValue,
	parseArgs,
	parseKeyValuePairs,
} from "@sidequest/core/cli";
import { MetricsCollector } from "@sidequest/core/logging";
import {
	handleCleanBrokenLinks,
	handleConfig,
	handleDelete,
	handleFindOrphans,
	handleFlattenAttachments,
	handleIndex,
	handleLinkAttachments,
	handleList,
	handleListAreas,
	handleListTags,
	handleRead,
	handleRename,
	handleRewriteLinks,
	handleScanTags,
	handleSearch,
	handleSemantic,
	handleTemplateFields,
	handleTemplates,
	normalizeFlags,
	normalizeFlagValue,
	parseArgOverrides,
	parseAttachments,
	parseDirs,
	parseFrontmatterFilters,
	parseStatuses,
	parseUnset,
} from "./cli/index";
import type { CommandContext } from "./cli/types";

type MetricsSummary = ReturnType<MetricsCollector["getSummary"]>;

async function collectMetricsSummary(): Promise<MetricsSummary | null> {
	try {
		const collector = new MetricsCollector();
		await collector.collect();
		return collector.getSummary();
	} catch {
		return null;
	}
}

import {
	pathExistsSync,
	readTextFileSync,
	writeTextFileSync,
} from "@sidequest/core/fs";
import {
	color,
	emphasize,
	OutputFormat,
	parseOutputFormat,
} from "@sidequest/core/terminal";
import { createSpinner } from "nanospinner";
import { discoverAttachments } from "./attachments";
import { loadConfig, type ParaObsidianConfig } from "./config";
import { createFromTemplate, replaceSections } from "./create";
import { DEFAULT_AVAILABLE_MODELS, DEFAULT_MODEL } from "./defaults";
import {
	applyVersionPlan,
	migrateAllTemplateVersions,
	migrateTemplateVersion,
	planTemplateVersionBump,
	readFrontmatterFile,
	updateFrontmatterFile,
	type VersionPlanStatus,
	validateFrontmatter,
	validateFrontmatterBulk,
	validateFrontmatterFile,
} from "./frontmatter";
import {
	assertGitRepo,
	autoCommitChanges,
	commitAllNotes,
	commitNote,
	ensureGitGuard,
	gitStatus,
} from "./git";
import {
	displayResults,
	formatSuggestionsTable,
	runInteractiveLoop,
} from "./inbox/cli-adapter";
import { createInboxEngine } from "./inbox/engine";
import { initLoggerWithNotice, logFile } from "./inbox/logger";
import type { ExecutionResult, InboxSuggestion } from "./inbox/types";
import { type InsertMode, insertIntoNote } from "./insert";
import {
	extractMetadata,
	getWikilinkFieldsFromRules,
	validateModel,
} from "./llm";
import { MIGRATIONS } from "./migrations";

function printUsage(): void {
	const lines = [
		color("cyan", "PARA Obsidian CLI"),
		"",
		"Usage:",
		"  bun run src/cli.ts config [--format md|json]",
		"  bun run src/cli.ts templates [--format md|json]",
		"  bun run src/cli.ts template-fields <template> [--format md|json]",
		"  bun run src/cli.ts list [path] [--format md|json]",
		"  bun run src/cli.ts read <file> [--format md|json]",
		"  bun run src/cli.ts search <query> [--tag TAG] [--frontmatter key=val|--frontmatter.key val] [--regex] [--dir path[,path2]] [--glob pattern] [--context N] [--format md|json]",
		"  bun run src/cli.ts index prime [--dir path[,path2]] [--format md|json]",
		"  bun run src/cli.ts index query [--tag TAG] [--frontmatter key=val|--frontmatter.key val] [--dir path[,path2]] [--format md|json]",
		'  bun run src/cli.ts create --template <name> --title "<Title>" [--dest path] [--arg key=value ...] [--content \'{"heading": "content"}\'] [--attachments paths] [--format md|json]',
		"  bun run src/cli.ts create --template <name> --source <file> [--preview] [--model name] [--arg key=value ...] [--format md|json]",
		'  bun run src/cli.ts create --template <name> --source-text "<text>" [--preview] [--model name] [--arg key=value ...] [--format md|json]',
		'  bun run src/cli.ts insert <file> --heading "<Heading>" --content "<Content>" [--before|--after|--append|--prepend] [--attachments paths] [--format md|json]',
		"  bun run src/cli.ts rename <from> <to> [--dry-run] [--attachments paths] [--format md|json]",
		"  bun run src/cli.ts delete <file> --confirm [--dry-run] [--attachments paths] [--format md|json]",
		"  bun run src/cli.ts semantic <query> [--para folder[,folder2]] [--dir path] [--limit N] [--format md|json]",
		"  bun run src/cli.ts frontmatter get <file> [--format md|json]",
		"  bun run src/cli.ts frontmatter validate <file> [--format md|json]",
		"  bun run src/cli.ts frontmatter validate-all [--dir path[,path2]] [--type noteType] [--format md|json]",
		"  bun run src/cli.ts frontmatter set <file> key=value [...] [--unset key1,key2] [--dry-run] [--attachments paths] [--format md|json]",
		"  bun run src/cli.ts frontmatter migrate <file> [--force <version>] [--dry-run] [--attachments paths] [--format md|json]",
		"  bun run src/cli.ts frontmatter migrate-all [--dir path[,path2]] [--force <version>] [--type <type>] [--dry-run] [--attachments paths] [--format md|json]",
		"  bun run src/cli.ts frontmatter plan <type> --to <version> [--dir path[,path2]] [--save plan.json] [--format md|json]",
		"  bun run src/cli.ts frontmatter apply-plan <plan.json> [--statuses s1,s2] [--dir path[,path2]] [--emit-plan filtered.json] [--dry-run] [--attachments paths] [--format md|json]",
		"  bun run src/cli.ts frontmatter plan --interactive (prints summary/plan and exits non-interactively)",
		"  bun run src/cli.ts git guard [--format md|json]",
		"  bun run src/cli.ts find-orphans [--dir path[,path2]] [--format md|json]",
		"  bun run src/cli.ts rewrite-links --from <link> --to <link> [--dir path[,path2]] [--dry-run] [--format md|json]",
		"  bun run src/cli.ts rewrite-links --mapping <file.json> [--dir path[,path2]] [--dry-run] [--format md|json]",
		"  bun run src/cli.ts process-inbox [--auto] [--preview] [--dry-run] [--verbose] [--filter pattern] [--force] [--format md|json]",
		"",
		"Options:",
		"  --format md|json  Output format (default: md)",
		"  --force           Force reindex (index prime)",
		"  --dry-run         Preview changes without writing",
		"  --confirm         Required for delete",
		"  --attachments     Comma-separated vault-relative files to include in auto-commit",
		"  --para            PARA folder shortcuts: inbox,projects,areas,resources,archives (default: all)",
		"",
		"Examples:",
		"  bun run src/cli.ts config --format json",
		"  bun run src/cli.ts list 01_Projects",
		'  bun run src/cli.ts semantic "trip planning" --para projects,resources',
		'  bun run src/cli.ts create --template project --title "New Project" --area "[[Health]]" --target_completion 2025-12-31',
		'  bun run src/cli.ts create --template task --source "inbox/rough-notes.md" --preview',
		'  bun run src/cli.ts create --template task --source "inbox/rough-notes.md" --model qwen:7b --arg "priority=high"',
		'  bun run src/cli.ts create --template area --source-text "Managing Muffin: vet visits, grooming, food subscription"',
		'  bun run src/cli.ts rename "01_Projects/Old.md" "01_Projects/New.md" --dry-run',
	];
	console.log(
		lines.map((line) => (line === "" ? "" : color("cyan", line))).join("\n"),
	);
}

async function handleCreateFromSource(options: {
	config: ParaObsidianConfig;
	template: string;
	sourceFile?: string;
	sourceText?: string;
	model: string;
	preview: boolean;
	title?: string;
	dest?: string;
	flags: Record<string, string | boolean | (string | boolean)[] | undefined>;
	isJson: boolean;
}) {
	const {
		config,
		template,
		sourceFile,
		sourceText,
		model,
		preview,
		title,
		dest,
		flags,
		isJson,
	} = options;
	const argFlags = (flags as { arg?: string | boolean | (string | boolean)[] })
		.arg;
	const argOverrides = parseArgOverrides(argFlags);

	if (preview) {
		try {
			const extracted = await extractMetadata(config, {
				sourceFile,
				sourceContent: sourceText,
				template,
				model,
				extractContent: false, // Skip content extraction for preview (token savings)
				argOverrides,
			});

			if (isJson) {
				console.log(
					JSON.stringify(
						{
							metadata: extracted.args,
							title: extracted.title,
							model,
							preview: true,
						},
						null,
						2,
					),
				);
			} else {
				console.log(emphasize.info(`AI Suggestions (using ${model}):`));
				console.log(`  title: ${extracted.title}`);
				for (const [key, value] of Object.entries(extracted.args)) {
					if (value !== null) {
						console.log(`  ${key}: ${value}`);
					}
				}
				console.log("");
				const sourceHint = sourceFile
					? `--source "${sourceFile}"`
					: '--source-text "..."';
				console.log(
					emphasize.info(
						`To create: bun src/cli.ts create --template ${template} ${sourceHint}`,
					),
				);
				console.log(
					emphasize.info(
						'Override fields: --arg "priority=high" --arg "area=[[Work]]"',
					),
				);
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Extraction failed";
			console.error(message);
			process.exit(1);
		}
		return;
	}

	try {
		const extracted = await extractMetadata(config, {
			sourceFile,
			sourceContent: sourceText,
			template,
			model,
			extractContent: true,
			argOverrides,
		});

		const resolvedTitle = title ?? extracted.title;

		// Filter out nulls before substitution to avoid "null" strings being written
		const nonNullArgs: Record<string, string> = {};
		for (const [key, value] of Object.entries(extracted.args)) {
			if (value !== null) {
				nonNullArgs[key] = value;
			}
		}

		await ensureGitGuard(config);
		const result = createFromTemplate(config, {
			template,
			title: resolvedTitle,
			dest,
			args: nonNullArgs,
		});

		// Helper to wrap value in wikilink format for Dataview compatibility
		const toWikilink = (val: string | null): string | null => {
			if (!val || val === "null") return null;
			// Already wrapped in brackets
			if (val.startsWith("[[") && val.endsWith("]]")) return val;
			return `[[${val}]]`;
		};

		// Helper to ensure URLs have https:// prefix
		const normalizeUrl = (val: string | null): string | null => {
			if (!val || val === "null" || val === "") return null;
			// Already has protocol
			if (val.startsWith("http://") || val.startsWith("https://")) return val;
			// Add https:// prefix
			return `https://${val}`;
		};

		// Clean up wikilink fields - ONLY set fields defined in this template's schema
		// Wrap in [[...]] for Dataview compatibility (wikilinks must be quoted in YAML)
		// ALSO apply argOverrides to ensure they take precedence over LLM extraction
		const frontmatterCleanup: Record<string, unknown> = {};
		const rules = config.frontmatterRules?.[template];
		const wikilinkFields = getWikilinkFieldsFromRules(rules);
		const urlFields = ["contact_url", "url", "website", "source_url"];
		for (const field of wikilinkFields) {
			const extractedValue = Object.entries(extracted.args).find(([key]) =>
				key.toLowerCase().includes(field),
			)?.[1];
			// ALWAYS set wikilink fields defined in schema - wrap in [[...]] or null
			// This ensures Dataview-compatible wikilink format
			frontmatterCleanup[field] = toWikilink(extractedValue ?? null);
		}
		// Normalize URL fields - ensure they have https:// prefix
		for (const field of urlFields) {
			const extractedValue = Object.entries(extracted.args).find(
				([key]) => key.toLowerCase() === field.toLowerCase(),
			)?.[1];
			if (extractedValue) {
				frontmatterCleanup[field] = normalizeUrl(extractedValue);
			}
		}

		// Apply argOverrides to frontmatter (ensures overrides win regardless of key casing)
		if (argOverrides && Object.keys(argOverrides).length > 0) {
			for (const [key, value] of Object.entries(argOverrides)) {
				// For wikilink fields, ensure brackets are present
				if (wikilinkFields.includes(key.toLowerCase())) {
					frontmatterCleanup[key] = toWikilink(value);
				} else {
					frontmatterCleanup[key] = value;
				}
			}
		}

		if (Object.keys(frontmatterCleanup).length > 0) {
			updateFrontmatterFile(config, result.filePath, {
				set: frontmatterCleanup,
				dryRun: false,
			});
		}

		let injectionResult:
			| {
					injected: string[];
					skipped: Array<{ heading: string; reason: string }>;
			  }
			| undefined;
		if (extracted.content && Object.keys(extracted.content).length > 0) {
			injectionResult = replaceSections(
				config,
				result.filePath,
				extracted.content,
				{ preserveComments: true },
			);
		}

		const flagsWithoutUndefined = Object.fromEntries(
			Object.entries(flags).filter(([, value]) => value !== undefined),
		) as Record<string, string | boolean | (string | boolean)[]>;

		const attachments = withAutoDiscoveredAttachments(
			config,
			result.filePath,
			parseAttachments(normalizeFlags(flagsWithoutUndefined)),
		);
		if (config.autoCommit) {
			await autoCommitChanges(
				config,
				[result.filePath, ...attachments],
				`create ${result.filePath}`,
			);
		}

		if (isJson) {
			const output: Record<string, unknown> = {
				filePath: result.filePath,
				content: result.content,
				model,
			};
			if (injectionResult) {
				output.sectionsInjected = injectionResult.injected.length;
				output.sectionsSkipped = injectionResult.skipped;
				output.injectedHeadings = injectionResult.injected;
			}
			console.log(JSON.stringify(output, null, 2));
		} else {
			console.log(emphasize.success(`Created ${result.filePath}`));
			if (injectionResult) {
				if (injectionResult.injected.length > 0) {
					console.log(
						emphasize.info(
							`Injected content into ${injectionResult.injected.length} section(s): ${injectionResult.injected.join(", ")}`,
						),
					);
				}
				if (injectionResult.skipped.length > 0) {
					console.log(
						emphasize.warn(
							`Skipped ${injectionResult.skipped.length} section(s):`,
						),
					);
					for (const skip of injectionResult.skipped) {
						console.log(`  - ${skip.heading}: ${skip.reason}`);
					}
				}
			}
		}
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "AI extraction failed";
		console.error(message);
		process.exit(1);
	}
}

export function suggestFieldsForType(
	config: ParaObsidianConfig,
	type?: string,
): { allowed: string[]; enums: Record<string, ReadonlyArray<string>> } {
	const rules = type ? config.frontmatterRules?.[type] : undefined;
	const allowed = rules?.required ? Object.keys(rules.required).sort() : [];
	const enums: Record<string, ReadonlyArray<string>> = {};
	if (rules?.required) {
		for (const [field, rule] of Object.entries(rules.required)) {
			if (rule.type === "enum" && rule.enum) {
				enums[field] = rule.enum;
			}
		}
	}
	return { allowed, enums };
}

export function computeFrontmatterHints(
	config: ParaObsidianConfig,
	noteType: string | undefined,
	setPairs: Record<string, string>,
	attributes: Record<string, unknown>,
) {
	const suggestions = suggestFieldsForType(config, noteType);
	const warnings: string[] = [];
	const fixHints: string[] = [];

	// Unknown fields
	if (suggestions.allowed.length > 0) {
		for (const key of Object.keys(setPairs)) {
			if (!suggestions.allowed.includes(key)) {
				warnings.push(`Unknown field for type ${noteType}: ${key}`);
				fixHints.push(
					`Remove or rename "${key}" to a known field for type ${noteType}`,
				);
			}
		}
		if (warnings.length > 0) {
			fixHints.push(
				`Allowed fields for type ${noteType}: ${suggestions.allowed.join(", ")}`,
			);
		}
	}

	// Enum mismatches
	if (noteType) {
		const rules = config.frontmatterRules?.[noteType]?.required ?? {};
		for (const [field, rule] of Object.entries(rules)) {
			if (rule.type === "enum" && rule.enum && field in attributes) {
				const val = attributes[field];
				if (typeof val === "string" && !rule.enum.includes(val)) {
					warnings.push(
						`Invalid value for ${field}: ${val} (allowed: ${rule.enum.join(", ")})`,
					);
					fixHints.push(
						`Field "${field}" allowed values: ${rule.enum.join(", ")}`,
					);
				}
			}
		}
	}

	return { warnings, fixHints, suggestions };
}

function withAutoDiscoveredAttachments(
	config: ParaObsidianConfig,
	note: string,
	explicit: ReadonlyArray<string>,
): ReadonlyArray<string> {
	if (explicit.length > 0) return explicit;
	return discoverAttachments(config.vault, note);
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	if (args.length === 0 || args.includes("--help")) {
		printUsage();
		return;
	}

	const { command, subcommand, positional, flags } = parseArgs(args);
	const format = parseOutputFormat(
		typeof flags.format === "string" ? flags.format : undefined,
	);
	const isJson = format === OutputFormat.JSON;

	try {
		// Always load config early to ensure vault/env are valid.
		const config = loadConfig();

		// Build context for command handlers
		const ctx: CommandContext = {
			config,
			positional,
			flags: normalizeFlags(flags),
			format,
			isJson,
			subcommand,
		};

		switch (command) {
			case "config": {
				const result = await handleConfig(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "templates": {
				const result = await handleTemplates(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "list-areas": {
				const result = await handleListAreas(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "list-tags": {
				const result = await handleListTags(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "scan-tags": {
				const result = await handleScanTags(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "template-fields": {
				const result = await handleTemplateFields(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "rename": {
				const result = await handleRename(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "flatten-attachments": {
				const result = await handleFlattenAttachments(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "link-attachments": {
				const result = await handleLinkAttachments(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "find-orphans": {
				const result = await handleFindOrphans(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "clean-broken-links": {
				const result = await handleCleanBrokenLinks(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "rewrite-links": {
				const result = await handleRewriteLinks(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "delete": {
				const result = await handleDelete(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "list": {
				const result = await handleList(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "read": {
				const result = await handleRead(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "index": {
				const result = await handleIndex(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "search": {
				const result = await handleSearch(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "semantic": {
				const result = await handleSemantic(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "create": {
				const template =
					typeof flags.template === "string" ? flags.template : undefined;
				const title = typeof flags.title === "string" ? flags.title : undefined;
				const dest = typeof flags.dest === "string" ? flags.dest : undefined;
				const contentJson =
					typeof flags.content === "string" ? flags.content : undefined;
				const sourceFile =
					typeof flags.source === "string" ? flags.source : undefined;
				const sourceText =
					typeof flags["source-text"] === "string"
						? flags["source-text"]
						: undefined;
				const preview = flags.preview === true || flags.preview === "true";
				const modelFlag =
					typeof flags.model === "string" ? flags.model : undefined;

				// Validate required flags based on mode
				if (sourceFile || sourceText) {
					// AI-powered mode: --source or --source-text is provided
					if (!template) {
						console.error(
							"create with --source or --source-text requires --template",
						);
						process.exit(1);
					}

					// Get model from flags, config, or default
					const availableModels = config.availableModels ?? [
						...DEFAULT_AVAILABLE_MODELS,
					];
					const defaultModel = config.defaultModel ?? DEFAULT_MODEL;
					const model = modelFlag ?? defaultModel;

					// Validate model against available models
					try {
						validateModel(model, availableModels);
					} catch (error) {
						const message =
							error instanceof Error ? error.message : "Invalid model";
						console.error(message);
						process.exit(1);
					}

					await handleCreateFromSource({
						config,
						template,
						sourceFile,
						sourceText,
						model,
						preview,
						title,
						dest,
						flags: flags as Record<
							string,
							string | boolean | (string | boolean)[] | undefined
						>,
						isJson,
					});
					break;
				}

				// Blank template mode (original behavior when --source is NOT provided)
				if (!template || !title) {
					console.error("create requires --template and --title");
					process.exit(1);
				}

				// Parse --content JSON if provided
				let contentSections: Record<string, string> | undefined;
				if (contentJson) {
					try {
						contentSections = JSON.parse(contentJson);
						if (
							typeof contentSections !== "object" ||
							contentSections === null
						) {
							throw new Error("--content must be a JSON object");
						}
					} catch (e) {
						const msg = e instanceof Error ? e.message : "Invalid JSON";
						console.error(`Invalid --content JSON: ${msg}`);
						process.exit(1);
					}
				}

				// Normalize --arg flags to array, then parse key=value pairs
				const argValues: string[] = [];
				if (flags.arg !== undefined) {
					if (Array.isArray(flags.arg)) {
						argValues.push(
							...(flags.arg.filter((v) => typeof v === "string") as string[]),
						);
					} else if (typeof flags.arg === "string") {
						argValues.push(flags.arg);
					}
				}
				const argsForTemplate = parseKeyValuePairs(argValues);

				await ensureGitGuard(config);
				const result = createFromTemplate(config, {
					template,
					title,
					dest,
					args: argsForTemplate,
				});

				// Inject content into sections if provided
				let injectionResult:
					| {
							injected: string[];
							skipped: Array<{ heading: string; reason: string }>;
					  }
					| undefined;
				if (contentSections && Object.keys(contentSections).length > 0) {
					injectionResult = replaceSections(
						config,
						result.filePath,
						contentSections,
						{ preserveComments: true },
					);
				}

				const attachments = withAutoDiscoveredAttachments(
					config,
					result.filePath,
					parseAttachments(normalizeFlags(flags)),
				);
				if (config.autoCommit) {
					await autoCommitChanges(
						config,
						[result.filePath, ...attachments],
						`create ${result.filePath}`,
					);
				}
				if (isJson) {
					const output: Record<string, unknown> = {
						filePath: result.filePath,
						content: result.content,
					};
					if (injectionResult) {
						output.sectionsInjected = injectionResult.injected.length;
						output.sectionsSkipped = injectionResult.skipped;
						output.injectedHeadings = injectionResult.injected;
					}
					console.log(JSON.stringify(output, null, 2));
				} else {
					console.log(emphasize.success(`Created ${result.filePath}`));
					if (injectionResult) {
						if (injectionResult.injected.length > 0) {
							console.log(
								emphasize.info(
									`Injected content into ${injectionResult.injected.length} section(s): ${injectionResult.injected.join(", ")}`,
								),
							);
						}
						if (injectionResult.skipped.length > 0) {
							console.log(
								emphasize.warn(
									`Skipped ${injectionResult.skipped.length} section(s):`,
								),
							);
							for (const skip of injectionResult.skipped) {
								console.log(`  - ${skip.heading}: ${skip.reason}`);
							}
						}
					}
				}
				break;
			}

			case "frontmatter": {
				const action = subcommand;
				const target = positional[0];
				// validate-all, migrate-all, plan, and apply-plan don't require a target file
				const requiresTarget = ![
					"validate-all",
					"migrate-all",
					"plan",
					"apply-plan",
				].includes(action ?? "");
				if (!action || (requiresTarget && !target)) {
					console.error(
						requiresTarget
							? "frontmatter requires action and <file>"
							: "frontmatter requires action",
					);
					process.exit(1);
				}

				if (action === "get") {
					if (!target) {
						console.error("frontmatter get requires <file>");
						process.exit(1);
					}
					const { attributes } = readFrontmatterFile(config, target);
					if (isJson) {
						console.log(
							JSON.stringify(
								{ file: target, frontmatter: attributes },
								null,
								2,
							),
						);
					} else {
						console.log(JSON.stringify(attributes, null, 2));
					}
					break;
				}

				if (action === "validate") {
					if (!target) {
						console.error("frontmatter validate requires <file>");
						process.exit(1);
					}
					const result = validateFrontmatterFile(config, target);
					if (isJson) {
						console.log(
							JSON.stringify(
								{
									file: result.relative,
									valid: result.valid,
									issues: result.issues,
								},
								null,
								2,
							),
						);
					} else {
						if (result.valid) {
							console.log(
								emphasize.success(`${result.relative} frontmatter ok`),
							);
						} else {
							console.log(emphasize.warn(`${result.relative} has issues:`));
							for (const issue of result.issues) {
								console.log(`- ${issue.field}: ${issue.message}`);
							}
						}
					}
					break;
				}

				if (action === "validate-all") {
					const dirs = parseDirs(
						normalizeFlagValue(flags.dir),
						config.defaultSearchDirs,
					);
					const type =
						typeof flags.type === "string" && flags.type.trim().length > 0
							? flags.type.trim()
							: undefined;

					const result = validateFrontmatterBulk(config, { dirs, type });

					if (isJson) {
						console.log(JSON.stringify(result, null, 2));
					} else {
						const { summary, issues } = result;
						const totalFiles = summary.total;
						const validFiles = summary.valid;
						const invalidFiles = summary.invalid;

						// Overall summary
						if (invalidFiles === 0) {
							console.log(
								emphasize.success(
									`✓ All ${totalFiles} file(s) passed validation`,
								),
							);
						} else {
							console.log(
								emphasize.warn(
									`${invalidFiles} of ${totalFiles} file(s) have issues (${validFiles} valid)`,
								),
							);
						}

						// Per-type breakdown
						if (Object.keys(summary.byType).length > 0) {
							console.log("\nBy type:");
							for (const [noteType, stats] of Object.entries(summary.byType)) {
								const status =
									stats.invalid === 0
										? emphasize.success("✓")
										: emphasize.warn("✗");
								console.log(
									`  ${status} ${noteType}: ${stats.valid}/${stats.total} valid`,
								);
							}
						}

						// Show detailed issues for files that failed
						const filesWithIssues = issues.filter((f) => !f.valid);
						if (filesWithIssues.length > 0) {
							console.log("\nFiles with issues:");
							for (const file of filesWithIssues) {
								console.log(emphasize.warn(`\n${file.file}:`));
								for (const error of file.errors) {
									console.log(`  - ${error.field}: ${error.message}`);
								}
							}
						}
					}
					break;
				}

				if (action === "set" || action === "edit") {
					if (!target) {
						console.error("frontmatter set|edit requires <file>");
						process.exit(1);
					}
					const dryRun =
						flags["dry-run"] === true || flags["dry-run"] === "true";
					const strict = flags.strict === true || flags.strict === "true";
					const suggestOnly =
						flags.suggest === true || flags.suggest === "true";
					const attachments = parseAttachments(normalizeFlags(flags));
					const unset = parseUnset(normalizeFlagValue(flags.unset));
					const additionalPairs = positional.slice(1);
					const setPairs = {
						...parseFrontmatterFilters(normalizeFlags(flags), []),
						...parseKeyValuePairs(additionalPairs),
						...(typeof flags.set === "string"
							? parseKeyValuePairs([flags.set])
							: {}),
					};
					if (Object.keys(setPairs).length === 0 && unset.length === 0) {
						console.error(
							"frontmatter set|edit requires key=value pairs or --unset keys",
						);
						process.exit(1);
					}

					const typed: Record<string, unknown> = {};
					for (const [k, v] of Object.entries(setPairs)) {
						typed[k] = coerceValue(v);
					}

					const preview = updateFrontmatterFile(config, target, {
						set: typed,
						unset,
						dryRun: true,
					});

					const after = preview.attributes.after;
					const noteType =
						typeof after.type === "string" ? (after.type as string) : undefined;
					const rules = noteType
						? config.frontmatterRules?.[noteType]
						: undefined;
					const validation = validateFrontmatter(after, rules);
					const { warnings, fixHints, suggestions } = computeFrontmatterHints(
						config,
						noteType,
						setPairs,
						after,
					);
					if (!validation.valid) {
						for (const issue of validation.issues) {
							warnings.push(`${issue.field}: ${issue.message}`);
							if (
								issue.message.includes("one of") &&
								noteType &&
								suggestions.enums[issue.field]
							) {
								const enumValues = suggestions.enums[issue.field];
								if (enumValues) {
									fixHints.push(
										`Field "${issue.field}" allowed values: ${enumValues.join(", ")}`,
									);
								}
							}
							fixHints.push(`Fix ${issue.field}: ${issue.message}`);
						}
					}

					if (suggestOnly) {
						if (isJson) {
							console.log(
								JSON.stringify(
									{ suggest: suggestions, file: target, type: noteType },
									null,
									2,
								),
							);
						} else {
							console.log(
								emphasize.info(
									`Fields for type ${noteType ?? "unknown"}${suggestions.allowed.length === 0 ? "" : ":"}`,
								),
							);
							if (suggestions.allowed.length > 0) {
								console.log(`Allowed: ${suggestions.allowed.join(", ")}`);
							}
							if (Object.keys(suggestions.enums).length > 0) {
								console.log("Enums:");
								for (const [field, vals] of Object.entries(suggestions.enums)) {
									console.log(`- ${field}: ${vals.join(", ")}`);
								}
							}
						}
						break;
					}

					const strictFailed = strict && warnings.length > 0;
					const invalid = !validation.valid;

					if (!dryRun && !invalid) {
						await ensureGitGuard(config);
					}

					const result =
						dryRun || strictFailed || invalid
							? preview
							: updateFrontmatterFile(config, target, {
									set: typed,
									unset,
									dryRun,
								});

					const attachmentsUsed = withAutoDiscoveredAttachments(
						config,
						target,
						attachments,
					);

					if (
						config.autoCommit &&
						!dryRun &&
						result.updated &&
						!strictFailed &&
						!invalid
					) {
						await autoCommitChanges(
							config,
							[result.relative, ...attachmentsUsed],
							`frontmatter ${action} ${target}`,
						);
					}

					if (isJson) {
						console.log(
							JSON.stringify(
								{
									...result,
									attachmentsUsed,
									action,
									warnings,
									fixHints,
									strictFailed,
									suggest: suggestions,
								},
								null,
								2,
							),
						);
						if (strictFailed || invalid) process.exit(1);
					} else {
						if (!result.wouldChange) {
							console.log(emphasize.info(`${result.relative} unchanged`));
						} else {
							// Use result.updated to accurately reflect if write happened
							// (validation failures return preview with updated: false)
							const verb = result.updated ? "Updated" : "Would update";
							console.log(
								emphasize.success(
									`${verb} ${result.relative} (${result.changes.length} change(s))`,
								),
							);
							for (const change of result.changes) {
								console.log(`- ${change}`);
							}
						}
						if (warnings.length > 0) {
							console.log(emphasize.warn("Warnings:"));
							for (const w of warnings) console.log(`- ${w}`);
						}
						if (strictFailed || invalid) {
							process.exit(1);
						}
					}

					break;
				}

				if (action === "migrate") {
					if (!target) {
						console.error("frontmatter migrate requires <file>");
						process.exit(1);
					}
					const dryRun =
						flags["dry-run"] === true || flags["dry-run"] === "true";
					const forceVersionRaw =
						typeof flags.force === "string"
							? Number.parseInt(flags.force, 10)
							: undefined;
					if (
						forceVersionRaw !== undefined &&
						!Number.isFinite(forceVersionRaw)
					) {
						throw new Error(
							`Invalid --force value: "${flags.force}" (must be a valid integer)`,
						);
					}
					const forceVersion = forceVersionRaw;
					const attachments = parseAttachments(normalizeFlags(flags));
					if (!dryRun) {
						await ensureGitGuard(config);
					}
					const result = migrateTemplateVersion(config, target, {
						forceVersion,
						dryRun,
						migrate: MIGRATIONS,
					});
					const attachmentsUsed = withAutoDiscoveredAttachments(
						config,
						target,
						attachments,
					);
					if (config.autoCommit && !dryRun) {
						await autoCommitChanges(
							config,
							[target, ...attachmentsUsed],
							`migrate ${target} to v${result.toVersion}`,
						);
					}
					if (isJson) {
						console.log(JSON.stringify({ ...result, attachmentsUsed }));
					} else {
						const changeNote =
							result.changes && result.changes.length > 0
								? `\nChanges:\n- ${result.changes.join("\n- ")}`
								: "";
						const status = result.wouldChange
							? `${dryRun ? "Would migrate" : "Migrated"} ${result.relative} to template_version ${result.toVersion}`
							: `${result.relative} already at template_version ${result.toVersion}`;
						console.log(status + changeNote);
					}
					break;
				}

				if (action === "migrate-all") {
					const dryRun =
						flags["dry-run"] === true || flags["dry-run"] === "true";
					const dir = parseDirs(
						normalizeFlagValue(flags.dir),
						config.defaultSearchDirs,
					);
					const forceVersionRaw =
						typeof flags.force === "string"
							? Number.parseInt(flags.force, 10)
							: undefined;
					if (
						forceVersionRaw !== undefined &&
						!Number.isFinite(forceVersionRaw)
					) {
						throw new Error(
							`Invalid --force value: "${flags.force}" (must be a valid integer)`,
						);
					}
					const forceVersion = forceVersionRaw;
					const type =
						typeof flags.type === "string" && flags.type.trim().length > 0
							? flags.type.trim()
							: undefined;
					const attachments = parseAttachments(normalizeFlags(flags));
					if (!dryRun) {
						await ensureGitGuard(config);
					}
					const result = migrateAllTemplateVersions(config, {
						dir,
						dryRun,
						forceVersion,
						type,
						migrate: MIGRATIONS,
					});
					// Get changed notes for attachment discovery and commit
					const changed = result.results
						.filter(
							(r): r is (typeof result.results)[number] => r.updated === true,
						)
						.map((r) => r.relative);
					// Only auto-discover attachments for changed notes
					const autoAttachments =
						attachments.length > 0
							? attachments
							: changed.flatMap((r) =>
									withAutoDiscoveredAttachments(config, r, []),
								);
					if (config.autoCommit && !dryRun && changed.length > 0) {
						await autoCommitChanges(
							config,
							[...changed, ...autoAttachments],
							`migrate ${changed.length} note(s)`,
						);
					}
					if (isJson) {
						console.log(
							JSON.stringify({
								...result,
								attachmentsUsed: autoAttachments,
								changes: result.changes,
								errors: result.results
									.filter((r) => r.error)
									.map((r) => ({ file: r.relative, error: r.error })),
							}),
						);
					} else {
						const changeCount = result.changes.length;
						const summary = `${dryRun ? "Would migrate" : "Migrated"}: updated ${result.updated} (${result.wouldUpdate} would update), skipped ${result.skipped}, errors ${result.errors}, changes ${changeCount}`;
						console.log(emphasize.info(summary));
						if (changeCount > 0) {
							console.log("Changes:");
							for (const change of result.changes) {
								console.log(`- ${change.file}: ${change.changes.join("; ")}`);
							}
						}
						if (result.errors > 0) {
							for (const err of result.results.filter((r) => r.error)) {
								console.log(
									emphasize.warn(
										`- ${err.relative}: ${err.error ?? "unknown error"}`,
									),
								);
							}
						}
					}
					break;
				}

				if (action === "apply-plan") {
					const planPath =
						typeof target === "string" && target.trim().length > 0
							? target
							: typeof flags.plan === "string"
								? flags.plan
								: undefined;
					if (!planPath) {
						console.error(
							"frontmatter apply-plan requires <plan file> or --plan <file>",
						);
						process.exit(1);
					}
					const dryRun =
						flags["dry-run"] === true || flags["dry-run"] === "true";
					const statuses = parseStatuses(normalizeFlagValue(flags.statuses), [
						"outdated",
						"missing-version",
						"current",
					]) as VersionPlanStatus[];
					const emitPlan =
						typeof flags["emit-plan"] === "string"
							? path.resolve(flags["emit-plan"])
							: undefined;
					const planAbs = path.resolve(planPath);
					if (!pathExistsSync(planAbs)) {
						console.error(`Plan file not found: ${planAbs}`);
						process.exit(1);
					}
					const plan = JSON.parse(readTextFileSync(planAbs));
					if (!plan?.entries || !Array.isArray(plan.entries)) {
						console.error("Plan file must contain entries[]");
						process.exit(1);
					}
					if (typeof plan.targetVersion !== "number" || !plan.type) {
						console.error("Plan file must include targetVersion and type");
						process.exit(1);
					}

					// Use plan.dirs unless user explicitly specified --dir
					const userSpecifiedDir = normalizeFlagValue(flags.dir);
					const dirs =
						userSpecifiedDir !== undefined
							? parseDirs(userSpecifiedDir, config.defaultSearchDirs)
							: (plan.dirs ?? config.defaultSearchDirs ?? []);

					const attachments = parseAttachments(normalizeFlags(flags));
					if (!dryRun) {
						await ensureGitGuard(config);
					}
					const result = applyVersionPlan(config, {
						plan,
						dryRun,
						statuses,
						dirs,
						migrate: MIGRATIONS,
					});
					const filteredPlan =
						emitPlan || isJson
							? {
									type: plan.type,
									targetVersion: plan.targetVersion,
									dirs,
									entries: result.selected,
									stats: {
										total: result.selected.length,
										outdated: result.selected.filter(
											(e) => e.status === "outdated",
										).length,
										missingVersion: result.selected.filter(
											(e) => e.status === "missing-version",
										).length,
										current: result.selected.filter(
											(e) => e.status === "current",
										).length,
										ahead: result.selected.filter((e) => e.status === "ahead")
											.length,
										typeMismatch: result.selected.filter(
											(e) => e.status === "type-mismatch",
										).length,
										missingType: result.selected.filter(
											(e) => e.status === "missing-type",
										).length,
									},
								}
							: undefined;
					if (emitPlan && filteredPlan) {
						writeTextFileSync(emitPlan, JSON.stringify(filteredPlan, null, 2));
					}
					const updatedFiles = result.results
						.filter((r) => r.updated)
						.map((r) => r.relative);
					const autoAttachments =
						attachments.length > 0
							? attachments
							: updatedFiles.flatMap((file) =>
									withAutoDiscoveredAttachments(config, file, []),
								);

					if (config.autoCommit && !dryRun && updatedFiles.length > 0) {
						await autoCommitChanges(
							config,
							[...new Set([...updatedFiles, ...autoAttachments])],
							`apply plan (${updatedFiles.length} file(s))`,
						);
					}

					if (isJson) {
						console.log(
							JSON.stringify(
								{
									...result,
									attachmentsUsed: autoAttachments,
									statuses,
									dirs,
									planFile: planAbs,
									filteredPlan,
									savedPlan: emitPlan,
								},
								null,
								2,
							),
						);
					} else {
						console.log(
							emphasize.info(
								`${dryRun ? "Would apply" : "Applied"} plan from ${planAbs}: updated ${result.updated}, would update ${result.wouldUpdate}, skipped ${result.skipped}, errors ${result.errors}`,
							),
						);
						if (filteredPlan) {
							console.log(
								emphasize.info(
									`Selected entries: ${filteredPlan.entries.length} (outdated ${filteredPlan.stats.outdated}, missing-version ${filteredPlan.stats.missingVersion}, current ${filteredPlan.stats.current})`,
								),
							);
						}
						if (emitPlan && filteredPlan) {
							console.log(
								emphasize.success(`Saved filtered plan to ${emitPlan}`),
							);
						}
						if (result.selected.length > 0) {
							console.log("Selected:");
							for (const entry of result.selected) {
								const cur = entry.current ?? "none";
								console.log(
									`- ${entry.file} (${entry.status}) ${cur} -> ${entry.target}`,
								);
							}
						}
						if (result.changes.length > 0) {
							console.log("Changes:");
							for (const change of result.changes) {
								console.log(`- ${change.file}: ${change.changes.join("; ")}`);
							}
						}
						if (result.errors > 0) {
							for (const err of result.results.filter((r) => r.error)) {
								console.log(
									emphasize.warn(
										`- ${err.relative}: ${err.error ?? "unknown error"}`,
									),
								);
							}
						}
					}

					break;
				}

				if (action === "plan") {
					const type =
						typeof target === "string" && target.trim().length > 0
							? target.trim()
							: undefined;
					const to =
						typeof flags.to === "string"
							? Number.parseInt(flags.to, 10)
							: undefined;
					if (!type || !to) {
						console.error(
							"frontmatter plan requires <type> and --to <version>",
						);
						process.exit(1);
					}
					const dir = parseDirs(
						normalizeFlagValue(flags.dir),
						config.defaultSearchDirs,
					);
					if (flags.interactive === true || flags.interactive === "true") {
						const plan = planTemplateVersionBump(config, {
							type,
							toVersion: to,
							dir,
						});
						console.log(
							emphasize.info(
								`Plan summary (interactive stub): type=${type}, target=${to}, dirs=${plan.dirs.join(", ")}`,
							),
						);
						console.log(
							emphasize.info(
								`Outdated ${plan.outdated}, missing ${plan.missingVersion}, current ${plan.current}, ahead ${plan.ahead}`,
							),
						);
						console.log(
							emphasize.info(
								`Per-type: ${Object.entries(plan.perType)
									.map(
										([t, s]) =>
											`${t}: total ${s.total}, outdated ${s.outdated}, missing ${s.missingVersion}, current ${s.current}, ahead ${s.ahead}`,
									)
									.join(" | ")}`,
							),
						);
						console.log(
							"To proceed, rerun without --interactive and use --save/--dir as needed.",
						);
						break;
					}

					const plan = planTemplateVersionBump(config, {
						type,
						toVersion: to,
						dir,
					});
					const savePath =
						typeof flags.save === "string" && flags.save.trim().length > 0
							? path.resolve(flags.save)
							: undefined;
					if (savePath) {
						writeTextFileSync(savePath, JSON.stringify(plan, null, 2));
					}
					if (isJson) {
						console.log(
							JSON.stringify({ ...plan, savedPath: savePath }, null, 2),
						);
					} else {
						console.log(
							emphasize.info(
								`Plan for type=${type} → v${to} (dirs: ${plan.dirs.join(", ")}): ${plan.outdated} outdated, ${plan.missingVersion} missing, ${plan.current} current, ${plan.ahead} ahead, ${plan.typeMismatch} mismatched`,
							),
						);
						console.log(
							emphasize.info(
								`Per-type summary: ${Object.entries(plan.perType)
									.map(
										([t, s]) =>
											`${t}: total ${s.total}, outdated ${s.outdated}, missing ${s.missingVersion}, current ${s.current}, ahead ${s.ahead}`,
									)
									.join(" | ")}`,
							),
						);
						if (savePath) {
							console.log(emphasize.success(`Saved plan to ${savePath}`));
						}
					}
					break;
				}

				console.error(`Unknown frontmatter action: ${action}`);
				process.exit(1);
				break;
			}

			case "insert": {
				const file = subcommand;
				const heading =
					typeof flags.heading === "string" ? flags.heading : undefined;
				const content =
					typeof flags.content === "string" ? flags.content : undefined;
				if (!file || !heading || !content) {
					console.error("insert requires <file>, --heading, and --content");
					process.exit(1);
				}

				const modes: InsertMode[] = ["append", "prepend", "before", "after"];
				const selected = modes.filter(
					(mode) => flags[mode] === true || flags[mode] === "true",
				);
				if (selected.length !== 1) {
					console.error(
						"insert requires exactly one of --append|--prepend|--before|--after",
					);
					process.exit(1);
				}
				const mode = selected[0] as InsertMode;
				const attachments = parseAttachments(normalizeFlags(flags));

				await ensureGitGuard(config);
				const result = insertIntoNote(config, {
					file,
					heading,
					content,
					mode,
				});
				if (config.autoCommit) {
					await autoCommitChanges(
						config,
						[file, ...withAutoDiscoveredAttachments(config, file, attachments)],
						`insert ${file}`,
					);
				}
				if (isJson) {
					console.log(JSON.stringify(result, null, 2));
				} else {
					console.log(
						color(
							"green",
							`Inserted into ${result.relative} (${mode}) under "${heading}"`,
						),
					);
				}
				break;
			}

			case "git": {
				const action = subcommand;
				if (action === "guard") {
					try {
						await assertGitRepo(config.vault);
						const status = await gitStatus(config.vault);
						if (isJson) {
							console.log(
								JSON.stringify({ git: "ok", clean: status.clean }, null, 2),
							);
						} else {
							console.log(color("cyan", `Git OK (clean=${status.clean})`));
						}
					} catch (error) {
						const message =
							error instanceof Error ? error.message : "Git guard failed";
						if (isJson) {
							console.log(JSON.stringify({ git: "error", message }, null, 2));
						} else {
							console.error(message);
						}
						process.exit(1);
					}
				} else if (action === "commit") {
					// para-obsidian git commit [file]
					// If file is provided, commit that specific file
					// Otherwise, commit all uncommitted .md files
					const fileArg = positional[0]; // Use parsed positional, not raw args
					try {
						if (fileArg) {
							// Commit single file
							const result = await commitNote(config, fileArg);
							if (isJson) {
								console.log(JSON.stringify(result, null, 2));
							} else if (result.committed) {
								console.log(color("green", `✓ ${result.message}`));
								console.log(`  Files: ${result.files.join(", ")}`);
							} else {
								console.log(color("yellow", "Nothing to commit"));
							}
						} else {
							// Commit all uncommitted files
							const result = await commitAllNotes(config);
							if (isJson) {
								console.log(JSON.stringify(result, null, 2));
							} else if (result.total === 0) {
								console.log(color("cyan", "No uncommitted notes found"));
							} else {
								console.log(
									color(
										"green",
										`✓ Committed ${result.committed} of ${result.total} notes`,
									),
								);
								for (const r of result.results) {
									if (r.committed) {
										console.log(`  ${color("green", "✓")} ${r.message}`);
									} else {
										console.log(
											`  ${color("yellow", "○")} ${r.message} (no changes)`,
										);
									}
								}
							}
						}
					} catch (error) {
						const message =
							error instanceof Error ? error.message : "Git commit failed";
						if (isJson) {
							console.log(
								JSON.stringify({ error: message, committed: false }, null, 2),
							);
						} else {
							console.error(color("red", message));
						}
						process.exit(1);
					}
				} else {
					console.error("git supports 'guard' and 'commit'");
					process.exit(1);
				}
				break;
			}

			case "process-inbox": {
				await initLoggerWithNotice();
				if (!isJson) {
					console.log(emphasize.info(`Logs: ${logFile}`));
				}
				const withLogContext = <T extends object>(
					payload: T,
					metrics?: MetricsSummary | null,
				) => ({
					...payload,
					logFile,
					...(metrics ? { metrics } : {}),
				});

				// Parse process-inbox specific flags
				const autoMode = flags.auto === true;
				const previewMode = flags.preview === true;
				const dryRun = flags["dry-run"] === true;
				// Verbose and force flags reserved for future use
				const _verbose = flags.verbose === true;
				const _force = flags.force === true;
				const filterPattern =
					typeof flags.filter === "string" ? flags.filter : undefined;

				// Create engine with config
				const engine = createInboxEngine({
					vaultPath: config.vault,
					inboxFolder: "00 Inbox",
					attachmentsFolder: "Attachments",
					templatesFolder: config.templatesDir,
				});

				// Scan inbox for suggestions
				let suggestions: InboxSuggestion[];
				if (isJson) {
					suggestions = await engine.scan();
				} else {
					const scanSpinner = createSpinner("Scanning inbox...").start();
					const scanStarted = Date.now();
					const scanState = {
						total: 0,
						processed: 0,
						skipped: 0,
						errors: 0,
						currentFile: "",
						stage: "hash" as
							| "hash"
							| "extract"
							| "llm"
							| "skip"
							| "done"
							| "error",
						stageStartedAt: Date.now(),
					};
					const stageLabel = (stage: string): string => {
						switch (stage) {
							case "hash":
								return "hashing";
							case "extract":
								return "extracting";
							case "llm":
								return "LLM";
							case "skip":
								return "skipped";
							case "done":
								return "done";
							case "error":
								return "error";
							default:
								return stage;
						}
					};
					const updateScanText = () => {
						const elapsedStage = (
							(Date.now() - scanState.stageStartedAt) /
							1000
						).toFixed(1);
						const totals = `Scanning ${scanState.processed}/${scanState.total || "?"} (skipped ${scanState.skipped}, errors ${scanState.errors})`;
						const detail =
							scanState.currentFile === ""
								? ""
								: ` | ${scanState.currentFile} ${stageLabel(scanState.stage)} ${elapsedStage}s`;
						scanSpinner.update({ text: `${totals}${detail}` });
					};
					const scanTicker = setInterval(updateScanText, 500);
					try {
						suggestions = await engine.scan({
							onProgress: ({ total, filename, stage, error }) => {
								scanState.total = total;
								if (stage === "skip") {
									scanState.skipped += 1;
									scanState.processed += 1;
								} else if (stage === "done") {
									scanState.processed += 1;
								} else if (stage === "error") {
									scanState.errors += 1;
									scanState.processed += 1;
								} else {
									scanState.currentFile = filename;
									scanState.stage = stage;
									scanState.stageStartedAt = Date.now();
								}
								if (error) {
									scanSpinner.update({
										text: `Scanning ${scanState.processed}/${scanState.total || "?"} (skipped ${scanState.skipped}, errors ${scanState.errors + 1}) | ${filename} error - ${error}`,
									});
									return;
								}
								updateScanText();
							},
						});
						clearInterval(scanTicker);
						const elapsed = ((Date.now() - scanStarted) / 1000).toFixed(1);
						scanSpinner.success({
							text: `Scan complete (${scanState.processed}/${scanState.total || suggestions.length} scanned, skipped ${scanState.skipped}, errors ${scanState.errors}) in ${elapsed}s`,
						});
					} catch (error) {
						clearInterval(scanTicker);
						scanSpinner.error({
							text: `Scan failed: ${error instanceof Error ? error.message : "unknown error"}`,
						});
						throw error;
					}
				}

				// Apply filter if provided
				const filteredSuggestions = filterPattern
					? suggestions.filter(
							(s) =>
								s.source.includes(filterPattern) ||
								(s.suggestedTitle?.includes(filterPattern) ?? false),
						)
					: suggestions;

				if (filteredSuggestions.length === 0) {
					const metrics = await collectMetricsSummary();
					if (isJson) {
						console.log(
							JSON.stringify(
								withLogContext(
									{ items: [], message: "No items to process" },
									metrics,
								),
								null,
								2,
							),
						);
					} else {
						console.log(color("cyan", "No items to process in inbox"));
						if (metrics) {
							console.log(
								emphasize.info(
									`Metrics: total=${metrics.totalOperations ?? "?"}, failed=${metrics.failedOperations ?? "?"}`,
								),
							);
						}
					}
					break;
				}

				// Preview mode: just display suggestions
				if (previewMode) {
					const metrics = await collectMetricsSummary();
					if (isJson) {
						console.log(
							JSON.stringify(
								withLogContext(
									{
										mode: "preview",
										items: filteredSuggestions,
										count: filteredSuggestions.length,
									},
									metrics,
								),
								null,
								2,
							),
						);
					} else {
						console.log(formatSuggestionsTable(filteredSuggestions));
						if (metrics) {
							console.log(
								emphasize.info(
									`Metrics: total=${metrics.totalOperations ?? "?"}, failed=${metrics.failedOperations ?? "?"}`,
								),
							);
						}
					}
					break;
				}

				// Auto mode: process all without interaction
				if (autoMode) {
					if (dryRun) {
						const metrics = await collectMetricsSummary();
						if (isJson) {
							console.log(
								JSON.stringify(
									withLogContext(
										{
											mode: "dry-run",
											wouldProcess: filteredSuggestions.map((s) => s.id),
											count: filteredSuggestions.length,
										},
										metrics,
									),
									null,
									2,
								),
							);
						} else {
							console.log(
								color(
									"cyan",
									`[dry-run] Would process ${filteredSuggestions.length} items:`,
								),
							);
							for (const suggestion of filteredSuggestions) {
								console.log(`  - ${suggestion.source} → ${suggestion.action}`);
							}
							if (metrics) {
								console.log(
									emphasize.info(
										`Metrics: total=${metrics.totalOperations ?? "?"}, failed=${metrics.failedOperations ?? "?"}`,
									),
								);
							}
						}
						break;
					}

					// Execute all suggestions
					let results: ExecutionResult[];
					if (isJson) {
						results = await engine.execute(
							filteredSuggestions.map((s) => s.id),
						);
					} else {
						const execSpinner = createSpinner(
							`Executing ${filteredSuggestions.length} item(s)...`,
						).start();
						const execStarted = Date.now();
						results = await engine.execute(
							filteredSuggestions.map((s) => s.id),
							{
								onProgress: ({
									processed,
									total,
									suggestionId,
									success,
									error,
								}) => {
									const status = success
										? color("green", "✓")
										: color("red", "✗");
									const detail = error ? ` - ${error}` : "";
									execSpinner.update({
										text: `${status} ${processed}/${total} ${suggestionId}${detail}`,
									});
									console.log(
										`${status} ${processed}/${total} ${suggestionId}${detail}`,
									);
								},
							},
						);
						const elapsed = ((Date.now() - execStarted) / 1000).toFixed(1);
						execSpinner.success({
							text: `Executed ${results.length} item(s) in ${elapsed}s`,
						});
					}

					// Aggregate results
					const successes = results.filter((r) => r.success).length;
					const failures = results.filter((r) => !r.success).length;
					const metrics = await collectMetricsSummary();

					if (isJson) {
						console.log(
							JSON.stringify(
								withLogContext(
									{
										mode: "auto",
										results: results,
										successes,
										failures,
									},
									metrics,
								),
								null,
								2,
							),
						);
					} else {
						console.log(
							color(
								"green",
								`✓ Processed ${successes} of ${successes + failures} items`,
							),
						);
						for (const result of results) {
							if (result.success) {
								console.log(`  ${color("green", "✓")} ${result.suggestionId}`);
							} else {
								console.log(
									`  ${color("red", "✗")} ${result.suggestionId}: ${result.error}`,
								);
							}
						}
						if (metrics) {
							console.log(
								emphasize.info(
									`Metrics: total=${metrics.totalOperations ?? "?"}, failed=${metrics.failedOperations ?? "?"}`,
								),
							);
						}
					}
					break;
				}

				// Interactive mode: run the interactive approval loop
				if (isJson) {
					const metrics = await collectMetricsSummary();
					console.log(
						JSON.stringify(
							withLogContext(
								{
									mode: "interactive",
									items: filteredSuggestions,
									count: filteredSuggestions.length,
									help: "Interactive mode requires TTY - use --auto or --preview for non-interactive",
								},
								metrics,
							),
							null,
							2,
						),
					);
				} else {
					// Run interactive loop - returns approved IDs
					const approvedIds = await runInteractiveLoop({
						engine,
						suggestions: filteredSuggestions,
					});

					// If user approved items, execute them
					if (approvedIds.length > 0) {
						if (dryRun) {
							console.log(
								color(
									"cyan",
									`\n[dry-run] Would execute ${approvedIds.length} item(s)`,
								),
							);
						} else {
							const execSpinner = createSpinner(
								`Executing ${approvedIds.length} item(s)...`,
							).start();
							const execStarted = Date.now();
							const results = await engine.execute(approvedIds, {
								onProgress: ({
									processed,
									total,
									suggestionId,
									success,
									error,
								}) => {
									const status = success
										? color("green", "✓")
										: color("red", "✗");
									const detail = error ? ` - ${error}` : "";
									execSpinner.update({
										text: `${status} ${processed}/${total} ${suggestionId}${detail}`,
									});
									console.log(
										`${status} ${processed}/${total} ${suggestionId}${detail}`,
									);
								},
							});
							const elapsed = ((Date.now() - execStarted) / 1000).toFixed(1);
							execSpinner.success({
								text: `Executed ${results.length} item(s) in ${elapsed}s`,
							});
							displayResults(results);
							const metrics = await collectMetricsSummary();
							if (metrics) {
								console.log(
									emphasize.info(
										`Metrics: total=${metrics.totalOperations ?? "?"}, failed=${metrics.failedOperations ?? "?"}`,
									),
								);
							}
						}
					} else {
						console.log(emphasize.info("\nNo items were approved."));
					}
				}
				break;
			}

			// Placeholder: future command implementations go here.
			default: {
				console.error(`Unknown command: ${command}`);
				printUsage();
				process.exit(1);
			}
		}
	} catch (error) {
		console.error(
			error instanceof Error
				? error.message
				: "Unexpected error in para-obsidian CLI",
		);
		process.exit(1);
	}
}

// Only run main when executed directly (not when imported)
if (import.meta.main) {
	main().then(() => {
		process.exit(0);
	});
}
