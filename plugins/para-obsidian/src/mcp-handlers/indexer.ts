/**
 * Para-Obsidian MCP Tools: Indexer
 *
 * Index management and PARA list tools.
 */

import { parseKeyValuePairs } from "@sidequest/core/cli";
import { tool, z } from "@sidequest/core/mcp";
import {
	createCorrelationId,
	log,
	parseDirs,
	parseResponseFormat,
	ResponseFormat,
	respondError,
	respondText,
} from "../../mcp/utils";
import { loadConfig } from "../config/index";
import {
	buildIndex,
	listAreas,
	listProjects,
	loadIndex,
	saveIndex,
} from "../search/indexer";

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
	async (args: Record<string, unknown>) => {
		const { dir, response_format } = args as {
			dir?: string;
			response_format?: string;
		};
		const cid = createCorrelationId();
		const startTime = Date.now();
		log({ cid, tool: "para_index_prime", event: "request" });

		try {
			const config = loadConfig();
			const dirs = parseDirs(dir);
			const index = buildIndex(config, dirs);
			const savedPath = saveIndex(config, index);
			const format = parseResponseFormat(response_format);

			log({
				cid,
				tool: "para_index_prime",
				event: "response",
				success: true,
				count: index.entries.length,
				durationMs: Date.now() - startTime,
			});

			if (format === ResponseFormat.JSON) {
				return respondText(
					format,
					JSON.stringify(
						{ indexPath: savedPath, count: index.entries.length },
						null,
						2,
					),
				);
			}

			return respondText(
				format,
				`## Index Built\n\n**Entries:** ${index.entries.length}\n**Saved to:** \`${savedPath}\``,
			);
		} catch (error) {
			log({
				cid,
				tool: "para_index_prime",
				durationMs: Date.now() - startTime,
				success: false,
				error: error instanceof Error ? error.message : String(error),
			});
			const format = parseResponseFormat(response_format);
			return respondError(format, error);
		}
	},
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
	async (args: Record<string, unknown>) => {
		const { frontmatter, dir, response_format } = args as {
			frontmatter?: string;
			dir?: string;
			response_format?: string;
		};
		const cid = createCorrelationId();
		const startTime = Date.now();
		log({ cid, tool: "para_index_query", event: "request", frontmatter });

		try {
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

			const format = parseResponseFormat(response_format);

			log({
				cid,
				tool: "para_index_query",
				event: "response",
				success: true,
				resultCount: results.length,
				durationMs: Date.now() - startTime,
			});

			if (format === ResponseFormat.JSON) {
				return respondText(
					format,
					JSON.stringify({ count: results.length, results }, null, 2),
				);
			}

			const lines = ["## Index Query Results", ""];
			if (results.length === 0) {
				lines.push("_No matches found_");
			} else {
				for (const r of results) {
					lines.push(`- ${r.file}`);
				}
			}

			return respondText(format, lines.join("\n"));
		} catch (error) {
			log({
				cid,
				tool: "para_index_query",
				durationMs: Date.now() - startTime,
				success: false,
				error: error instanceof Error ? error.message : String(error),
			});
			const format = parseResponseFormat(response_format);
			return respondError(format, error);
		}
	},
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
	async (args: Record<string, unknown>) => {
		const cid = createCorrelationId();
		const startTime = Date.now();
		log({ cid, tool: "para_list_areas", event: "request" });

		try {
			const config = loadConfig();
			const areas = listAreas(config);
			const format = parseResponseFormat(
				args.response_format as string | undefined,
			);

			log({
				cid,
				tool: "para_list_areas",
				event: "response",
				success: true,
				count: areas.length,
				durationMs: Date.now() - startTime,
			});

			if (format === ResponseFormat.JSON) {
				return respondText(
					format,
					JSON.stringify({ areas, count: areas.length }, null, 2),
				);
			}

			return respondText(
				format,
				areas.length > 0
					? `# Existing Areas (${areas.length})\n\n${areas.map((a) => `- ${a}`).join("\n")}`
					: "No areas found in 02 Areas/",
			);
		} catch (error) {
			log({
				cid,
				tool: "para_list_areas",
				durationMs: Date.now() - startTime,
				success: false,
				error: error instanceof Error ? error.message : String(error),
			});
			const format = parseResponseFormat(
				args.response_format as string | undefined,
			);
			return respondError(format, error);
		}
	},
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
	async (args: Record<string, unknown>) => {
		const cid = createCorrelationId();
		const startTime = Date.now();
		log({ cid, tool: "para_list_projects", event: "request" });

		try {
			const config = loadConfig();
			const projects = listProjects(config);
			const format = parseResponseFormat(
				args.response_format as string | undefined,
			);

			log({
				cid,
				tool: "para_list_projects",
				event: "response",
				success: true,
				count: projects.length,
				durationMs: Date.now() - startTime,
			});

			if (format === ResponseFormat.JSON) {
				return respondText(
					format,
					JSON.stringify({ projects, count: projects.length }, null, 2),
				);
			}

			return respondText(
				format,
				projects.length > 0
					? `# Existing Projects (${projects.length})\n\n${projects.map((p) => `- ${p}`).join("\n")}`
					: "No projects found in 01 Projects/",
			);
		} catch (error) {
			log({
				cid,
				tool: "para_list_projects",
				durationMs: Date.now() - startTime,
				success: false,
				error: error instanceof Error ? error.message : String(error),
			});
			const format = parseResponseFormat(
				args.response_format as string | undefined,
			);
			return respondError(format, error);
		}
	},
);
