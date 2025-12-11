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

/**
 * Normalize a flag value to single value (string or boolean).
 * If array, returns the first element. Otherwise returns as-is.
 */
function normalizeFlagValue(
	value: string | boolean | (string | boolean)[] | undefined,
): string | boolean | undefined {
	if (Array.isArray(value)) {
		return value[0];
	}
	return value;
}

/**
 * Normalize flags record by converting all array values to their first element.
 * Used for functions that don't expect array flag values.
 */
function normalizeFlags(
	flags: Record<string, string | boolean | (string | boolean)[]>,
): Record<string, string | boolean> {
	const normalized: Record<string, string | boolean> = {};
	for (const [key, value] of Object.entries(flags)) {
		const norm = normalizeFlagValue(value);
		if (norm !== undefined) {
			normalized[key] = norm;
		}
	}
	return normalized;
}

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
import { cleanBrokenLinks } from "./clean-links";
import {
	listTemplateVersions,
	loadConfig,
	type ParaObsidianConfig,
} from "./config";
import { createFromTemplate, replaceSections } from "./create";
import { DEFAULT_AVAILABLE_MODELS, DEFAULT_MODEL } from "./defaults";
import { deleteFile } from "./delete";
import { flattenAttachments } from "./flatten";
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
import { listDir, readFile } from "./fs";
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
import {
	buildIndex,
	listAreas,
	listTags,
	loadIndex,
	saveIndex,
	scanTags,
} from "./indexer";
import { type InsertMode, insertIntoNote } from "./insert";
import { linkAttachmentsToNotes } from "./link-attachments";
import { renameWithLinkRewrite } from "./links";
import {
	extractMetadata,
	getWikilinkFieldsFromRules,
	validateModel,
} from "./llm";
import { MIGRATIONS } from "./migrations";
import { findOrphans, formatFixCommand, suggestFixes } from "./orphans";
import { type RewriteMapping, rewriteLinks } from "./rewrite-links";
import { filterByFrontmatter, searchText } from "./search";
import { semanticSearch } from "./semantic";
import { getTemplate, getTemplateFields } from "./templates";

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

function parseAttachments(flags: Record<string, string | boolean>): string[] {
	const raw = flags.attachments;
	if (typeof raw !== "string") return [];
	return raw
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

function parseUnset(input: string | boolean | undefined): string[] {
	if (typeof input !== "string") return [];
	return input
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

function parseFrontmatterFilters(
	flags: Record<string, string | boolean>,
	additional: ReadonlyArray<string> = [],
): Record<string, string> {
	const filters: Record<string, string> = {};
	const collect = (input: string) => {
		const [rawKey, ...rest] = input.split("=");
		if (!rawKey || rest.length === 0) return;
		const key = rawKey.replace(/^frontmatter[._]/, "").trim();
		const value = rest.join("=").trim();
		if (!key || !value) return;
		filters[key] = value;
	};

	if (typeof flags.frontmatter === "string") {
		for (const part of flags.frontmatter.split(",")) {
			if (part.trim().length > 0) collect(part);
		}
	}

	for (const [k, v] of Object.entries(flags)) {
		if (k.startsWith("frontmatter.") && typeof v === "string") {
			collect(`${k.replace("frontmatter.", "")}=${v}`);
		}
	}

	for (const part of additional) collect(part);
	return filters;
}

function parseDirs(
	value: string | boolean | undefined,
	defaults?: ReadonlyArray<string>,
): ReadonlyArray<string> | undefined {
	if (typeof value !== "string") return defaults;
	return value
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

function parseStatuses(
	value: string | boolean | undefined,
	defaults: ReadonlyArray<string>,
): ReadonlyArray<string> {
	if (typeof value !== "string") return defaults;
	const parts = value
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	return parts.length > 0 ? parts : defaults;
}

function normalizePathFragment(input: string): string {
	return input.replace(/\\/g, "/").replace(/\/+$/, "");
}

function matchesDir(file: string, dirs?: ReadonlyArray<string>): boolean {
	if (!dirs || dirs.length === 0) return true;
	const normalizedFile = normalizePathFragment(file);
	return dirs.some((dir) => {
		const normalizedDir = normalizePathFragment(dir);
		return (
			normalizedFile === normalizedDir ||
			normalizedFile.startsWith(`${normalizedDir}/`)
		);
	});
}

/**
 * Parse --arg flags into key=value overrides.
 *
 * Handles both single string and array of strings from CLI parsing.
 * Supports values with embedded '=' signs (e.g., --arg "url=https://example.com/path?a=b")
 *
 * @param argFlags - Raw --arg flag value(s) from parseArgs
 * @returns Record mapping arg keys to their values
 *
 * @example
 * ```typescript
 * parseArgOverrides("priority=high")
 * // Returns: { priority: "high" }
 *
 * parseArgOverrides(["priority=high", "area=[[Work]]"])
 * // Returns: { priority: "high", area: "[[Work]]" }
 * ```
 */
function parseArgOverrides(
	argFlags: string | boolean | (string | boolean)[] | undefined,
): Record<string, string> {
	const overrides: Record<string, string> = {};

	// Normalize to array of strings only
	let stringFlags: string[];
	if (typeof argFlags === "string") {
		stringFlags = [argFlags];
	} else if (Array.isArray(argFlags)) {
		stringFlags = argFlags.filter((v): v is string => typeof v === "string");
	} else {
		stringFlags = [];
	}

	for (const arg of stringFlags) {
		const [key, ...valueParts] = arg.split("=");
		if (key && valueParts.length > 0) {
			overrides[key] = valueParts.join("=");
		}
	}
	return overrides;
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

		switch (command) {
			case "config": {
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
								emphasize.info(
									`Commit template: ${config.gitCommitMessageTemplate}`,
								),
							);
						}
					}
				}
				break;
			}

			case "templates": {
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
				break;
			}

			case "list-areas": {
				const areas = listAreas(config);
				if (isJson) {
					console.log(JSON.stringify({ areas, count: areas.length }, null, 2));
				} else {
					if (areas.length === 0) {
						console.log(emphasize.warn("No areas found in 02_Areas/"));
					} else {
						console.log(emphasize.info(`Found ${areas.length} areas:`));
						for (const area of areas) {
							console.log(`  ${area}`);
						}
					}
				}
				break;
			}

			case "list-tags": {
				const tags = listTags(config);
				if (isJson) {
					console.log(JSON.stringify({ tags, count: tags.length }, null, 2));
				} else {
					if (tags.length === 0) {
						console.log(
							emphasize.warn(
								"No suggested tags configured (see suggestedTags in config)",
							),
						);
					} else {
						console.log(emphasize.info(`Configured tags (${tags.length}):`));
						for (const tag of tags) {
							console.log(`  ${tag}`);
						}
					}
				}
				break;
			}

			case "scan-tags": {
				const tags = scanTags(config);
				if (isJson) {
					console.log(JSON.stringify({ tags, count: tags.length }, null, 2));
				} else {
					if (tags.length === 0) {
						console.log(emphasize.warn("No tags found in vault frontmatter"));
					} else {
						console.log(emphasize.info(`Tags in use (${tags.length}):`));
						for (const tag of tags) {
							console.log(`  ${tag}`);
						}
					}
				}
				break;
			}

			case "template-fields": {
				const templateName = subcommand;
				if (!templateName) {
					console.error("template-fields requires <template> argument");
					process.exit(1);
				}

				const template = getTemplate(config, templateName);
				if (!template) {
					console.error(`Template not found: ${templateName}`);
					process.exit(1);
				}

				const fields = getTemplateFields(template);
				const requiredFields = fields.filter(
					(f) => !f.isAutoDate && f.inFrontmatter,
				);
				const autoFields = fields.filter((f) => f.isAutoDate);
				const bodyFields = fields.filter(
					(f) => !f.isAutoDate && !f.inFrontmatter,
				);

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
							result.example = isWrappedInWikilinks
								? "Note Name"
								: "[[Note Name]]";
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
						emphasize.info(
							`Template Fields: ${templateName} (v${template.version})`,
						),
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
				break;
			}

			case "rename": {
				const from = subcommand;
				const to = positional[0];
				if (!from || !to) {
					console.error("rename requires <from> <to>");
					process.exit(1);
				}
				const dryRun = flags["dry-run"] === true || flags["dry-run"] === "true";
				const attachments = parseAttachments(normalizeFlags(flags));
				if (!dryRun) {
					await ensureGitGuard(config);
				}
				const result = renameWithLinkRewrite(config, { from, to, dryRun });
				if (config.autoCommit && !dryRun) {
					const paths = [
						from,
						to,
						...result.rewrites.map((r) => r.file),
						...attachments,
					];
					await autoCommitChanges(config, paths, `rename ${from} → ${to}`);
				}
				if (isJson) {
					console.log(JSON.stringify(result, null, 2));
				} else {
					console.log(
						emphasize.info(
							`${dryRun ? "Would rename" : "Renamed"} ${from} → ${to} (rewrites: ${result.rewrites.length})`,
						),
					);
				}
				break;
			}

			case "flatten-attachments": {
				const dryRun = flags["dry-run"] === true || flags["dry-run"] === "true";
				const removeEmptyDirs =
					flags["remove-empty-dirs"] === true ||
					flags["remove-empty-dirs"] === "true";

				if (!dryRun) {
					await ensureGitGuard(config);
				}

				const result = await flattenAttachments(config.vault, {
					dryRun,
					removeEmptyDirs,
				});

				if (isJson) {
					console.log(JSON.stringify(result, null, 2));
				} else {
					console.log(
						emphasize.success(
							`${dryRun ? "Would flatten" : "Flattened"} ${result.attachmentsMoved} attachments`,
						),
					);
					console.log(`  Notes updated: ${result.notesUpdated}`);
					if (removeEmptyDirs) {
						console.log(`  Empty dirs removed: ${result.emptyDirsRemoved}`);
					}
				}

				if (config.autoCommit && !dryRun && result.attachmentsMoved > 0) {
					// Commit all changes (moved files + updated note references)
					await commitAllNotes(config);
				}
				break;
			}

			case "link-attachments": {
				const dir = subcommand;
				if (!dir) {
					console.error(emphasize.error("Usage: link-attachments <directory>"));
					console.error(
						"Example: link-attachments '01 Projects/2025 Tassie Holiday'",
					);
					process.exit(1);
				}

				const dryRun = flags["dry-run"] === true || flags["dry-run"] === "true";
				const threshold =
					typeof flags.threshold === "number"
						? flags.threshold
						: typeof flags.threshold === "string"
							? Number.parseFloat(flags.threshold)
							: 0.3;

				if (!dryRun) {
					await ensureGitGuard(config);
				}

				const result = await linkAttachmentsToNotes(config.vault, dir, {
					dryRun,
					threshold,
				});

				if (isJson) {
					console.log(JSON.stringify(result, null, 2));
				} else {
					console.log(
						emphasize.success(
							`${dryRun ? "Would link" : "Linked"} ${result.totalLinks} attachments to ${result.notesUpdated} notes`,
						),
					);
					if (result.notesUpdated > 0) {
						console.log("\nLinked attachments:");
						for (const { note, attachments } of result.updates) {
							console.log(`  ${note}:`);
							for (const att of attachments) {
								console.log(`    - ${att}`);
							}
						}
					}
				}

				if (config.autoCommit && !dryRun && result.notesUpdated > 0) {
					await commitAllNotes(config);
				}
				break;
			}

			case "find-orphans": {
				const dirs = parseDirs(
					normalizeFlagValue(flags.dir),
					config.defaultSearchDirs,
				);
				const suggest = flags.suggest === true || flags.suggest === "true";

				const result = findOrphans(config.vault, { dirs });
				const searchedDirs = dirs ?? config.defaultSearchDirs ?? ["."];

				// Generate suggestions if requested
				const fixes = suggest
					? suggestFixes(config.vault, result.brokenLinks)
					: [];

				if (isJson) {
					console.log(
						JSON.stringify(
							{
								...result,
								dirs: searchedDirs,
								...(suggest && { suggestedFixes: fixes }),
							},
							null,
							2,
						),
					);
				} else {
					// Show which directories were searched
					console.log(emphasize.info(`Searching: ${searchedDirs.join(", ")}`));
					console.log("");

					if (result.brokenLinks.length > 0) {
						console.log(
							emphasize.error(
								`Found ${result.brokenLinks.length} broken links:`,
							),
						);
						for (const { note, link, location } of result.brokenLinks) {
							console.log(`  ${note} (${location}): [[${link}]]`);
						}
						console.log("");
					}

					if (result.orphanAttachments.length > 0) {
						console.log(
							emphasize.warn(
								`Found ${result.orphanAttachments.length} orphan attachments:`,
							),
						);
						for (const att of result.orphanAttachments) {
							console.log(`  ${att}`);
						}
						console.log("");
					}

					if (
						result.brokenLinks.length === 0 &&
						result.orphanAttachments.length === 0
					) {
						console.log(emphasize.success("No orphans or broken links found!"));
					}

					// Show suggestions if requested
					if (suggest && fixes.length > 0) {
						console.log(
							emphasize.success(`\n✨ Suggested fixes (${fixes.length}):`),
						);
						for (const fix of fixes) {
							console.log(
								`  ${emphasize.info(fix.from)} → ${emphasize.success(fix.to)}`,
							);
							console.log(`    ${fix.reason}`);
						}
						console.log("\n# Copy/paste to fix:");
						console.log(formatFixCommand(fixes));
					} else if (
						suggest &&
						fixes.length === 0 &&
						result.brokenLinks.length > 0
					) {
						console.log(
							emphasize.warn(
								"\nNo auto-fixes available (broken links don't match existing attachments)",
							),
						);
					}
				}
				break;
			}

			case "clean-broken-links": {
				const dir = subcommand ?? ".";
				const dryRun = flags["dry-run"] === true || flags["dry-run"] === "true";

				if (!dryRun) {
					await ensureGitGuard(config);
				}

				const result = cleanBrokenLinks(config.vault, { dir, dryRun });

				if (isJson) {
					console.log(JSON.stringify(result, null, 2));
				} else {
					console.log(
						emphasize.success(
							`${dryRun ? "Would remove" : "Removed"} ${result.linksRemoved} broken links from ${result.notesUpdated} notes`,
						),
					);
					if (result.notesUpdated > 0) {
						console.log("\nUpdated notes:");
						for (const { note, linksRemoved } of result.updates) {
							console.log(`  ${note}: ${linksRemoved} links removed`);
						}
					}
				}

				if (config.autoCommit && !dryRun && result.notesUpdated > 0) {
					await commitAllNotes(config);
				}
				break;
			}

			case "rewrite-links": {
				// Support multiple --from/--to pairs or a single pair
				const fromValues = Array.isArray(flags.from)
					? flags.from.filter((v): v is string => typeof v === "string")
					: typeof flags.from === "string"
						? [flags.from]
						: [];
				const toValues = Array.isArray(flags.to)
					? flags.to.filter((v): v is string => typeof v === "string")
					: typeof flags.to === "string"
						? [flags.to]
						: [];
				const mappingFile =
					typeof flags.mapping === "string" ? flags.mapping : undefined;
				const dryRun = flags["dry-run"] === true || flags["dry-run"] === "true";
				const dirs = parseDirs(
					normalizeFlagValue(flags.dir),
					config.defaultSearchDirs,
				);

				// Build mappings from either --from/--to pairs or --mapping file
				let mappings: RewriteMapping[] = [];

				if (mappingFile) {
					// Load mappings from JSON file
					const mappingPath = path.resolve(mappingFile);
					if (!pathExistsSync(mappingPath)) {
						console.error(`Mapping file not found: ${mappingPath}`);
						process.exit(1);
					}
					try {
						const raw = readTextFileSync(mappingPath);
						const parsed = JSON.parse(raw) as Record<string, string>;
						mappings = Object.entries(parsed).map(([fromLink, toLink]) => ({
							from: fromLink,
							to: toLink,
						}));
					} catch (error) {
						console.error(
							`Failed to parse mapping file: ${error instanceof Error ? error.message : String(error)}`,
						);
						process.exit(1);
					}
				} else if (fromValues.length > 0 && toValues.length > 0) {
					// Pair up --from and --to values
					if (fromValues.length !== toValues.length) {
						console.error(
							`Mismatched --from/--to pairs: got ${fromValues.length} --from and ${toValues.length} --to`,
						);
						process.exit(1);
					}
					for (let i = 0; i < fromValues.length; i++) {
						mappings.push({ from: fromValues[i]!, to: toValues[i]! });
					}
				} else {
					console.error(
						"rewrite-links requires either --from and --to, or --mapping",
					);
					process.exit(1);
				}

				if (!dryRun) {
					await ensureGitGuard(config);
				}

				const result = rewriteLinks(config.vault, mappings, { dryRun, dirs });

				if (isJson) {
					console.log(JSON.stringify({ ...result, dirs, dryRun }, null, 2));
				} else {
					console.log(
						emphasize.info(`Searching: ${(dirs ?? ["."]).join(", ")}`),
					);
					console.log("");

					if (result.linksRewritten === 0) {
						console.log(emphasize.warn("No matching links found to rewrite."));
					} else {
						console.log(
							emphasize.success(
								`${dryRun ? "Would rewrite" : "Rewrote"} ${result.linksRewritten} link(s) in ${result.notesUpdated} note(s)`,
							),
						);

						if (result.updates.length > 0) {
							console.log("\nUpdated notes:");
							for (const { note, rewrites } of result.updates) {
								console.log(`  ${note}:`);
								for (const r of rewrites) {
									console.log(
										`    ${r.location}: [[${r.from}]] → [[${r.to}]] (${r.count}x)`,
									);
								}
							}
						}
					}
				}

				if (config.autoCommit && !dryRun && result.notesUpdated > 0) {
					const changedFiles = result.updates.map((u) => u.note);
					await autoCommitChanges(
						config,
						changedFiles,
						`rewrite ${result.linksRewritten} link(s)`,
					);
				}
				break;
			}

			case "delete": {
				const file = subcommand;
				if (!file) {
					console.error("delete requires <file>");
					process.exit(1);
				}
				const confirm = flags.confirm === true || flags.confirm === "true";
				const dryRun = flags["dry-run"] === true || flags["dry-run"] === "true";
				const attachments = parseAttachments(normalizeFlags(flags));
				if (!dryRun) {
					await ensureGitGuard(config);
				}
				const result = deleteFile(config, { file, confirm, dryRun });
				if (config.autoCommit && !dryRun) {
					await autoCommitChanges(
						config,
						[file, ...withAutoDiscoveredAttachments(config, file, attachments)],
						`delete ${file}`,
					);
				}
				if (isJson) {
					console.log(JSON.stringify(result, null, 2));
				} else {
					console.log(
						emphasize.warn(
							`${dryRun ? "Would delete" : "Deleted"} ${result.relative}`,
						),
					);
				}
				break;
			}

			case "list": {
				const dir = subcommand ?? ".";
				const entries = listDir(config.vault, dir);
				if (isJson) {
					console.log(JSON.stringify({ dir, entries }, null, 2));
				} else {
					console.log(entries.join("\n"));
				}
				break;
			}

			case "read": {
				const file = subcommand;
				if (!file) {
					console.error("read requires <file>");
					process.exit(1);
				}
				const content = readFile(config.vault, file);
				if (isJson) {
					console.log(JSON.stringify({ file, content }, null, 2));
				} else {
					console.log(content);
				}
				break;
			}

			case "index": {
				const action = subcommand;
				if (!action) {
					console.error("index requires an action (prime|query)");
					process.exit(1);
				}

				if (action === "prime") {
					const dirs = parseDirs(
						normalizeFlagValue(flags.dir) ?? positional[0],
						config.defaultSearchDirs,
					);
					const index = buildIndex(config, dirs);
					const path = saveIndex(config, index);
					if (isJson) {
						console.log(
							JSON.stringify(
								{ indexPath: path, count: index.entries.length },
								null,
								2,
							),
						);
					} else {
						console.log(
							emphasize.success(
								`Indexed ${index.entries.length} files → ${path}`,
							),
						);
					}
					break;
				}

				if (action === "query") {
					const tag = typeof flags.tag === "string" ? flags.tag : undefined;
					const dirs = parseDirs(
						normalizeFlagValue(flags.dir),
						config.defaultSearchDirs,
					);
					const frontmatter = parseFrontmatterFilters(normalizeFlags(flags));
					const index = loadIndex(config);
					if (!index) {
						console.error("Index not found. Run index prime first.");
						process.exit(1);
					}
					const results = index.entries.filter((entry) => {
						if (!matchesDir(entry.file, dirs)) return false;
						if (tag && !entry.tags.includes(tag)) return false;
						for (const [k, v] of Object.entries(frontmatter)) {
							if (entry.frontmatter[k] !== v) return false;
						}
						return true;
					});
					if (isJson) {
						console.log(
							JSON.stringify({ count: results.length, results }, null, 2),
						);
					} else {
						for (const r of results) console.log(r.file);
					}
					break;
				}

				console.error(`Unknown index action: ${action}`);
				process.exit(1);
				break;
			}

			case "search": {
				const query = subcommand;
				if (!query) {
					console.error("search requires <query>");
					process.exit(1);
				}
				const tag = typeof flags.tag === "string" ? flags.tag : undefined;
				const dirs = parseDirs(
					normalizeFlagValue(flags.dir),
					config.defaultSearchDirs,
				);
				const frontmatter = parseFrontmatterFilters(normalizeFlags(flags));
				const globs =
					typeof flags.glob === "string"
						? flags.glob
								.split(",")
								.map((g: string) => g.trim())
								.filter(Boolean)
						: undefined;
				const context =
					typeof flags.context === "string"
						? Number.parseInt(flags.context, 10)
						: undefined;

				const hasFrontmatterFilters =
					Object.keys(frontmatter).length > 0 || Boolean(tag);
				const fmMatches = hasFrontmatterFilters
					? await filterByFrontmatter(config, { frontmatter, tag, dir: dirs })
					: [];

				const hits = await searchText(config, {
					query,
					dir: dirs,
					regex: flags.regex === true || flags.regex === "true",
					maxResults:
						typeof flags["max-results"] === "string"
							? Number.parseInt(flags["max-results"], 10)
							: undefined,
					glob: globs,
					context,
					allowedFiles: hasFrontmatterFilters ? fmMatches : undefined,
				});

				if (isJson) {
					console.log(
						JSON.stringify({ query, hits, frontmatter: fmMatches }, null, 2),
					);
				} else {
					for (const hit of hits) {
						console.log(
							emphasize.info(`${hit.file}:${hit.line}: ${hit.snippet}`),
						);
					}
					if (fmMatches.length > 0) {
						console.log("\nFrontmatter matches:");
						for (const f of fmMatches) console.log(emphasize.info(f));
					}
				}
				break;
			}

			case "semantic": {
				const query = subcommand;
				if (!query) {
					console.error("semantic requires <query>");
					process.exit(1);
				}
				// Parse --dir (explicit directory) or --para (PARA shortcuts)
				const dir = parseDirs(normalizeFlagValue(flags.dir), undefined);
				const para = typeof flags.para === "string" ? flags.para : undefined;
				const limit =
					typeof flags.limit === "string"
						? Number.parseInt(flags.limit, 10)
						: undefined;
				try {
					const hits = await semanticSearch(config, {
						query,
						dir,
						para,
						limit,
					});
					if (isJson) {
						console.log(JSON.stringify({ query, hits }, null, 2));
					} else {
						if (hits.length === 0) {
							console.log(emphasize.warn("No results found."));
						} else {
							for (const hit of hits) {
								const line = hit.line ? `:${hit.line}` : "";
								const score = hit.score.toFixed(3);
								const dirLabel =
									hit.dir && hit.dir !== "." ? `[${hit.dir}] ` : "";
								console.log(
									emphasize.info(
										`${dirLabel}${hit.file}${line} (${score}) ${hit.snippet ?? ""}`.trim(),
									),
								);
							}
						}
					}
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "semantic search failed";
					console.error(message);
					process.exit(1);
				}
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
