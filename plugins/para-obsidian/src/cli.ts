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

import {
	color,
	emphasize,
	OutputFormat,
	parseOutputFormat,
} from "@sidequest/core/formatters";
import {
	pathExistsSync,
	readTextFileSync,
	writeTextFileSync,
} from "@sidequest/core/fs";
import { discoverAttachments } from "./attachments";
import {
	listTemplateVersions,
	loadConfig,
	type ParaObsidianConfig,
} from "./config";
import { createFromTemplate, replaceSections } from "./create";
import { deleteFile } from "./delete";
import {
	applyVersionPlan,
	migrateAllTemplateVersions,
	migrateTemplateVersion,
	planTemplateVersionBump,
	readFrontmatterFile,
	updateFrontmatterFile,
	type VersionPlanStatus,
	validateFrontmatter,
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
	buildIndex,
	listAreas,
	listTags,
	loadIndex,
	saveIndex,
	scanTags,
} from "./indexer";
import { type InsertMode, insertIntoNote } from "./insert";
import { renameWithLinkRewrite } from "./links";
import { extractMetadata, validateModel } from "./llm";
import { MIGRATIONS } from "./migrations";
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
		'  bun run src/cli.ts insert <file> --heading "<Heading>" --content "<Content>" [--before|--after|--append|--prepend] [--attachments paths] [--format md|json]',
		"  bun run src/cli.ts rename <from> <to> [--dry-run] [--attachments paths] [--format md|json]",
		"  bun run src/cli.ts delete <file> --confirm [--dry-run] [--attachments paths] [--format md|json]",
		"  bun run src/cli.ts semantic <query> [--para folder[,folder2]] [--dir path] [--limit N] [--format md|json]",
		"  bun run src/cli.ts frontmatter get <file> [--format md|json]",
		"  bun run src/cli.ts frontmatter validate <file> [--format md|json]",
		"  bun run src/cli.ts frontmatter set <file> key=value [...] [--unset key1,key2] [--dry-run] [--attachments paths] [--format md|json]",
		"  bun run src/cli.ts frontmatter migrate <file> [--force <version>] [--dry-run] [--attachments paths] [--format md|json]",
		"  bun run src/cli.ts frontmatter migrate-all [--dir path[,path2]] [--force <version>] [--type <type>] [--dry-run] [--attachments paths] [--format md|json]",
		"  bun run src/cli.ts frontmatter plan <type> --to <version> [--dir path[,path2]] [--save plan.json] [--format md|json]",
		"  bun run src/cli.ts frontmatter apply-plan <plan.json> [--statuses s1,s2] [--dir path[,path2]] [--emit-plan filtered.json] [--dry-run] [--attachments paths] [--format md|json]",
		"  bun run src/cli.ts frontmatter plan --interactive (prints summary/plan and exits non-interactively)",
		"  bun run src/cli.ts git guard [--format md|json]",
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
	sourceFile: string;
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
				console.log(
					emphasize.info(
						`To create: bun src/cli.ts create --template ${template} --source "${sourceFile}"`,
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

		// Clean up wikilink fields - ALWAYS set the extracted value to override template output
		// Wrap in [[...]] for Dataview compatibility (wikilinks must be quoted in YAML)
		// ALSO apply argOverrides to ensure they take precedence over LLM extraction
		// Must include all wikilink fields that may appear in templates
		const frontmatterCleanup: Record<string, unknown> = {};
		const wikilinkFields = ["project", "area", "accommodation", "decision"];
		const urlFields = ["contact_url", "url", "website", "source_url"];
		for (const field of wikilinkFields) {
			const extractedValue = Object.entries(extracted.args).find(([key]) =>
				key.toLowerCase().includes(field),
			)?.[1];
			// ALWAYS set wikilink fields - wrap in [[...]] or null
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
					const dirs = parseDirs(positional[0]);
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
				const preview = flags.preview === true || flags.preview === "true";
				const modelFlag =
					typeof flags.model === "string" ? flags.model : undefined;

				// Validate required flags based on mode
				if (sourceFile) {
					// AI-powered mode: --source is provided
					if (!template) {
						console.error("create with --source requires --template");
						process.exit(1);
					}

					// Get model from flags, config, or default
					const availableModels = config.availableModels ?? [
						"sonnet",
						"haiku",
						"qwen:7b",
						"qwen:14b",
						"qwen2.5:14b",
					];
					const defaultModel = config.defaultModel ?? "sonnet";
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
				if (!action || !target) {
					console.error("frontmatter requires action and <file>");
					process.exit(1);
				}

				if (action === "get") {
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

				if (action === "set" || action === "edit") {
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
					const dryRun =
						flags["dry-run"] === true || flags["dry-run"] === "true";
					const forceVersion =
						typeof flags.force === "string"
							? Number.parseInt(flags.force, 10)
							: undefined;
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
					const forceVersion =
						typeof flags.force === "string"
							? Number.parseInt(flags.force, 10)
							: undefined;
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
					const autoAttachments =
						attachments.length > 0
							? attachments
							: result.results.flatMap((r) =>
									withAutoDiscoveredAttachments(config, r.relative, []),
								);
					if (config.autoCommit && !dryRun && result.updated > 0) {
						const changed = result.results
							.filter(
								(r): r is (typeof result.results)[number] => r.updated === true,
							)
							.map((r) => r.relative);
						if (changed.length > 0) {
							await autoCommitChanges(
								config,
								[...changed, ...autoAttachments],
								`migrate ${changed.length} note(s)`,
							);
						}
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
					const dirs = parseDirs(
						normalizeFlagValue(flags.dir),
						config.defaultSearchDirs,
					);
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

					const attachments = parseAttachments(normalizeFlags(flags));
					if (!dryRun) {
						await ensureGitGuard(config);
					}
					const result = applyVersionPlan(config, {
						plan,
						dryRun,
						statuses,
						dirs: dirs ?? [],
						migrate: MIGRATIONS,
					});
					const filteredPlan =
						emitPlan || isJson
							? {
									type: plan.type,
									targetVersion: plan.targetVersion,
									dirs: dirs ?? plan.dirs ?? [],
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
					const fileArg = args[3]; // para-obsidian git commit <file>
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
