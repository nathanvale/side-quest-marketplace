#!/usr/bin/env bun

if (!process.env.MCPEZ_AUTO_START) {
	process.env.MCPEZ_AUTO_START = "false";
}

import { startServer, tool, z } from "mcpez";
import { discoverAttachments } from "../../src/attachments";
import { listTemplateVersions, loadConfig } from "../../src/config";
import { createFromTemplate } from "../../src/create";
import { deleteFile } from "../../src/delete";
import {
	applyVersionPlan,
	migrateAllTemplateVersions,
	migrateTemplateVersion,
	planTemplateVersionBump,
	readFrontmatterFile,
	updateFrontmatterFile,
	type VersionPlanStatus,
	validateFrontmatterFile,
} from "../../src/frontmatter";
import { listDir, readFile } from "../../src/fs";
import { autoCommitChanges } from "../../src/git";
import { buildIndex, loadIndex, saveIndex } from "../../src/indexer";
import { insertIntoNote } from "../../src/insert";
import { renameWithLinkRewrite } from "../../src/links";
import { MIGRATIONS } from "../../src/migrations";
import { filterByFrontmatter, searchText } from "../../src/search";
import { semanticSearch } from "../../src/semantic";

function parseAttachments(input?: ReadonlyArray<string>) {
	return input?.filter(Boolean) ?? [];
}

function withAutoDiscoveredAttachments(
	vault: string,
	note: string,
	explicit: ReadonlyArray<string>,
): ReadonlyArray<string> {
	if (explicit.length > 0) return explicit;
	return discoverAttachments(vault, note);
}

function parseDirs(input?: string): ReadonlyArray<string> | undefined {
	if (!input) return undefined;
	const dirs = input
		.split(",")
		.map((dir) => dir.trim())
		.filter(Boolean);
	return dirs.length > 0 ? dirs : undefined;
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

function coerceValue(raw: string): unknown {
	const trimmed = raw.trim();
	if (trimmed === "true") return true;
	if (trimmed === "false") return false;
	if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
	if (
		(trimmed.startsWith("[") && trimmed.endsWith("]")) ||
		(trimmed.startsWith("{") && trimmed.endsWith("}"))
	) {
		try {
			return JSON.parse(trimmed);
		} catch {
			// fall through to comma/identity parsing
		}
	}
	if (trimmed.includes(",")) {
		return trimmed
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
	}
	return trimmed;
}

const configTool = tool({
	name: "config",
	description:
		"Load para-obsidian resolved configuration (requires PARA_VAULT)",
	parameters: z.object({}),
	execute: async () => loadConfig(),
});

const templatesTool = tool({
	name: "templates",
	description: "List configured template versions",
	parameters: z.object({}),
	execute: async () => {
		const cfg = loadConfig();
		return {
			templates: listTemplateVersions(cfg),
			defaultSearchDirs: cfg.defaultSearchDirs,
		};
	},
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
		const dirs = parseDirs(dir) ?? cfg.defaultSearchDirs;
		const fmFilters = frontmatter ?? {};
		const hits = searchText(cfg, {
			query,
			dir: dirs,
			regex: regex === true,
			maxResults,
		});
		const fmMatches =
			Object.keys(fmFilters).length > 0 || tag
				? filterByFrontmatter(cfg, {
						frontmatter: fmFilters,
						tag,
						dir: dirs,
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
		const attach = withAutoDiscoveredAttachments(
			cfg.vault,
			result.filePath,
			parseAttachments(attachments),
		);
		if (cfg.autoCommit) {
			await autoCommitChanges(
				cfg,
				[result.filePath, ...attach],
				`create ${result.filePath}`,
			);
		}
		return { ...result, attachmentsUsed: attach };
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
		const attach = withAutoDiscoveredAttachments(
			cfg.vault,
			file,
			parseAttachments(attachments),
		);
		if (cfg.autoCommit) {
			await autoCommitChanges(
				cfg,
				[result.relative, ...attach],
				`insert ${file}`,
			);
		}
		return { ...result, attachmentsUsed: attach };
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
		const attach = withAutoDiscoveredAttachments(
			cfg.vault,
			to,
			parseAttachments(attachments),
		);
		if (cfg.autoCommit && !dryRun) {
			await autoCommitChanges(
				cfg,
				[
					...new Set([
						from,
						to,
						...result.rewrites.map((r) => r.file),
						...attach,
					]),
				],
				`rename ${from} → ${to}`,
			);
		}
		return { ...result, attachmentsUsed: attach };
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
		const attach = withAutoDiscoveredAttachments(
			cfg.vault,
			file,
			parseAttachments(attachments),
		);
		if (cfg.autoCommit && !dryRun) {
			await autoCommitChanges(
				cfg,
				[result.relative, ...attach],
				`delete ${file}`,
			);
		}
		return { ...result, attachmentsUsed: attach };
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

const frontmatterPlanTool = tool({
	name: "frontmatter_plan",
	description: "Plan template version bump for a given type",
	parameters: z.object({
		type: z.string(),
		toVersion: z.number(),
		dir: z.string().optional(),
	}),
	execute: async ({ type, toVersion, dir }) => {
		const cfg = loadConfig();
		const dirs = parseDirs(dir) ?? cfg.defaultSearchDirs;
		return planTemplateVersionBump(cfg, { type, toVersion, dir: dirs });
	},
});

const frontmatterApplyPlanTool = tool({
	name: "frontmatter_apply_plan",
	description: "Apply a version plan to migrate only selected files",
	parameters: z.object({
		plan: z.object({
			entries: z.array(
				z.object({
					file: z.string(),
					status: z.string(),
					current: z.number().optional(),
					target: z.number(),
					type: z.string().optional(),
				}),
			),
			type: z.string(),
			targetVersion: z.number(),
			dirs: z.array(z.string()).optional(),
		}),
		statuses: z.array(z.string()).optional(),
		dryRun: z.boolean().optional(),
		dir: z.string().optional(),
	}),
	execute: async ({ plan, statuses, dryRun, dir }) => {
		const cfg = loadConfig();
		const dirs = parseDirs(dir);
		const chosen =
			statuses?.length && statuses.length > 0
				? (statuses as VersionPlanStatus[])
				: (["outdated", "missing-version", "current"] as VersionPlanStatus[]);
		return applyVersionPlan(cfg, {
			plan,
			dryRun,
			dirs,
			statuses: chosen,
			migrate: MIGRATIONS,
		});
	},
});

const frontmatterSetTool = tool({
	name: "frontmatter_set",
	description: "Set or unset frontmatter keys on a note",
	parameters: z.object({
		file: z.string(),
		set: z.record(z.string(), z.string()).optional(),
		unset: z.array(z.string()).optional(),
		dryRun: z.boolean().optional(),
		attachments: z.array(z.string()).optional(),
	}),
	execute: async ({ file, set, unset, dryRun, attachments }) => {
		const cfg = loadConfig();
		const typed: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(set ?? {})) {
			typed[k] = coerceValue(v);
		}
		const result = updateFrontmatterFile(cfg, file, {
			set: typed,
			unset,
			dryRun,
		});
		const attach = withAutoDiscoveredAttachments(
			cfg.vault,
			file,
			parseAttachments(attachments),
		);
		if (cfg.autoCommit && !dryRun && result.updated) {
			await autoCommitChanges(
				cfg,
				[result.relative, ...attach],
				`frontmatter set ${file}`,
			);
		}
		return { ...result, attachmentsUsed: attach };
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
			migrate: MIGRATIONS,
		});
		const attach = withAutoDiscoveredAttachments(
			cfg.vault,
			file,
			parseAttachments(attachments),
		);
		if (cfg.autoCommit && !dryRun) {
			await autoCommitChanges(
				cfg,
				[result.relative, ...attach],
				`migrate ${file} to v${result.toVersion}`,
			);
		}
		return { ...result, attachmentsUsed: attach };
	},
});

const frontmatterMigrateAllTool = tool({
	name: "frontmatter_migrate_all",
	description: "Migrate template_version for all notes (optional dir)",
	parameters: z.object({
		dir: z.string().optional(),
		dryRun: z.boolean().optional(),
		attachments: z.array(z.string()).optional(),
		forceVersion: z.number().optional(),
		type: z.string().optional(),
	}),
	execute: async ({ dir, dryRun, attachments, forceVersion, type }) => {
		const cfg = loadConfig();
		const dirs = parseDirs(dir) ?? cfg.defaultSearchDirs;
		const result = migrateAllTemplateVersions(cfg, {
			dir: dirs,
			dryRun,
			forceVersion,
			type,
			migrate: MIGRATIONS,
		});
		const attach = parseAttachments(attachments);
		if (cfg.autoCommit && !dryRun && result.updated > 0) {
			const changed = result.results
				.filter((r) => r.updated)
				.map((r) => r.relative);
			if (changed.length > 0) {
				const auto =
					attach.length > 0
						? attach
						: changed.flatMap((filePath) =>
								withAutoDiscoveredAttachments(cfg.vault, filePath, []),
							);
				await autoCommitChanges(
					cfg,
					[...changed, ...auto],
					`migrate ${changed.length} note(s)`,
				);
			}
		}
		const attachmentsUsed =
			attach.length > 0
				? attach
				: result.results.flatMap((r) =>
						withAutoDiscoveredAttachments(cfg.vault, r.relative, []),
					);
		return { ...result, attachmentsUsed };
	},
});

const indexPrimeTool = tool({
	name: "index_prime",
	description: "Build and save index (frontmatter/tags/headings)",
	parameters: z.object({ dir: z.string().optional() }),
	execute: async ({ dir }) => {
		const cfg = loadConfig();
		const dirs = parseDirs(dir);
		const index = buildIndex(cfg, dirs);
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
		dir: z.string().optional(),
	}),
	execute: async ({ tag, frontmatter, dir }) => {
		const cfg = loadConfig();
		const index = loadIndex(cfg);
		if (!index) throw new Error("Index not found. Run index_prime first.");
		const dirs = parseDirs(dir) ?? cfg.defaultSearchDirs;
		const results = index.entries.filter((entry) => {
			if (!matchesDir(entry.file, dirs)) return false;
			if (tag && !entry.tags.includes(tag)) return false;
			for (const [k, v] of Object.entries(frontmatter ?? {})) {
				if (entry.frontmatter[k] !== v) return false;
			}
			return true;
		});
		return { count: results.length, results };
	},
});

const semanticTool = tool({
	name: "semantic_search",
	description: "Semantic search using kit (requires kit CLI)",
	parameters: z.object({
		query: z.string(),
		dir: z.string().optional(),
		limit: z.number().optional(),
	}),
	execute: async ({ query, dir, limit }) => {
		const cfg = loadConfig();
		const dirs = parseDirs(dir) ?? cfg.defaultSearchDirs;
		const hits = await semanticSearch(cfg, { query, dir: dirs, limit });
		return { query, hits };
	},
});

export const tools = [
	configTool,
	templatesTool,
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
	frontmatterPlanTool,
	frontmatterSetTool,
	frontmatterMigrateTool,
	frontmatterMigrateAllTool,
	frontmatterApplyPlanTool,
	semanticTool,
];

if (import.meta.main) {
	startServer({
		name: "para-obsidian",
		version: "0.1.0",
		tools,
	});
}
