#!/usr/bin/env bun

/**
 * PARA Obsidian CLI
 *
 * Command-line interface for managing a PARA-style Obsidian vault.
 * Mirrors Kit CLI style: subcommands with minimal flags, JSON/MD output.
 */

import { parseArgs } from "@sidequest/core/cli";
import {
	color,
	OutputFormat,
	parseOutputFormat,
} from "@sidequest/core/terminal";
import {
	handleCleanBrokenLinks,
	handleConfig,
	handleCreate,
	handleDelete,
	handleFindOrphans,
	handleFrontmatter,
	handleGit,
	handleIndex,
	handleInsert,
	handleLinkAttachments,
	handleList,
	handleListAreas,
	handleListTags,
	handleProcessInbox,
	handleRead,
	handleRename,
	handleRewriteLinks,
	handleScanTags,
	handleSearch,
	handleSemantic,
	handleTemplateFields,
	handleTemplates,
	normalizeFlags,
} from "./cli/index";
import type { CommandContext } from "./cli/types";
import { loadConfig } from "./config/index";

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
				const result = await handleCreate(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "frontmatter": {
				const result = await handleFrontmatter(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "insert": {
				const result = await handleInsert(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "git": {
				const result = await handleGit(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "process-inbox": {
				const result = await handleProcessInbox(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
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

// Re-export for backward compatibility (previously exported from this file)
export {
	computeFrontmatterHints,
	suggestFieldsForType,
} from "./cli/frontmatter";
