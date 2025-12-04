#!/usr/bin/env bun

/**
 * PARA Obsidian CLI
 *
 * Command-line interface for managing a PARA-style Obsidian vault.
 * Mirrors Kit CLI style: subcommands with minimal flags, JSON/MD output.
 */

import { loadConfig } from "./config";
import { createFromTemplate } from "./create";
import { deleteFile } from "./delete";
import {
	migrateAllTemplateVersions,
	migrateTemplateVersion,
	readFrontmatterFile,
	validateFrontmatterFile,
} from "./frontmatter";
import { listDir, readFile } from "./fs";
import { assertGitRepo, autoCommitChanges, gitStatus } from "./git";
import { buildIndex, loadIndex, saveIndex } from "./indexer";
import { type InsertMode, insertIntoNote } from "./insert";
import { renameWithLinkRewrite } from "./links";
import { MIGRATIONS } from "./migrations";
import { filterByFrontmatter, searchText } from "./search";
import { semanticSearch } from "./semantic";

function printUsage(): void {
	console.log(`
PARA Obsidian CLI

Usage:
  bun run src/cli.ts config [--format md|json]
  bun run src/cli.ts list [path] [--format md|json]
  bun run src/cli.ts read <file> [--format md|json]
  bun run src/cli.ts search <query> [--tag TAG] [--frontmatter key=val] [--regex] [--dir path] [--format md|json]
  bun run src/cli.ts index prime [--dir path] [--format md|json]
  bun run src/cli.ts index query [--tag TAG] [--frontmatter key=val] [--format md|json]
  bun run src/cli.ts create --template <name> --title "<Title>" [--dest path] [--arg key=value ...] [--attachments paths] [--format md|json]
  bun run src/cli.ts insert <file> --heading "<Heading>" --content "<Content>" [--before|--after|--append|--prepend] [--attachments paths] [--format md|json]
  bun run src/cli.ts rename <from> <to> [--dry-run] [--attachments paths] [--format md|json]
  bun run src/cli.ts delete <file> --confirm [--dry-run] [--attachments paths] [--format md|json]
  bun run src/cli.ts semantic <query> [--dir path] [--limit N] [--format md|json]
  bun run src/cli.ts frontmatter get <file> [--format md|json]
  bun run src/cli.ts frontmatter validate <file> [--format md|json]
  bun run src/cli.ts frontmatter migrate <file> [--force <version>] [--dry-run] [--attachments paths] [--format md|json]
  bun run src/cli.ts frontmatter migrate-all [--dir path] [--dry-run] [--attachments paths] [--format md|json]
  bun run src/cli.ts git guard [--format md|json]

Options:
  --format md|json  Output format (default: md)
  --force           Force reindex (index prime)
  --dry-run         Preview changes without writing
  --confirm         Required for delete
  --attachments     Comma-separated vault-relative files to include in auto-commit

Examples:
  bun run src/cli.ts config --format json
  bun run src/cli.ts list 01_Projects
  bun run src/cli.ts create --template project --title "New Project" --area "[[Health]]" --target_completion 2025-12-31
  bun run src/cli.ts rename "01_Projects/Old.md" "01_Projects/New.md" --dry-run
`);
}

function parseArgs(argv: string[]): {
	command: string;
	subcommand?: string;
	positional: string[];
	flags: Record<string, string | boolean>;
} {
	const positional: string[] = [];
	const flags: Record<string, string | boolean> = {};

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (!arg) continue;
		if (arg.startsWith("--")) {
			const [keyRaw, value] = arg.split("=");
			const key = keyRaw?.slice(2);
			if (!key) continue;
			const next = argv[i + 1];
			if (value !== undefined) {
				flags[key] = value;
			} else if (next && !next.startsWith("--")) {
				flags[key] = next;
				i++;
			} else {
				flags[key] = true;
			}
		} else {
			positional.push(arg);
		}
	}

	const [command, subcommand, ...rest] = positional;
	return { command: command ?? "", subcommand, positional: rest, flags };
}

function parseFormat(value: string | boolean | undefined): "md" | "json" {
	if (value === "json") return "json";
	return "md";
}

function parseAttachments(flags: Record<string, string | boolean>): string[] {
	const raw = flags.attachments;
	if (typeof raw !== "string") return [];
	return raw
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	if (args.length === 0 || args.includes("--help")) {
		printUsage();
		return;
	}

	const { command, subcommand, positional, flags } = parseArgs(args);
	const format = parseFormat(flags.format);

	try {
		// Always load config early to ensure vault/env are valid.
		const config = loadConfig();

		switch (command) {
			case "config": {
				if (format === "json") {
					console.log(JSON.stringify(config, null, 2));
				} else {
					console.log(`Vault: ${config.vault}`);
					console.log(`Templates: ${config.templatesDir}`);
					if (config.indexPath) console.log(`Index: ${config.indexPath}`);
					if (config.autoCommit !== undefined) {
						console.log(`Auto-commit: ${config.autoCommit}`);
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
				const attachments = parseAttachments(flags);
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
				if (format === "json") {
					console.log(JSON.stringify(result, null, 2));
				} else {
					console.log(
						`${dryRun ? "Would rename" : "Renamed"} ${from} → ${to} (rewrites: ${result.rewrites.length})`,
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
				const attachments = parseAttachments(flags);
				const result = deleteFile(config, { file, confirm, dryRun });
				if (config.autoCommit && !dryRun) {
					await autoCommitChanges(
						config,
						[result.relative, ...attachments],
						`delete ${file}`,
					);
				}
				if (format === "json") {
					console.log(JSON.stringify(result, null, 2));
				} else {
					console.log(
						`${dryRun ? "Would delete" : "Deleted"} ${result.relative}`,
					);
				}
				break;
			}

			case "list": {
				const dir = subcommand ?? ".";
				const entries = listDir(config.vault, dir);
				if (format === "json") {
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
				if (format === "json") {
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
					const dir = positional[0];
					const index = buildIndex(config, dir);
					const path = saveIndex(config, index);
					if (format === "json") {
						console.log(
							JSON.stringify(
								{ indexPath: path, count: index.entries.length },
								null,
								2,
							),
						);
					} else {
						console.log(`Indexed ${index.entries.length} files → ${path}`);
					}
					break;
				}

				if (action === "query") {
					const tag = typeof flags.tag === "string" ? flags.tag : undefined;
					const frontmatter: Record<string, string> = {};
					for (const [k, v] of Object.entries(flags)) {
						if (k.startsWith("frontmatter.") && typeof v === "string") {
							frontmatter[k.replace("frontmatter.", "")] = v;
						}
					}
					const index = loadIndex(config);
					if (!index) {
						console.error("Index not found. Run index prime first.");
						process.exit(1);
					}
					const results = index.entries.filter((entry) => {
						if (tag && !entry.tags.includes(tag)) return false;
						for (const [k, v] of Object.entries(frontmatter)) {
							if (entry.frontmatter[k] !== v) return false;
						}
						return true;
					});
					if (format === "json") {
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
				const dir = typeof flags.dir === "string" ? flags.dir : undefined;
				const frontmatter: Record<string, string> = {};
				for (const [k, v] of Object.entries(flags)) {
					if (k.startsWith("frontmatter.") && typeof v === "string") {
						frontmatter[k.replace("frontmatter.", "")] = v;
					}
				}

				const hits = searchText(config, {
					query,
					dir,
					regex: flags.regex === true || flags.regex === "true",
					maxResults:
						typeof flags["max-results"] === "string"
							? Number.parseInt(flags["max-results"], 10)
							: undefined,
				});

				const fmMatches =
					Object.keys(frontmatter).length > 0 || tag
						? filterByFrontmatter(config, { frontmatter, tag, dir })
						: [];

				if (format === "json") {
					console.log(
						JSON.stringify({ query, hits, frontmatter: fmMatches }, null, 2),
					);
				} else {
					for (const hit of hits) {
						console.log(`${hit.file}:${hit.line}: ${hit.snippet}`);
					}
					if (fmMatches.length > 0) {
						console.log("\nFrontmatter matches:");
						for (const f of fmMatches) console.log(f);
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
				const dir = typeof flags.dir === "string" ? flags.dir : undefined;
				const limit =
					typeof flags.limit === "string"
						? Number.parseInt(flags.limit, 10)
						: undefined;
				try {
					const hits = await semanticSearch(config, { query, dir, limit });
					if (format === "json") {
						console.log(JSON.stringify({ query, hits }, null, 2));
					} else {
						for (const hit of hits) {
							const line = hit.line ? `:${hit.line}` : "";
							const score = hit.score.toFixed(3);
							console.log(
								`${hit.file}${line} (${score}) ${hit.snippet ?? ""}`.trim(),
							);
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
				if (!template || !title) {
					console.error("create requires --template and --title");
					process.exit(1);
				}

				const argsForTemplate: Record<string, string> = {};
				for (const [k, v] of Object.entries(flags)) {
					if (["template", "title", "dest", "format"].includes(k)) continue;
					if (typeof v === "string") argsForTemplate[k] = v;
				}

				const result = createFromTemplate(config, {
					template,
					title,
					dest,
					args: argsForTemplate,
				});
				const attachments = parseAttachments(flags);
				if (config.autoCommit) {
					await autoCommitChanges(
						config,
						[result.filePath, ...attachments],
						`create ${result.filePath}`,
					);
				}
				if (format === "json") {
					console.log(JSON.stringify(result, null, 2));
				} else {
					console.log(`Created ${result.filePath}`);
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
					if (format === "json") {
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
					if (format === "json") {
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
							console.log(`✅ ${result.relative} frontmatter ok`);
						} else {
							console.log(`⚠️  ${result.relative} has issues:`);
							for (const issue of result.issues) {
								console.log(`- ${issue.field}: ${issue.message}`);
							}
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
					const attachments = parseAttachments(flags);
					const result = migrateTemplateVersion(config, target, {
						forceVersion,
						dryRun,
						migrate: MIGRATIONS,
					});
					if (config.autoCommit && !dryRun) {
						await autoCommitChanges(
							config,
							[result.relative, ...attachments],
							`migrate ${target} to v${result.toVersion}`,
						);
					}
					if (format === "json") {
						console.log(JSON.stringify(result, null, 2));
					} else {
						console.log(
							`${dryRun ? "Would migrate" : "Migrated"} ${result.relative} to template_version ${result.toVersion}`,
						);
					}
					break;
				}

				if (action === "migrate-all") {
					const dryRun =
						flags["dry-run"] === true || flags["dry-run"] === "true";
					const dir = typeof flags.dir === "string" ? flags.dir : undefined;
					const attachments = parseAttachments(flags);
					const result = migrateAllTemplateVersions(config, {
						dir,
						dryRun,
						migrate: MIGRATIONS,
					});
					if (config.autoCommit && !dryRun && result.updated > 0) {
						const changed = result.results
							.filter(
								(r): r is (typeof result.results)[number] => r.updated === true,
							)
							.map((r) => r.relative);
						if (changed.length > 0) {
							await autoCommitChanges(
								config,
								[...changed, ...attachments],
								`migrate ${changed.length} note(s)`,
							);
						}
					}
					if (format === "json") {
						console.log(JSON.stringify(result, null, 2));
					} else {
						console.log(
							`${dryRun ? "Would migrate" : "Migrated"}: updated ${result.updated} (${result.wouldUpdate} would update), skipped ${result.skipped}, errors ${result.errors}`,
						);
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
				const attachments = parseAttachments(flags);

				const result = insertIntoNote(config, {
					file,
					heading,
					content,
					mode,
				});
				if (config.autoCommit) {
					await autoCommitChanges(
						config,
						[result.relative, ...attachments],
						`insert ${file}`,
					);
				}
				if (format === "json") {
					console.log(JSON.stringify(result, null, 2));
				} else {
					console.log(
						`Inserted into ${result.relative} (${mode}) under "${heading}"`,
					);
				}
				break;
			}

			case "git": {
				const action = subcommand;
				if (action !== "guard") {
					console.error("git supports only 'guard'");
					process.exit(1);
				}
				try {
					await assertGitRepo(config.vault);
					const status = await gitStatus(config.vault);
					if (format === "json") {
						console.log(
							JSON.stringify({ git: "ok", clean: status.clean }, null, 2),
						);
					} else {
						console.log(`Git OK (clean=${status.clean})`);
					}
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "Git guard failed";
					if (format === "json") {
						console.log(JSON.stringify({ git: "error", message }, null, 2));
					} else {
						console.error(message);
					}
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

main();
