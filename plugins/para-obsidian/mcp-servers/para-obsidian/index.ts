#!/usr/bin/env bun

import { startServer, tool, z } from "mcpez";

import { loadConfig } from "../../src/config";
import { createFromTemplate } from "../../src/create";
import { deleteFile } from "../../src/delete";
import {
	migrateAllTemplateVersions,
	migrateTemplateVersion,
	readFrontmatterFile,
	validateFrontmatterFile,
} from "../../src/frontmatter";
import { listDir, readFile } from "../../src/fs";
import { autoCommitChanges } from "../../src/git";
import { buildIndex, loadIndex, saveIndex } from "../../src/indexer";
import { insertIntoNote } from "../../src/insert";
import { renameWithLinkRewrite } from "../../src/links";
import { filterByFrontmatter, searchText } from "../../src/search";

function parseAttachments(input?: ReadonlyArray<string>) {
	return input?.filter(Boolean) ?? [];
}

const configTool = tool({
	name: "config",
	description:
		"Load para-obsidian resolved configuration (requires PARA_VAULT)",
	parameters: z.object({}),
	execute: async () => loadConfig(),
});

const listTool = tool({
	name: "list",
	description: "List files/directories relative to vault",
	parameters: z.object({ path: z.string().optional() }),
	execute: async ({ path }) => {
		const cfg = loadConfig();
		return listDir(cfg.vault, path ?? ".");
	},
});

const readTool = tool({
	name: "read",
	description: "Read a markdown file from the vault",
	parameters: z.object({ file: z.string() }),
	execute: async ({ file }) => {
		const cfg = loadConfig();
		return readFile(cfg.vault, file);
	},
});

const searchTool = tool({
	name: "search",
	description: "Search text with optional tag/frontmatter filters",
	parameters: z.object({
		query: z.string(),
		tag: z.string().optional(),
		dir: z.string().optional(),
		regex: z.boolean().optional(),
		frontmatter: z.record(z.string(), z.string()).optional(),
		maxResults: z.number().optional(),
	}),
	execute: async ({ query, tag, dir, regex, frontmatter, maxResults }) => {
		const cfg = loadConfig();
		const hits = searchText(cfg, {
			query,
			dir,
			regex: regex === true,
			maxResults,
		});
		const fmMatches =
			frontmatter || tag
				? filterByFrontmatter(cfg, {
						frontmatter: frontmatter ?? {},
						tag,
						dir,
					})
				: [];
		return { hits, frontmatter: fmMatches };
	},
});

const createTool = tool({
	name: "create",
	description: "Create a note from template with optional auto-commit",
	parameters: z.object({
		template: z.string(),
		title: z.string(),
		dest: z.string().optional(),
		args: z.record(z.string(), z.string()).optional(),
		attachments: z.array(z.string()).optional(),
	}),
	execute: async ({ template, title, dest, args, attachments }) => {
		const cfg = loadConfig();
		const result = createFromTemplate(cfg, {
			template,
			title,
			dest,
			args: args ?? {},
		});
		const attach = parseAttachments(attachments);
		if (cfg.autoCommit) {
			await autoCommitChanges(
				cfg,
				[result.filePath, ...attach],
				`create ${result.filePath}`,
			);
		}
		return result;
	},
});

const insertTool = tool({
	name: "insert",
	description: "Insert content under a heading",
	parameters: z.object({
		file: z.string(),
		heading: z.string(),
		content: z.string(),
		mode: z.enum(["append", "prepend", "before", "after"]),
		attachments: z.array(z.string()).optional(),
	}),
	execute: async ({ file, heading, content, mode, attachments }) => {
		const cfg = loadConfig();
		const result = insertIntoNote(cfg, { file, heading, content, mode });
		const attach = parseAttachments(attachments);
		if (cfg.autoCommit) {
			await autoCommitChanges(
				cfg,
				[result.relative, ...attach],
				`insert ${file}`,
			);
		}
		return result;
	},
});

const renameTool = tool({
	name: "rename",
	description: "Rename/move a note with link rewrites",
	parameters: z.object({
		from: z.string(),
		to: z.string(),
		dryRun: z.boolean().optional(),
		attachments: z.array(z.string()).optional(),
	}),
	execute: async ({ from, to, dryRun, attachments }) => {
		const cfg = loadConfig();
		const result = renameWithLinkRewrite(cfg, {
			from,
			to,
			dryRun: dryRun === true,
		});
		const attach = parseAttachments(attachments);
		if (cfg.autoCommit && !dryRun) {
			await autoCommitChanges(
				cfg,
				[from, to, ...result.rewrites.map((r) => r.file), ...attach],
				`rename ${from} → ${to}`,
			);
		}
		return result;
	},
});

const deleteTool = tool({
	name: "delete",
	description: "Delete a note with confirmation",
	parameters: z.object({
		file: z.string(),
		confirm: z.boolean().default(false),
		dryRun: z.boolean().optional(),
		attachments: z.array(z.string()).optional(),
	}),
	execute: async ({ file, confirm, dryRun, attachments }) => {
		const cfg = loadConfig();
		const result = deleteFile(cfg, { file, confirm, dryRun: dryRun === true });
		const attach = parseAttachments(attachments);
		if (cfg.autoCommit && !dryRun) {
			await autoCommitChanges(
				cfg,
				[result.relative, ...attach],
				`delete ${file}`,
			);
		}
		return result;
	},
});

const frontmatterGetTool = tool({
	name: "frontmatter_get",
	description: "Get frontmatter for a note",
	parameters: z.object({ file: z.string() }),
	execute: async ({ file }) => {
		const cfg = loadConfig();
		return readFrontmatterFile(cfg, file);
	},
});

const frontmatterValidateTool = tool({
	name: "frontmatter_validate",
	description: "Validate frontmatter for a note",
	parameters: z.object({ file: z.string() }),
	execute: async ({ file }) => {
		const cfg = loadConfig();
		return validateFrontmatterFile(cfg, file);
	},
});

const frontmatterMigrateTool = tool({
	name: "frontmatter_migrate",
	description: "Migrate a note's template_version",
	parameters: z.object({
		file: z.string(),
		forceVersion: z.number().optional(),
		dryRun: z.boolean().optional(),
		attachments: z.array(z.string()).optional(),
	}),
	execute: async ({ file, forceVersion, dryRun, attachments }) => {
		const cfg = loadConfig();
		const result = migrateTemplateVersion(cfg, file, {
			forceVersion,
			dryRun,
		});
		const attach = parseAttachments(attachments);
		if (cfg.autoCommit && !dryRun) {
			await autoCommitChanges(
				cfg,
				[result.relative, ...attach],
				`migrate ${file} to v${result.toVersion}`,
			);
		}
		return result;
	},
});

const frontmatterMigrateAllTool = tool({
	name: "frontmatter_migrate_all",
	description: "Migrate template_version for all notes (optional dir)",
	parameters: z.object({
		dir: z.string().optional(),
		dryRun: z.boolean().optional(),
		attachments: z.array(z.string()).optional(),
	}),
	execute: async ({ dir, dryRun, attachments }) => {
		const cfg = loadConfig();
		const result = migrateAllTemplateVersions(cfg, { dir, dryRun });
		const attach = parseAttachments(attachments);
		if (cfg.autoCommit && !dryRun && result.updated > 0) {
			const changed = result.results
				.filter((r) => r.updated)
				.map((r) => r.relative);
			if (changed.length > 0) {
				await autoCommitChanges(
					cfg,
					[...changed, ...attach],
					`migrate ${changed.length} note(s)`,
				);
			}
		}
		return result;
	},
});

const indexPrimeTool = tool({
	name: "index_prime",
	description: "Build and save index (frontmatter/tags/headings)",
	parameters: z.object({ dir: z.string().optional() }),
	execute: async ({ dir }) => {
		const cfg = loadConfig();
		const index = buildIndex(cfg, dir);
		const path = saveIndex(cfg, index);
		return { indexPath: path, count: index.entries.length };
	},
});

const indexQueryTool = tool({
	name: "index_query",
	description: "Query cached index by tag/frontmatter",
	parameters: z.object({
		tag: z.string().optional(),
		frontmatter: z.record(z.string(), z.string()).optional(),
	}),
	execute: async ({ tag, frontmatter }) => {
		const cfg = loadConfig();
		const index = loadIndex(cfg);
		if (!index) throw new Error("Index not found. Run index_prime first.");
		const results = index.entries.filter((entry) => {
			if (tag && !entry.tags.includes(tag)) return false;
			for (const [k, v] of Object.entries(frontmatter ?? {})) {
				if (entry.frontmatter[k] !== v) return false;
			}
			return true;
		});
		return { count: results.length, results };
	},
});

startServer({
	name: "para-obsidian",
	version: "0.1.0",
	tools: [
		configTool,
		listTool,
		readTool,
		searchTool,
		indexPrimeTool,
		indexQueryTool,
		createTool,
		insertTool,
		renameTool,
		deleteTool,
		frontmatterGetTool,
		frontmatterValidateTool,
		frontmatterMigrateTool,
		frontmatterMigrateAllTool,
	],
});
