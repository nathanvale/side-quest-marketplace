/**
 * Para-Obsidian MCP Tools: Search
 *
 * Text and semantic search tools for vault content.
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
import { filterByFrontmatter, searchText } from "../search/index";
import { semanticSearch } from "../search/semantic";
import { validateRegex } from "../shared/validation";

const logger = createLoggerAdapter(getLogger("para-obsidian.mcp"));
const createCid = () => randomUUID();

// ============================================================================
// Text Search Tool
// ============================================================================

tool(
	"para_search",
	{
		description: `Search for text in vault files using ripgrep.

Performs fast text search with support for:
- Literal strings or regex patterns
- Directory scoping
- Frontmatter filtering
- Result limiting
- Context lines

Requires ripgrep (rg) to be installed.`,
		inputSchema: {
			query: z.string().describe("Search query (text or regex pattern)"),
			dir: z
				.string()
				.optional()
				.describe(
					'Directories to search (comma-separated, e.g., "Projects,Areas")',
				),
			regex: z
				.boolean()
				.optional()
				.describe("Treat query as regex (default: false, literal search)"),
			frontmatter: z
				.string()
				.optional()
				.describe("Filter by frontmatter key=value (comma-separated pairs)"),
			max_results: z
				.number()
				.optional()
				.describe("Maximum number of results to return"),
			context: z
				.number()
				.optional()
				.describe("Lines of context to show before/after matches"),
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
			const { query, dir, regex, frontmatter, max_results, context } = args as {
				query: string;
				dir?: string;
				regex?: boolean;
				frontmatter?: string;
				max_results?: number;
				context?: number;
			};
			const config = loadConfig();
			const dirs = parseDirs(dir);
			const fmFilters = frontmatter
				? parseKeyValuePairs(frontmatter.split(","))
				: undefined;

			// Validate regex pattern if regex mode is enabled
			const isRegexMode = regex ?? false;
			if (isRegexMode) {
				const validation = validateRegex(query);
				if (!validation.valid) {
					throw new Error(`Invalid regex pattern: ${validation.error}`);
				}
			}

			// Apply frontmatter filters first if present
			const allowedFiles = fmFilters
				? await filterByFrontmatter(config, {
						dir: dirs,
						frontmatter: fmFilters,
					})
				: undefined;

			const hits = await searchText(config, {
				query,
				dir: dirs,
				regex: isRegexMode,
				maxResults: max_results,
				context,
				allowedFiles,
			});

			if (format === ResponseFormat.JSON) {
				return { query, hits };
			}

			const lines = [`## Search Results: "${query}"`, ""];
			if (hits.length === 0) {
				lines.push("_No matches found_");
			} else {
				for (const hit of hits) {
					lines.push(`- **${hit.file}:${hit.line}:** ${hit.snippet}`);
				}
			}

			return lines.join("\n");
		},
		{ toolName: "para_search", logger, createCid },
	),
);

// ============================================================================
// Semantic Search Tool
// ============================================================================

tool(
	"para_semantic_search",
	{
		description: `Semantic search using Kit CLI vector embeddings.

Searches vault content by meaning rather than exact text matches. Great for:
- "How does the project management workflow work?"
- "Notes about health and fitness"
- "Information about learning resources"

Requires Kit CLI: uv tool install cased-kit

Falls back to text search if ML dependencies unavailable.`,
		inputSchema: {
			query: z
				.string()
				.describe('Natural language query (e.g., "project planning notes")'),
			dir: z
				.string()
				.optional()
				.describe("Directories to search (comma-separated)"),
			limit: z
				.number()
				.optional()
				.describe("Maximum number of results to return (default: 5)"),
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
			const { query, dir, limit } = args as {
				query: string;
				dir?: string;
				limit?: number;
			};
			const config = loadConfig();
			const dirs = parseDirs(dir);
			const hits = await semanticSearch(config, { query, dir: dirs, limit });

			if (format === ResponseFormat.JSON) {
				return { query, hits };
			}

			const lines = [`## Semantic Search: "${query}"`, ""];
			if (hits.length === 0) {
				lines.push("_No matches found_");
			} else {
				for (const hit of hits) {
					const lineInfo = hit.line ? `:${hit.line}` : "";
					const score = hit.score.toFixed(3);
					lines.push(
						`- **${hit.file}${lineInfo}** (score: ${score})${hit.snippet ? `\n  ${hit.snippet}` : ""}`,
					);
				}
			}

			return lines.join("\n");
		},
		{ toolName: "para_semantic_search", logger, createCid },
	),
);
