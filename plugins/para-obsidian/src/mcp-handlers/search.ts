/**
 * Para-Obsidian MCP Tools: Search
 *
 * Text and semantic search tools for vault content.
 */

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
import { filterByFrontmatter, searchText } from "../search/index";
import { semanticSearch } from "../search/semantic";

// ============================================================================
// Helper: Parse key=value pairs
// ============================================================================

function parseKeyValuePairs(pairs: string[]): Record<string, string> {
	const result: Record<string, string> = {};
	for (const pair of pairs) {
		const [key, ...rest] = pair.split("=");
		if (key && rest.length > 0) {
			result[key.trim()] = rest.join("=").trim();
		}
	}
	return result;
}

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
- Frontmatter and tag filtering
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
			tag: z.string().optional().describe("Filter by tag in frontmatter"),
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
	async (args: Record<string, unknown>) => {
		const {
			query,
			dir,
			regex,
			tag,
			frontmatter,
			max_results,
			context,
			response_format,
		} = args as {
			query: string;
			dir?: string;
			regex?: boolean;
			tag?: string;
			frontmatter?: string;
			max_results?: number;
			context?: number;
			response_format?: string;
		};
		const cid = createCorrelationId();
		const startTime = Date.now();
		log({ cid, tool: "para_search", event: "request", query });

		try {
			const config = loadConfig();
			const dirs = parseDirs(dir);
			const fmFilters = frontmatter
				? parseKeyValuePairs(frontmatter.split(","))
				: undefined;

			// Apply frontmatter/tag filters first if present
			const allowedFiles =
				fmFilters || tag
					? await filterByFrontmatter(config, {
							dir: dirs,
							tag,
							frontmatter: fmFilters,
						})
					: undefined;

			const hits = await searchText(config, {
				query,
				dir: dirs,
				regex: regex ?? false,
				maxResults: max_results,
				context,
				allowedFiles,
			});

			const format = parseResponseFormat(response_format);

			log({
				cid,
				tool: "para_search",
				event: "response",
				success: true,
				hitCount: hits.length,
				durationMs: Date.now() - startTime,
			});

			if (format === ResponseFormat.JSON) {
				return respondText(format, JSON.stringify({ query, hits }, null, 2));
			}

			const lines = [`## Search Results: "${query}"`, ""];
			if (hits.length === 0) {
				lines.push("_No matches found_");
			} else {
				for (const hit of hits) {
					lines.push(`- **${hit.file}:${hit.line}:** ${hit.snippet}`);
				}
			}

			return respondText(format, lines.join("\n"));
		} catch (error) {
			log({
				cid,
				tool: "para_search",
				event: "error",
				error: error instanceof Error ? error.message : String(error),
			});
			const format = parseResponseFormat(response_format);
			return respondError(format, error);
		}
	},
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
	async (args: Record<string, unknown>) => {
		const { query, dir, limit, response_format } = args as {
			query: string;
			dir?: string;
			limit?: number;
			response_format?: string;
		};
		const cid = createCorrelationId();
		const startTime = Date.now();
		log({ cid, tool: "para_semantic_search", event: "request", query });

		try {
			const config = loadConfig();
			const dirs = parseDirs(dir);
			const hits = await semanticSearch(config, { query, dir: dirs, limit });
			const format = parseResponseFormat(response_format);

			log({
				cid,
				tool: "para_semantic_search",
				event: "response",
				success: true,
				hitCount: hits.length,
				durationMs: Date.now() - startTime,
			});

			if (format === ResponseFormat.JSON) {
				return respondText(format, JSON.stringify({ query, hits }, null, 2));
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

			return respondText(format, lines.join("\n"));
		} catch (error) {
			log({
				cid,
				tool: "para_semantic_search",
				event: "error",
				error: error instanceof Error ? error.message : String(error),
			});
			const format = parseResponseFormat(response_format);
			return respondError(format, error);
		}
	},
);
