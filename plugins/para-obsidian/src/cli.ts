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
	handleClipper,
	handleConfig,
	handleCreate,
	handleCreateClassifier,
	handleCreateNoteTemplate,
	handleDelete,
	handleEnrich,
	handleEnrichBookmark,
	handleExportBookmarks,
	handleFindOrphans,
	handleFrontmatter,
	handleGit,
	handleInboxMove,
	handleIndex,
	handleInsert,
	handleLinkAttachments,
	handleList,
	handleListAreas,
	handleMigrateRemoveTags,
	handleProcess,
	handleProcessInbox,
	handleRead,
	handleRegistry,
	handleRename,
	handleRewriteLinks,
	handleSearch,
	handleSemantic,
	handleTemplateFields,
	handleTemplates,
	handleVoice,
} from "./cli/index";
import type { CommandContext } from "./cli/types";
import { loadConfig } from "./config/index";

function printUsage(): void {
	const lines = [
		color("cyan", "PARA Obsidian CLI"),
		"",
		"Usage:",
		"  para config [--format md|json]",
		"  para templates [--format md|json]",
		"  para template-fields <template> [--format md|json]",
		"  para list [path] [--format md|json]",
		"  para read <file> [--format md|json]",
		"  para search <query> [--frontmatter key=val] [--regex] [--dir path] [--format md|json]",
		"  para index prime [--dir path] [--format md|json]",
		'  para create --template <name> --title "<Title>" [--dest path] [--arg key=value ...] [--format md|json]',
		"  para create --template <name> --source <file> [--preview] [--model name] [--format md|json]",
		'  para insert <file> --heading "<Heading>" --content "<Content>" [--attachments paths] [--format md|json]',
		"  para rename <from> <to> [--dry-run] [--format md|json]",
		"  para delete <file> --confirm [--dry-run] [--format md|json]",
		"  para semantic <query> [--para folder] [--dir path] [--limit N] [--format md|json]",
		"  para frontmatter get|validate|set|migrate <file> [--format md|json]",
		"  para git guard [--format md|json]",
		"  para find-orphans [--dir path] [--format md|json]",
		"  para rewrite-links --from <link> --to <link> [--dry-run] [--format md|json]",
		"",
		"Inbox Processing:",
		"  para process [--dry-run] [--verbose] [--skip-enrichment] [--format md|json]",
		"  para process-inbox [--auto] [--preview] [--dry-run] [--filter pattern] [--force]",
		"  para inbox move [--format md|json]",
		"  para enrich <action> [target|--all] [--dry-run] [--format md|json]",
		"    Actions: youtube",
		"  para export-bookmarks [--filter type:bookmark] [--out path] [--format md|json]",
		"  para clipper list|export|sync|convert|convert-all [--out path] [--format md|json]",
		"  para create-classifier [--quick]",
		"  para create-note-template",
		"  para registry list|remove|clear [--format md|json]",
		'  para enrich-bookmark <file.md|"*.md"> [--dry-run] [--force] [--delay N] [--yes]',
		"  para enrich-bookmark --url <url> [--format md|json]",
		"",
		"Migration:",
		"  para migrate:remove-tags [--dry-run] [--verbose] [--format md|json]",
		"",
		"Voice Memos:",
		"  para voice [--dry-run] [--all] [--since YYYY-MM-DD]",
		"",
		"Shorter aliases:",
		"  para p           (alias for process)",
		"  para scan        (alias for process-inbox)",
		"  para execute     (alias for process-inbox --auto)",
		"  para move        (alias for inbox move)",
		"  para export      (alias for export-bookmarks)",
		"  para init        (alias for create-classifier)",
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
		'  bun run src/cli.ts list "01 Projects"',
		'  bun run src/cli.ts semantic "trip planning" --para projects,resources',
		'  bun run src/cli.ts create --template project --title "New Project" --area "[[Health]]" --target_completion 2025-12-31',
		'  bun run src/cli.ts create --template task --source "inbox/rough-notes.md" --preview',
		'  bun run src/cli.ts create --template task --source "inbox/rough-notes.md" --model qwen:7b --arg "priority=high"',
		'  bun run src/cli.ts create --template area --source-text "Managing Muffin: vet visits, grooming, food subscription"',
		'  bun run src/cli.ts rename "01 Projects/Old.md" "01 Projects/New.md" --dry-run',
		"  bun run src/cli.ts enrich youtube --all",
		'  bun run src/cli.ts enrich youtube "00 Inbox/my-video.md"',
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
		// Note: flags are passed raw (not normalized) to preserve arrays for multi-value flags like --arg
		const ctx: CommandContext = {
			config,
			positional,
			flags,
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

			case "create-note-template": {
				const result = await handleCreateNoteTemplate(ctx);
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

			case "process": {
				const result = await handleProcess(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "p": {
				// Alias for 'process'
				const result = await handleProcess(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "process-inbox": {
				const result = await handleProcessInbox(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "export-bookmarks": {
				const result = await handleExportBookmarks(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "clipper": {
				const result = await handleClipper(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			// New shorter aliases for inbox processing
			case "scan": {
				// Alias for process-inbox scan mode (default)
				const result = await handleProcessInbox(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "execute": {
				// Alias for process-inbox --auto (execute mode)
				ctx.flags.auto = true;
				const result = await handleProcessInbox(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "export": {
				// Alias for export-bookmarks
				const result = await handleExportBookmarks(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "init": {
				// Alias for create-classifier
				const result = await handleCreateClassifier(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "create-classifier": {
				const result = await handleCreateClassifier(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "registry": {
				const result = await handleRegistry(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "enrich-bookmark": {
				const result = await handleEnrichBookmark(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "enrich": {
				// Standalone enrich command (YouTube, etc.)
				const result = await handleEnrich(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "inbox": {
				// Handle inbox subcommands
				if (subcommand === "move") {
					const result = await handleInboxMove(ctx);
					if (!result.success) process.exit(result.exitCode ?? 1);
				} else {
					console.error(`Unknown inbox subcommand: ${subcommand}`);
					printUsage();
					process.exit(1);
				}
				break;
			}

			case "move": {
				// Alias for 'inbox move'
				const result = await handleInboxMove(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "migrate:remove-tags": {
				const result = await handleMigrateRemoveTags(ctx);
				if (!result.success) process.exit(result.exitCode ?? 1);
				break;
			}

			case "voice": {
				const result = await handleVoice(ctx);
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
		// Preserve specific exit codes from commands
		const exitCode =
			error && typeof error === "object" && "exitCode" in error
				? (error.exitCode as number)
				: 1;
		process.exit(exitCode);
	}
}

// Only run main when executed directly (not when imported)
if (import.meta.main) {
	await main();
}

// Re-export for backward compatibility (previously exported from this file)
export {
	computeFrontmatterHints,
	suggestFieldsForType,
} from "./cli/frontmatter";
