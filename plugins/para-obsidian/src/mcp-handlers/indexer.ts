/**
 * Para-Obsidian MCP Tools: Indexer
 *
 * Index management and PARA list tools.
 */

import { randomUUID } from "node:crypto";
import { getLogger } from "@logtape/logtape";
import { parseKeyValuePairs } from "@side-quest/core/cli";
import { tool, z } from "@side-quest/core/mcp";
import {
	createLoggerAdapter,
	ResponseFormat,
	wrapToolHandler,
} from "@side-quest/core/mcp-response";
import { parseDirs } from "../../mcp/utils";
import { loadConfig } from "../config/index";
import {
	buildIndex,
	listAreas,
	listProjects,
	loadIndex,
	saveIndex,
} from "../search/indexer";

const logger = createLoggerAdapter(getLogger("para-obsidian.mcp"));
const createCid = () => randomUUID();

// ============================================================================
// Index Prime Tool
// ============================================================================

tool(
	"para_index_prime",
	{
		description: `Build and save vault index for fast queries.

Creates a cached index of:
- Frontmatter attributes
- Tags
- Heading structure

Enables fast queries via para_index_query without parsing all files.

Index saved to .para-obsidian-index.json in vault root.`,
		inputSchema: {
			dir: z
				.string()
				.optional()
				.describe(
					"Directories to index (comma-separated, default: vault root)",
				),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	wrapToolHandler(
		async (args, format) => {
			const { dir } = args as { dir?: string };
			const config = loadConfig();
			const dirs = parseDirs(dir);
			const index = buildIndex(config, dirs);
			const savedPath = saveIndex(config, index);

			if (format === ResponseFormat.JSON) {
				return { indexPath: savedPath, count: index.entries.length };
			}

			return `## Index Built\n\n**Entries:** ${index.entries.length}\n**Saved to:** \`${savedPath}\``;
		},
		{ toolName: "para_index_prime", logger, createCid },
	),
);

// ============================================================================
// Index Query Tool
// ============================================================================

tool(
	"para_index_query",
	{
		description: `Query cached vault index for fast lookups.

Queries the pre-built index for files matching:
- Frontmatter key=value pairs
- Directory scoping

Much faster than full-text search for metadata queries.

Requires index to exist (run para_index_prime first).`,
		inputSchema: {
			frontmatter: z
				.string()
				.optional()
				.describe("Filter by frontmatter key=value (comma-separated)"),
			dir: z
				.string()
				.optional()
				.describe("Limit to directories (comma-separated)"),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	wrapToolHandler(
		async (args, format) => {
			const { frontmatter, dir } = args as {
				frontmatter?: string;
				dir?: string;
			};
			const config = loadConfig();
			const index = loadIndex(config);
			if (!index) {
				throw new Error("Index not found. Run para_index_prime first.");
			}

			const dirs = parseDirs(dir);
			const fmFilters = frontmatter
				? parseKeyValuePairs(frontmatter.split(","))
				: {};

			const results = index.entries.filter((entry) => {
				// Directory filter
				if (dirs) {
					const matches = dirs.some((d) => {
						const normalized = d.replace(/\\/g, "/").replace(/\/+$/, "");
						return (
							entry.file === normalized ||
							entry.file.startsWith(`${normalized}/`)
						);
					});
					if (!matches) return false;
				}

				// Frontmatter filters
				for (const [k, v] of Object.entries(fmFilters)) {
					if (entry.frontmatter[k] !== v) return false;
				}

				return true;
			});

			if (format === ResponseFormat.JSON) {
				return { count: results.length, results };
			}

			const lines = ["## Index Query Results", ""];
			if (results.length === 0) {
				lines.push("_No matches found_");
			} else {
				for (const r of results) {
					lines.push(`- ${r.file}`);
				}
			}

			return lines.join("\n");
		},
		{ toolName: "para_index_query", logger, createCid },
	),
);

// ============================================================================
// List Areas Tool
// ============================================================================

tool(
	"para_list_areas",
	{
		description: `List existing area names from 02 Areas/ directory. Returns area titles (without .md extension) sorted alphabetically. Use before creating projects to suggest existing areas or allow user to create new.`,
		inputSchema: {
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	wrapToolHandler(
		async (_args, format) => {
			const config = loadConfig();
			const areas = listAreas(config);

			if (format === ResponseFormat.JSON) {
				return { areas, count: areas.length };
			}

			return areas.length > 0
				? `# Existing Areas (${areas.length})\n\n${areas.map((a) => `- ${a}`).join("\n")}`
				: "No areas found in 02 Areas/";
		},
		{ toolName: "para_list_areas", logger, createCid },
	),
);

// ============================================================================
// List Projects Tool
// ============================================================================

tool(
	"para_list_projects",
	{
		description: `List existing project names from 01 Projects/ directory. Returns project titles (without .md extension) sorted alphabetically. Use for linking tasks to projects.`,
		inputSchema: {
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	wrapToolHandler(
		async (_args, format) => {
			const config = loadConfig();
			const projects = listProjects(config);

			if (format === ResponseFormat.JSON) {
				return { projects, count: projects.length };
			}

			return projects.length > 0
				? `# Existing Projects (${projects.length})\n\n${projects.map((p) => `- ${p}`).join("\n")}`
				: "No projects found in 01 Projects/";
		},
		{ toolName: "para_list_projects", logger, createCid },
	),
);
