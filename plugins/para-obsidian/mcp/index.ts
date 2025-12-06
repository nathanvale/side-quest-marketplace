#!/usr/bin/env bun

/**
 * Para-Obsidian MCP Server
 *
 * Provides 19 MCP tools for PARA-style Obsidian vault management with
 * frontmatter validation, template versioning, and git auto-commit.
 *
 * Pattern: Each tool follows the 6-step handler pattern from Kit reference:
 * 1. Create correlation ID (cid)
 * 2. Log request start
 * 3. Execute operation
 * 4. Format output (markdown/json)
 * 5. Log response
 * 6. Return MCP response with isError flag
 */

if (!process.env.MCPEZ_AUTO_START) {
	process.env.MCPEZ_AUTO_START = "false";
}

import {
	createCorrelationId,
	createPluginLogger,
} from "@sidequest/core/logging";
import { startServer, tool, z } from "@sidequest/core/mcp";
import type { ParaObsidianConfig } from "../src/config";
import { listTemplateVersions, loadConfig } from "../src/config";
import { createFromTemplate } from "../src/create";
import { deleteFile } from "../src/delete";
import {
	applyVersionPlan,
	migrateAllTemplateVersions,
	migrateTemplateVersion,
	planTemplateVersionBump,
	readFrontmatterFile,
	updateFrontmatterFile,
	type VersionPlanStatus,
	validateFrontmatterFile,
} from "../src/frontmatter";
import { listDir, readFile } from "../src/fs";
import { buildIndex, loadIndex, saveIndex } from "../src/indexer";
import { type InsertMode, insertIntoNote } from "../src/insert";
import { renameWithLinkRewrite } from "../src/links";
import { MIGRATIONS } from "../src/migrations";
import { filterByFrontmatter, searchText } from "../src/search";
import { semanticSearch } from "../src/semantic";
import { getTemplate, getTemplateFields } from "../src/templates";

// ============================================================================
// Logging
// ============================================================================

const { initLogger, getSubsystemLogger } = createPluginLogger({
	name: "para-obsidian",
	subsystems: ["mcp"],
});

initLogger().catch(console.error);
const mcpLogger = getSubsystemLogger("mcp");

interface LogEntry {
	cid: string;
	tool: string;
	[key: string]: unknown;
}

function log(entry: LogEntry): void {
	mcpLogger.info({ ...entry, timestamp: new Date().toISOString() });
}

// ============================================================================
// Formatting Utilities
// ============================================================================

enum ResponseFormat {
	MARKDOWN = "markdown",
	JSON = "json",
}

function parseResponseFormat(value?: string): ResponseFormat {
	return value === "json" ? ResponseFormat.JSON : ResponseFormat.MARKDOWN;
}

function formatError(error: unknown, format: ResponseFormat): string {
	const message = error instanceof Error ? error.message : String(error);
	if (format === ResponseFormat.JSON) {
		return JSON.stringify({ error: message, isError: true }, null, 2);
	}
	return `**Error:** ${message}`;
}

// ============================================================================
// Helper Functions
// ============================================================================

function parseDirs(
	value: string | undefined,
): ReadonlyArray<string> | undefined {
	if (!value) return undefined;
	return value
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

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

function coerceValue(value: string): unknown {
	// Try parsing as JSON first
	if (value === "true") return true;
	if (value === "false") return false;
	if (value === "null") return null;
	if (/^\d+$/.test(value)) return Number.parseInt(value, 10);
	if (/^\d+\.\d+$/.test(value)) return Number.parseFloat(value);
	if (value.startsWith("[") && value.endsWith("]")) {
		try {
			return JSON.parse(value);
		} catch {
			// Fall through to string
		}
	}
	return value;
}

/**
 * Frontmatter field hint information.
 * Provides helpful suggestions for setting frontmatter fields.
 */
interface FrontmatterHint {
	/** Allowed enum values for this field (if applicable). */
	readonly allowedValues?: ReadonlyArray<string>;
	/** Expected data type for this field. */
	readonly expectedType?: "string" | "date" | "array" | "wikilink" | "enum";
	/** Example values for this field. */
	readonly examples?: ReadonlyArray<string>;
	/** Human-readable description of the field. */
	readonly description?: string;
}

/**
 * Computes helpful hints for a frontmatter field based on note type and field name.
 *
 * Looks up the field in the frontmatter rules for the note type and provides
 * suggestions including allowed enum values, expected type, and examples.
 *
 * @param config - Para-obsidian configuration with frontmatter rules
 * @param noteType - Note type (e.g., "project", "area", "task")
 * @param field - Field name to get hints for
 * @returns Hint object with suggestions, or undefined if no specific hints available
 *
 * @example
 * ```typescript
 * const hint = computeFrontmatterHint(config, "project", "status");
 * // { allowedValues: ["active", "on-hold", "completed", "archived"], expectedType: "enum" }
 * ```
 */
function computeFrontmatterHint(
	config: ParaObsidianConfig,
	noteType: string,
	field: string,
): FrontmatterHint | undefined {
	const rules = config.frontmatterRules?.[noteType];
	if (!rules?.required) return undefined;

	const rule = rules.required[field];
	if (!rule) return undefined;

	// Build hint object with all properties at creation time
	const hintProps: FrontmatterHint = {
		expectedType: rule.type,
		description: rule.description,
	};

	// Add enum-specific hints
	if (rule.type === "enum" && rule.enum) {
		return {
			...hintProps,
			allowedValues: rule.enum,
			examples: [rule.enum[0]!], // First enum value as example
		};
	}

	// Add array-specific hints
	if (rule.type === "array") {
		return {
			...hintProps,
			examples: rule.includes
				? [`[${rule.includes.map((v) => `"${v}"`).join(", ")}]`]
				: ['["tag1", "tag2"]'],
		};
	}

	// Add date-specific hints
	if (rule.type === "date") {
		const today = new Date().toISOString().split("T")[0]!;
		return {
			...hintProps,
			examples: [today],
		};
	}

	// Add wikilink-specific hints
	if (rule.type === "wikilink") {
		return {
			...hintProps,
			examples: ["[[Note Name]]"],
		};
	}

	return hintProps;
}

/**
 * Formats a frontmatter hint as a human-readable string.
 *
 * @param field - Field name
 * @param hint - Hint object with suggestions
 * @returns Formatted hint string for display
 */
function formatFrontmatterHint(field: string, hint: FrontmatterHint): string {
	const parts: string[] = [];

	if (hint.description) {
		parts.push(hint.description);
	}

	if (hint.expectedType) {
		parts.push(`Type: ${hint.expectedType}`);
	}

	if (hint.allowedValues && hint.allowedValues.length > 0) {
		parts.push(`Allowed values: ${hint.allowedValues.join(", ")}`);
	}

	if (hint.examples && hint.examples.length > 0) {
		parts.push(`Example: ${field}: ${hint.examples[0]}`);
	}

	return parts.length > 0
		? `\n\n**Hint for ${field}:**\n${parts.join("\n")}`
		: "";
}

// ============================================================================
// Configuration Tool
// ============================================================================

tool(
	"para_config",
	{
		description: `Load resolved para-obsidian configuration.

Shows current configuration including:
- Vault path (from PARA_VAULT env)
- Templates directory
- Index path
- Auto-commit settings
- Frontmatter rules
- Template versions

Configuration sources (precedence order):
1. Environment variables (PARA_VAULT required)
2. User config (~/.config/para-obsidian/config.json)
3. Project config (.para-obsidianrc in cwd)
4. Defaults`,
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
		log({ cid, tool: "para_config", event: "request" });

		try {
			const config = loadConfig();
			const format = parseResponseFormat(
				args.response_format as string | undefined,
			);

			log({
				cid,
				tool: "para_config",
				event: "response",
				success: true,
				durationMs: Date.now() - startTime,
			});

			if (format === ResponseFormat.JSON) {
				return {
					content: [
						{ type: "text" as const, text: JSON.stringify(config, null, 2) },
					],
				};
			}

			const lines = [
				"## Para-Obsidian Configuration",
				"",
				`**Vault:** \`${config.vault}\``,
				`**Templates:** \`${config.templatesDir ?? "default"}\``,
			];
			if (config.indexPath) {
				lines.push(`**Index:** \`${config.indexPath}\``);
			}
			if (config.autoCommit !== undefined) {
				lines.push(`**Auto-commit:** ${config.autoCommit}`);
			}
			lines.push(
				"",
				`**Template versions:** ${Object.keys(config.templateVersions ?? {}).length} configured`,
				`**Frontmatter rules:** ${Object.keys(config.frontmatterRules ?? {}).length} types`,
			);

			return {
				content: [{ type: "text" as const, text: lines.join("\n") }],
			};
		} catch (error) {
			log({
				cid,
				tool: "para_config",
				event: "error",
				error: error instanceof Error ? error.message : String(error),
			});
			const format = parseResponseFormat(
				args.response_format as string | undefined,
			);
			return {
				isError: true,
				content: [{ type: "text" as const, text: formatError(error, format) }],
			};
		}
	},
);

// ============================================================================
// Templates Tool
// ============================================================================

tool(
	"para_templates",
	{
		description: `List configured template versions.

Returns all template types (project, area, resource, task, etc.) with their
current template_version numbers. Used for migration planning and template
catalog display.`,
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
		log({ cid, tool: "para_templates", event: "request" });

		try {
			const config = loadConfig();
			const templates = listTemplateVersions(config);
			const format = parseResponseFormat(
				args.response_format as string | undefined,
			);

			log({
				cid,
				tool: "para_templates",
				event: "response",
				success: true,
				count: templates.length,
				durationMs: Date.now() - startTime,
			});

			if (format === ResponseFormat.JSON) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify({ templates }, null, 2),
						},
					],
				};
			}

			const lines = ["## Template Versions", ""];
			for (const tpl of templates) {
				lines.push(`- **${tpl.name}:** v${tpl.version}`);
			}

			return {
				content: [{ type: "text" as const, text: lines.join("\n") }],
			};
		} catch (error) {
			log({
				cid,
				tool: "para_templates",
				event: "error",
				error: error instanceof Error ? error.message : String(error),
			});
			const format = parseResponseFormat(
				args.response_format as string | undefined,
			);
			return {
				isError: true,
				content: [{ type: "text" as const, text: formatError(error, format) }],
			};
		}
	},
);

// ============================================================================
// Template Fields Tool
// ============================================================================

tool(
	"para_template_fields",
	{
		description: `Inspect a template to see what fields it requires.

Extracts all Templater prompt fields from a template, showing:
- Exact key names to use in args (e.g., "Project title", "Area")
- Whether fields appear in frontmatter vs body
- Which fields auto-fill (like dates)

This tool makes it clear what arguments to provide when creating notes from templates.

Example: For project template, shows you need:
  { "Project title": "...", "Target completion date (YYYY-MM-DD)": "...", "Area": "..." }`,
		inputSchema: {
			template: z
				.string()
				.describe("Template name (e.g., 'project', 'capture')"),
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
		log({ cid, tool: "para_template_fields", event: "request", args });

		try {
			const config = loadConfig();
			const templateName = args.template as string;
			const template = getTemplate(config, templateName);

			if (!template) {
				throw new Error(`Template not found: ${templateName}`);
			}

			const fields = getTemplateFields(template);
			const format = parseResponseFormat(
				args.response_format as string | undefined,
			);

			log({
				cid,
				tool: "para_template_fields",
				event: "response",
				success: true,
				template: templateName,
				fieldCount: fields.length,
				durationMs: Date.now() - startTime,
			});

			if (format === ResponseFormat.JSON) {
				const requiredFields = fields.filter(
					(f) => !f.isAutoDate && f.inFrontmatter,
				);
				const autoFields = fields.filter((f) => f.isAutoDate);
				const bodyFields = fields.filter(
					(f) => !f.isAutoDate && !f.inFrontmatter,
				);

				// Build enhanced field info with type hints
				const enhancedRequired = requiredFields.map((f) => {
					const result: {
						key: string;
						type?: string;
						example?: string;
					} = { key: f.key };

					// Infer type and example from key name
					if (f.key.toLowerCase().includes("date")) {
						result.type = "date";
						result.example = new Date().toISOString().split("T")[0];
					} else if (
						f.key.toLowerCase().includes("area") ||
						f.key.toLowerCase().includes("project")
					) {
						result.type = "wikilink";
						result.example = "[[Note Name]]";
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

				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(
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
						},
					],
				};
			}

			const lines = [
				`## Template Fields: ${templateName} (v${template.version})`,
				"",
			];

			const requiredFields = fields.filter(
				(f) => !f.isAutoDate && f.inFrontmatter,
			);
			const autoFields = fields.filter((f) => f.isAutoDate);
			const bodyFields = fields.filter(
				(f) => !f.isAutoDate && !f.inFrontmatter,
			);

			if (requiredFields.length > 0) {
				lines.push("### Required Fields (provide in args):", "");
				for (const field of requiredFields) {
					lines.push(`- \`"${field.key}"\` (frontmatter)`);
				}
				lines.push("");
			}

			if (autoFields.length > 0) {
				lines.push("### Auto-filled Fields (no args needed):", "");
				for (const field of autoFields) {
					lines.push(`- \`"${field.key}"\` (auto-fills with current date)`);
				}
				lines.push("");
			}

			if (bodyFields.length > 0) {
				lines.push("### Optional Body Fields:", "");
				for (const field of bodyFields) {
					lines.push(`- \`"${field.key}"\``);
				}
				lines.push("");
			}

			if (requiredFields.length > 0) {
				lines.push("### Example MCP Call:", "", "```json");
				const example: Record<string, string> = {};
				for (const field of requiredFields.slice(0, 3)) {
					example[field.key] = "...";
				}
				lines.push(
					JSON.stringify(
						{
							template: templateName,
							title: "My Note Title",
							args: example,
						},
						null,
						2,
					),
				);
				lines.push("```");
			}

			return {
				content: [{ type: "text" as const, text: lines.join("\n") }],
			};
		} catch (error) {
			log({
				cid,
				tool: "para_template_fields",
				event: "error",
				error: error instanceof Error ? error.message : String(error),
			});
			const format = parseResponseFormat(
				args.response_format as string | undefined,
			);
			return {
				isError: true,
				content: [{ type: "text" as const, text: formatError(error, format) }],
			};
		}
	},
);

// ============================================================================
// List Tool
// ============================================================================

tool(
	"para_list",
	{
		description: `List files and directories in the vault.

Returns entries in a directory (default: vault root). Shows both files and
subdirectories.

Note: Returns vault-relative paths.`,
		inputSchema: {
			path: z
				.string()
				.optional()
				.describe('Directory to list (default: ".", vault root)'),
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
		const { path, response_format } = args as {
			path?: string;
			response_format?: string;
		};
		const cid = createCorrelationId();
		const startTime = Date.now();
		log({ cid, tool: "para_list", event: "request", path });

		try {
			const config = loadConfig();
			const dir = path ?? ".";
			const entries = listDir(config.vault, dir);
			const format = parseResponseFormat(response_format);

			log({
				cid,
				tool: "para_list",
				event: "response",
				success: true,
				count: entries.length,
				durationMs: Date.now() - startTime,
			});

			if (format === ResponseFormat.JSON) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify({ dir, entries }, null, 2),
						},
					],
				};
			}

			return {
				content: [
					{
						type: "text" as const,
						text: `## Files in ${dir}\n\n${entries.join("\n")}`,
					},
				],
			};
		} catch (error) {
			log({
				cid,
				tool: "para_list",
				event: "error",
				error: error instanceof Error ? error.message : String(error),
			});
			const format = parseResponseFormat(response_format);
			return {
				isError: true,
				content: [{ type: "text" as const, text: formatError(error, format) }],
			};
		}
	},
);

// ============================================================================
// Read Tool
// ============================================================================

tool(
	"para_read",
	{
		description: `Read the contents of a vault file.

Returns the full text content of a file (typically Markdown notes).

Note: Paths are vault-relative (e.g., "Projects/My Note.md").`,
		inputSchema: {
			file: z.string().describe('File path to read (e.g., "Projects/Note.md")'),
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
		const { file, response_format } = args as {
			file: string;
			response_format?: string;
		};
		const cid = createCorrelationId();
		const startTime = Date.now();
		log({ cid, tool: "para_read", event: "request", file });

		try {
			const config = loadConfig();
			const content = readFile(config.vault, file);
			const format = parseResponseFormat(response_format);

			log({
				cid,
				tool: "para_read",
				event: "response",
				success: true,
				durationMs: Date.now() - startTime,
			});

			if (format === ResponseFormat.JSON) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify({ file, content }, null, 2),
						},
					],
				};
			}

			return {
				content: [{ type: "text" as const, text: content }],
			};
		} catch (error) {
			log({
				cid,
				tool: "para_read",
				event: "error",
				error: error instanceof Error ? error.message : String(error),
			});
			const format = parseResponseFormat(response_format);
			return {
				isError: true,
				content: [{ type: "text" as const, text: formatError(error, format) }],
			};
		}
	},
);

// ============================================================================
// Search Tool
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
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify({ query, hits }, null, 2),
						},
					],
				};
			}

			const lines = [`## Search Results: "${query}"`, ""];
			if (hits.length === 0) {
				lines.push("_No matches found_");
			} else {
				for (const hit of hits) {
					lines.push(`- **${hit.file}:${hit.line}:** ${hit.snippet}`);
				}
			}

			return {
				content: [{ type: "text" as const, text: lines.join("\n") }],
			};
		} catch (error) {
			log({
				cid,
				tool: "para_search",
				event: "error",
				error: error instanceof Error ? error.message : String(error),
			});
			const format = parseResponseFormat(response_format);
			return {
				isError: true,
				content: [{ type: "text" as const, text: formatError(error, format) }],
			};
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
			// Non-interactive mode for MCP - will provide clear error message if Kit ML not installed
			const hits = await semanticSearch(
				config,
				{ query, dir: dirs, limit },
				false, // non-interactive
			);
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
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify({ query, hits }, null, 2),
						},
					],
				};
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

			return {
				content: [{ type: "text" as const, text: lines.join("\n") }],
			};
		} catch (error) {
			log({
				cid,
				tool: "para_semantic_search",
				event: "error",
				error: error instanceof Error ? error.message : String(error),
			});
			const format = parseResponseFormat(response_format);
			return {
				isError: true,
				content: [{ type: "text" as const, text: formatError(error, format) }],
			};
		}
	},
);

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
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(
								{ indexPath: savedPath, count: index.entries.length },
								null,
								2,
							),
						},
					],
				};
			}

			return {
				content: [
					{
						type: "text" as const,
						text: `## Index Built\n\n**Entries:** ${index.entries.length}\n**Saved to:** \`${savedPath}\``,
					},
				],
			};
		} catch (error) {
			log({
				cid,
				tool: "para_index_prime",
				event: "error",
				error: error instanceof Error ? error.message : String(error),
			});
			const format = parseResponseFormat(response_format);
			return {
				isError: true,
				content: [{ type: "text" as const, text: formatError(error, format) }],
			};
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
- Tag filters
- Frontmatter key=value pairs
- Directory scoping

Much faster than full-text search for metadata queries.

Requires index to exist (run para_index_prime first).`,
		inputSchema: {
			tag: z.string().optional().describe("Filter by tag"),
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
		const { tag, frontmatter, dir, response_format } = args as {
			tag?: string;
			frontmatter?: string;
			dir?: string;
			response_format?: string;
		};
		const cid = createCorrelationId();
		const startTime = Date.now();
		log({ cid, tool: "para_index_query", event: "request", tag, frontmatter });

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

				// Tag filter
				if (tag && !entry.tags.includes(tag)) return false;

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
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify({ count: results.length, results }, null, 2),
						},
					],
				};
			}

			const lines = ["## Index Query Results", ""];
			if (results.length === 0) {
				lines.push("_No matches found_");
			} else {
				for (const r of results) {
					lines.push(`- ${r.file}`);
				}
			}

			return {
				content: [{ type: "text" as const, text: lines.join("\n") }],
			};
		} catch (error) {
			log({
				cid,
				tool: "para_index_query",
				event: "error",
				error: error instanceof Error ? error.message : String(error),
			});
			const format = parseResponseFormat(response_format);
			return {
				isError: true,
				content: [{ type: "text" as const, text: formatError(error, format) }],
			};
		}
	},
);

// ============================================================================
// Create Tool
// ============================================================================

tool(
	"para_create",
	{
		description: `Create a new note from template.

Creates a note using Templater-style substitution:
- {{title}} → Note title
- {{date}} → Current date (YYYY-MM-DD)
- {{arg_name}} → Custom arguments

Template files expected at vault/06_Metadata/Templates/{template}.md

Filename: Title Case with spaces (e.g., "My Project Note.md")

Requires git repository with clean working tree.`,
		inputSchema: {
			template: z
				.string()
				.describe('Template name (e.g., "project", "area", "resource")'),
			title: z.string().describe('Note title (e.g., "New Project")'),
			dest: z
				.string()
				.optional()
				.describe("Destination directory (default: depends on template)"),
			args: z
				.record(z.string())
				.optional()
				.describe("Additional template arguments (key-value pairs)"),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: false,
			openWorldHint: false,
		},
	},
	async (args: Record<string, unknown>) => {
		const {
			template,
			title,
			dest,
			args: templateArgs,
			response_format,
		} = args as {
			template: string;
			title: string;
			dest?: string;
			args?: Record<string, string>;
			response_format?: string;
		};
		const cid = createCorrelationId();
		const startTime = Date.now();
		log({ cid, tool: "para_create", event: "request", template, title });

		try {
			const config = loadConfig();
			const result = createFromTemplate(config, {
				template,
				title,
				dest,
				args: templateArgs ?? {},
			});
			const format = parseResponseFormat(response_format);

			log({
				cid,
				tool: "para_create",
				event: "response",
				success: true,
				filePath: result.filePath,
				durationMs: Date.now() - startTime,
			});

			if (format === ResponseFormat.JSON) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(result, null, 2),
						},
					],
				};
			}

			return {
				content: [
					{
						type: "text" as const,
						text: `## Note Created\n\n**File:** ${result.filePath}`,
					},
				],
			};
		} catch (error) {
			log({
				cid,
				tool: "para_create",
				event: "error",
				error: error instanceof Error ? error.message : String(error),
			});
			const format = parseResponseFormat(response_format);
			return {
				isError: true,
				content: [{ type: "text" as const, text: formatError(error, format) }],
			};
		}
	},
);

// ============================================================================
// Insert Tool
// ============================================================================

tool(
	"para_insert",
	{
		description: `Insert text into a note under a heading.

Modes:
- append: Add after heading's content
- prepend: Add before heading's content
- before: Add before heading itself
- after: Add after heading and its content

Requires git repository with clean working tree.`,
		inputSchema: {
			file: z.string().describe('File path (e.g., "Projects/My Note.md")'),
			heading: z.string().describe('Heading to insert near (e.g., "## Tasks")'),
			content: z.string().describe("Text content to insert"),
			mode: z
				.enum(["append", "prepend", "before", "after"])
				.describe(
					"Insert mode: append (default), prepend, before heading, or after heading",
				),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: false,
			openWorldHint: false,
		},
	},
	async (args: Record<string, unknown>) => {
		const { file, heading, content, mode, response_format } = args as {
			file: string;
			heading: string;
			content: string;
			mode: InsertMode;
			response_format?: string;
		};
		const cid = createCorrelationId();
		const startTime = Date.now();
		log({ cid, tool: "para_insert", event: "request", file, heading, mode });

		try {
			const config = loadConfig();
			const result = insertIntoNote(config, { file, heading, content, mode });
			const format = parseResponseFormat(response_format);

			log({
				cid,
				tool: "para_insert",
				event: "response",
				success: true,
				durationMs: Date.now() - startTime,
			});

			if (format === ResponseFormat.JSON) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(result, null, 2),
						},
					],
				};
			}

			return {
				content: [
					{
						type: "text" as const,
						text: `## Text Inserted\n\n**File:** ${result.relative}\n**Mode:** ${mode}\n**Heading:** "${heading}"`,
					},
				],
			};
		} catch (error) {
			log({
				cid,
				tool: "para_insert",
				event: "error",
				error: error instanceof Error ? error.message : String(error),
			});
			const format = parseResponseFormat(response_format);
			return {
				isError: true,
				content: [{ type: "text" as const, text: formatError(error, format) }],
			};
		}
	},
);

// ============================================================================
// Rename Tool
// ============================================================================

tool(
	"para_rename",
	{
		description: `Rename a file with automatic link rewriting.

Renames file and updates all references:
- Wikilinks: [[Old Name]] → [[New Name]]
- Markdown links: [text](old.md) → [text](new.md)

Supports dry-run mode to preview changes.

Requires git repository with clean working tree (unless dry-run).`,
		inputSchema: {
			from: z.string().describe('Current file path (e.g., "Projects/Old.md")'),
			to: z.string().describe('New file path (e.g., "Projects/New.md")'),
			dry_run: z
				.boolean()
				.optional()
				.describe("Preview changes without writing (default: false)"),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: false,
			openWorldHint: false,
		},
	},
	async (args: Record<string, unknown>) => {
		const { from, to, dry_run, response_format } = args as {
			from: string;
			to: string;
			dry_run?: boolean;
			response_format?: string;
		};
		const cid = createCorrelationId();
		const startTime = Date.now();
		log({ cid, tool: "para_rename", event: "request", from, to, dry_run });

		try {
			const config = loadConfig();
			const dryRun = dry_run ?? false;
			const result = renameWithLinkRewrite(config, { from, to, dryRun });
			const format = parseResponseFormat(response_format);

			log({
				cid,
				tool: "para_rename",
				event: "response",
				success: true,
				rewriteCount: result.rewrites.length,
				durationMs: Date.now() - startTime,
			});

			if (format === ResponseFormat.JSON) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(result, null, 2),
						},
					],
				};
			}

			const verb = dryRun ? "Would rename" : "Renamed";
			const lines = [
				`## ${verb} File`,
				"",
				`**From:** ${from}`,
				`**To:** ${to}`,
				`**Link rewrites:** ${result.rewrites.length}`,
			];

			return {
				content: [{ type: "text" as const, text: lines.join("\n") }],
			};
		} catch (error) {
			log({
				cid,
				tool: "para_rename",
				event: "error",
				error: error instanceof Error ? error.message : String(error),
			});
			const format = parseResponseFormat(response_format);
			return {
				isError: true,
				content: [{ type: "text" as const, text: formatError(error, format) }],
			};
		}
	},
);

// ============================================================================
// Delete Tool
// ============================================================================

tool(
	"para_delete",
	{
		description: `Delete a file from the vault.

Requires explicit confirmation (confirm=true).

Supports dry-run mode to preview deletion.

Requires git repository with clean working tree (unless dry-run).`,
		inputSchema: {
			file: z
				.string()
				.describe('File path to delete (e.g., "Projects/Old.md")'),
			confirm: z
				.boolean()
				.describe("Must be true to actually delete (safety check)"),
			dry_run: z
				.boolean()
				.optional()
				.describe("Preview deletion without removing (default: false)"),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: false,
			destructiveHint: true,
			idempotentHint: false,
			openWorldHint: false,
		},
	},
	async (args: Record<string, unknown>) => {
		const { file, confirm, dry_run, response_format } = args as {
			file: string;
			confirm: boolean;
			dry_run?: boolean;
			response_format?: string;
		};
		const cid = createCorrelationId();
		const startTime = Date.now();
		log({ cid, tool: "para_delete", event: "request", file, confirm, dry_run });

		try {
			const config = loadConfig();
			const dryRun = dry_run ?? false;
			const result = deleteFile(config, { file, confirm, dryRun });
			const format = parseResponseFormat(response_format);

			log({
				cid,
				tool: "para_delete",
				event: "response",
				success: true,
				durationMs: Date.now() - startTime,
			});

			if (format === ResponseFormat.JSON) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(result, null, 2),
						},
					],
				};
			}

			const verb = dryRun ? "Would delete" : "Deleted";
			return {
				content: [
					{
						type: "text" as const,
						text: `## ${verb} File\n\n**Path:** ${result.relative}`,
					},
				],
			};
		} catch (error) {
			log({
				cid,
				tool: "para_delete",
				event: "error",
				error: error instanceof Error ? error.message : String(error),
			});
			const format = parseResponseFormat(response_format);
			return {
				isError: true,
				content: [{ type: "text" as const, text: formatError(error, format) }],
			};
		}
	},
);

// ============================================================================
// Frontmatter Get Tool
// ============================================================================

tool(
	"para_frontmatter_get",
	{
		description: `Extract frontmatter from a note.

Returns all frontmatter attributes from the YAML header.

Example output:
{
  "title": "My Note",
  "status": "active",
  "tags": ["project", "work"],
  "template_version": 2
}`,
		inputSchema: {
			file: z.string().describe('File path (e.g., "Projects/My Note.md")'),
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
		const { file, response_format } = args as {
			file: string;
			response_format?: string;
		};
		const cid = createCorrelationId();
		const startTime = Date.now();
		log({ cid, tool: "para_frontmatter_get", event: "request", file });

		try {
			const config = loadConfig();
			const { attributes } = readFrontmatterFile(config, file);
			const format = parseResponseFormat(response_format);

			log({
				cid,
				tool: "para_frontmatter_get",
				event: "response",
				success: true,
				durationMs: Date.now() - startTime,
			});

			if (format === ResponseFormat.JSON) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify({ file, frontmatter: attributes }, null, 2),
						},
					],
				};
			}

			return {
				content: [
					{
						type: "text" as const,
						text: `## Frontmatter: ${file}\n\n\`\`\`yaml\n${JSON.stringify(attributes, null, 2)}\n\`\`\``,
					},
				],
			};
		} catch (error) {
			log({
				cid,
				tool: "para_frontmatter_get",
				event: "error",
				error: error instanceof Error ? error.message : String(error),
			});
			const format = parseResponseFormat(response_format);
			return {
				isError: true,
				content: [{ type: "text" as const, text: formatError(error, format) }],
			};
		}
	},
);

// ============================================================================
// Frontmatter Validate Tool
// ============================================================================

tool(
	"para_frontmatter_validate",
	{
		description: `Validate frontmatter against type rules.

Checks frontmatter fields against configured validation rules for the note type.

Returns validation status and any issues found:
- Missing required fields
- Type mismatches (string vs date vs array)
- Invalid enum values
- Missing wikilink formatting

Validation rules configured per note type (project, area, resource, etc.).`,
		inputSchema: {
			file: z.string().describe('File path (e.g., "Projects/My Note.md")'),
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
		const { file, response_format } = args as {
			file: string;
			response_format?: string;
		};
		const cid = createCorrelationId();
		const startTime = Date.now();
		log({ cid, tool: "para_frontmatter_validate", event: "request", file });

		try {
			const config = loadConfig();
			const result = validateFrontmatterFile(config, file);
			const format = parseResponseFormat(response_format);

			log({
				cid,
				tool: "para_frontmatter_validate",
				event: "response",
				success: true,
				valid: result.valid,
				issueCount: result.issues.length,
				durationMs: Date.now() - startTime,
			});

			if (format === ResponseFormat.JSON) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(
								{
									file: result.relative,
									valid: result.valid,
									issues: result.issues,
								},
								null,
								2,
							),
						},
					],
				};
			}

			const lines = [`## Validation: ${result.relative}`, ""];
			if (result.valid) {
				lines.push("**Status:** ✓ Valid");
			} else {
				lines.push("**Status:** ✗ Invalid", "", "**Issues:**");
				for (const issue of result.issues) {
					lines.push(`- ${issue.field}: ${issue.message}`);
				}
			}

			return {
				content: [{ type: "text" as const, text: lines.join("\n") }],
			};
		} catch (error) {
			log({
				cid,
				tool: "para_frontmatter_validate",
				event: "error",
				error: error instanceof Error ? error.message : String(error),
			});
			const format = parseResponseFormat(response_format);
			return {
				isError: true,
				content: [{ type: "text" as const, text: formatError(error, format) }],
			};
		}
	},
);

// ============================================================================
// Frontmatter Set Tool
// ============================================================================

tool(
	"para_frontmatter_set",
	{
		description: `Update frontmatter fields.

Sets or unsets frontmatter attributes. Values are automatically coerced:
- Booleans: "true" → true
- Numbers: "42" → 42
- Arrays: "[1,2,3]" → [1,2,3]
- Strings: everything else

Validates changes against type rules before writing.

Supports dry-run mode to preview changes.

Requires git repository with clean working tree (unless dry-run).`,
		inputSchema: {
			file: z.string().describe('File path (e.g., "Projects/My Note.md")'),
			set: z
				.record(z.string())
				.optional()
				.describe("Fields to set (key-value pairs)"),
			unset: z
				.array(z.string())
				.optional()
				.describe("Fields to remove (array of keys)"),
			dry_run: z
				.boolean()
				.optional()
				.describe("Preview changes without writing (default: false)"),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: false,
			openWorldHint: false,
		},
	},
	async (args: Record<string, unknown>) => {
		const { file, set, unset, dry_run, response_format } = args as {
			file: string;
			set?: Record<string, string>;
			unset?: string[];
			dry_run?: boolean;
			response_format?: string;
		};
		const cid = createCorrelationId();
		const startTime = Date.now();
		log({ cid, tool: "para_frontmatter_set", event: "request", file });

		try {
			const config = loadConfig();
			const dryRun = dry_run ?? false;

			// Read current frontmatter to get note type for hints
			const { attributes } = readFrontmatterFile(config, file);
			const noteType = attributes.type as string | undefined;

			// Coerce string values to proper types
			const typedSet: Record<string, unknown> = {};
			if (set) {
				for (const [k, v] of Object.entries(set)) {
					typedSet[k] = coerceValue(v);
				}
			}

			const result = updateFrontmatterFile(config, file, {
				set: typedSet,
				unset: unset ?? [],
				dryRun,
			});
			const format = parseResponseFormat(response_format);

			log({
				cid,
				tool: "para_frontmatter_set",
				event: "response",
				success: true,
				updated: result.updated,
				changeCount: result.changes.length,
				durationMs: Date.now() - startTime,
			});

			if (format === ResponseFormat.JSON) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(result, null, 2),
						},
					],
				};
			}

			const verb = dryRun ? "Would update" : "Updated";
			const lines = [`## ${verb} Frontmatter: ${result.relative}`, ""];
			if (result.changes.length === 0) {
				lines.push("_No changes_");
			} else {
				lines.push("**Changes:**");
				for (const change of result.changes) {
					lines.push(`- ${change}`);
				}
			}

			// Add hints for fields that were set
			if (noteType && set) {
				const hintLines: string[] = [];
				for (const field of Object.keys(set)) {
					const hint = computeFrontmatterHint(config, noteType, field);
					if (hint) {
						hintLines.push(formatFrontmatterHint(field, hint));
					}
				}
				if (hintLines.length > 0) {
					lines.push("");
					lines.push("---");
					lines.push(...hintLines);
				}
			}

			return {
				content: [{ type: "text" as const, text: lines.join("\n") }],
			};
		} catch (error) {
			log({
				cid,
				tool: "para_frontmatter_set",
				event: "error",
				error: error instanceof Error ? error.message : String(error),
			});
			const format = parseResponseFormat(response_format);
			return {
				isError: true,
				content: [{ type: "text" as const, text: formatError(error, format) }],
			};
		}
	},
);

// ============================================================================
// Frontmatter Migrate Tool
// ============================================================================

tool(
	"para_frontmatter_migrate",
	{
		description: `Migrate note to latest template version.

Updates template_version field and applies migration hooks:
- Tag backfills (e.g., ensuring "project" tag exists)
- Status normalization (e.g., "planning" → "active")
- Field additions/removals per version

Migrations defined in MIGRATIONS registry.

Supports dry-run mode and force-version override.

Requires git repository with clean working tree (unless dry-run).`,
		inputSchema: {
			file: z.string().describe('File path (e.g., "Projects/My Note.md")'),
			force_version: z
				.number()
				.optional()
				.describe("Force migrate to specific version (default: latest)"),
			dry_run: z
				.boolean()
				.optional()
				.describe("Preview migration without writing (default: false)"),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: false,
			openWorldHint: false,
		},
	},
	async (args: Record<string, unknown>) => {
		const { file, force_version, dry_run, response_format } = args as {
			file: string;
			force_version?: number;
			dry_run?: boolean;
			response_format?: string;
		};
		const cid = createCorrelationId();
		const startTime = Date.now();
		log({
			cid,
			tool: "para_frontmatter_migrate",
			event: "request",
			file,
			force_version,
		});

		try {
			const config = loadConfig();
			const dryRun = dry_run ?? false;
			const result = migrateTemplateVersion(config, file, {
				forceVersion: force_version,
				dryRun,
				migrate: MIGRATIONS,
			});
			const format = parseResponseFormat(response_format);

			log({
				cid,
				tool: "para_frontmatter_migrate",
				event: "response",
				success: true,
				updated: result.updated,
				toVersion: result.toVersion,
				durationMs: Date.now() - startTime,
			});

			if (format === ResponseFormat.JSON) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(result, null, 2),
						},
					],
				};
			}

			const verb = dryRun ? "Would migrate" : "Migrated";
			const lines = [
				`## ${verb} Template Version`,
				"",
				`**File:** ${result.relative}`,
				`**To version:** ${result.toVersion}`,
			];

			if (result.changes && result.changes.length > 0) {
				lines.push("", "**Changes:**");
				for (const change of result.changes) {
					lines.push(`- ${change}`);
				}
			}

			return {
				content: [{ type: "text" as const, text: lines.join("\n") }],
			};
		} catch (error) {
			log({
				cid,
				tool: "para_frontmatter_migrate",
				event: "error",
				error: error instanceof Error ? error.message : String(error),
			});
			const format = parseResponseFormat(response_format);
			return {
				isError: true,
				content: [{ type: "text" as const, text: formatError(error, format) }],
			};
		}
	},
);

// ============================================================================
// Frontmatter Migrate All Tool
// ============================================================================

tool(
	"para_frontmatter_migrate_all",
	{
		description: `Bulk migrate notes by type to latest template version.

Scans directories for notes matching a specific type and migrates them all.

Filters:
- type: Only migrate notes with this frontmatter type
- dir: Limit to specific directories
- force_version: Override target version

Reports:
- Updated count
- Skipped count (already current)
- Errors

Supports dry-run mode.

Requires git repository with clean working tree (unless dry-run).`,
		inputSchema: {
			type: z
				.string()
				.optional()
				.describe('Note type to migrate (e.g., "project", "area")'),
			dir: z
				.string()
				.optional()
				.describe("Directories to scan (comma-separated)"),
			force_version: z
				.number()
				.optional()
				.describe("Force migrate to specific version (default: latest)"),
			dry_run: z
				.boolean()
				.optional()
				.describe("Preview migration without writing (default: false)"),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: false,
			openWorldHint: false,
		},
	},
	async (args: Record<string, unknown>) => {
		const { type, dir, force_version, dry_run, response_format } = args as {
			type?: string;
			dir?: string;
			force_version?: number;
			dry_run?: boolean;
			response_format?: string;
		};
		const cid = createCorrelationId();
		const startTime = Date.now();
		log({
			cid,
			tool: "para_frontmatter_migrate_all",
			event: "request",
			type,
		});

		try {
			const config = loadConfig();
			const dryRun = dry_run ?? false;
			const dirs = parseDirs(dir);
			const result = migrateAllTemplateVersions(config, {
				dir: dirs,
				dryRun,
				forceVersion: force_version,
				type,
				migrate: MIGRATIONS,
			});
			const format = parseResponseFormat(response_format);

			log({
				cid,
				tool: "para_frontmatter_migrate_all",
				event: "response",
				success: true,
				updated: result.updated,
				skipped: result.skipped,
				errors: result.errors,
				durationMs: Date.now() - startTime,
			});

			if (format === ResponseFormat.JSON) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(result, null, 2),
						},
					],
				};
			}

			const verb = dryRun ? "Would migrate" : "Migrated";
			const lines = [
				`## ${verb} Notes`,
				"",
				`**Updated:** ${result.updated}`,
				`**Would update:** ${result.wouldUpdate}`,
				`**Skipped:** ${result.skipped}`,
				`**Errors:** ${result.errors}`,
			];

			if (result.changes.length > 0) {
				lines.push("", "**Changes:**");
				for (const change of result.changes) {
					lines.push(`- ${change.file}: ${change.changes.join(", ")}`);
				}
			}

			return {
				content: [{ type: "text" as const, text: lines.join("\n") }],
			};
		} catch (error) {
			log({
				cid,
				tool: "para_frontmatter_migrate_all",
				event: "error",
				error: error instanceof Error ? error.message : String(error),
			});
			const format = parseResponseFormat(response_format);
			return {
				isError: true,
				content: [{ type: "text" as const, text: formatError(error, format) }],
			};
		}
	},
);

// ============================================================================
// Frontmatter Plan Tool
// ============================================================================

tool(
	"para_frontmatter_plan",
	{
		description: `Plan template version bump for a note type.

Analyzes notes and generates a migration plan showing:
- Outdated notes (template_version < target)
- Missing version field notes
- Current version notes
- Ahead notes (template_version > target)
- Type mismatches

Plan can be saved to JSON and executed via para_frontmatter_apply_plan.

Used for:
- Impact assessment before migrations
- Identifying notes needing manual review
- Generating filtered migration batches`,
		inputSchema: {
			type: z.string().describe('Note type (e.g., "project", "area")'),
			to_version: z.number().describe("Target template version to migrate to"),
			dir: z
				.string()
				.optional()
				.describe("Directories to scan (comma-separated)"),
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
		const { type, to_version, dir, response_format } = args as {
			type: string;
			to_version: number;
			dir?: string;
			response_format?: string;
		};
		const cid = createCorrelationId();
		const startTime = Date.now();
		log({
			cid,
			tool: "para_frontmatter_plan",
			event: "request",
			type,
			to_version,
		});

		try {
			const config = loadConfig();
			const dirs = parseDirs(dir);
			const plan = planTemplateVersionBump(config, {
				type,
				toVersion: to_version,
				dir: dirs,
			});
			const format = parseResponseFormat(response_format);

			log({
				cid,
				tool: "para_frontmatter_plan",
				event: "response",
				success: true,
				outdated: plan.outdated,
				missingVersion: plan.missingVersion,
				durationMs: Date.now() - startTime,
			});

			if (format === ResponseFormat.JSON) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(plan, null, 2),
						},
					],
				};
			}

			const lines = [
				`## Migration Plan: ${type} → v${to_version}`,
				"",
				`**Outdated:** ${plan.outdated}`,
				`**Missing version:** ${plan.missingVersion}`,
				`**Current:** ${plan.current}`,
				`**Ahead:** ${plan.ahead}`,
				`**Type mismatch:** ${plan.typeMismatch}`,
			];

			return {
				content: [{ type: "text" as const, text: lines.join("\n") }],
			};
		} catch (error) {
			log({
				cid,
				tool: "para_frontmatter_plan",
				event: "error",
				error: error instanceof Error ? error.message : String(error),
			});
			const format = parseResponseFormat(response_format);
			return {
				isError: true,
				content: [{ type: "text" as const, text: formatError(error, format) }],
			};
		}
	},
);

// ============================================================================
// Frontmatter Apply Plan Tool
// ============================================================================

tool(
	"para_frontmatter_apply_plan",
	{
		description: `Execute a migration plan from para_frontmatter_plan.

Takes a plan JSON file and migrates matching notes. Supports filtering:
- statuses: Which entry statuses to process (outdated, missing-version, current)
- dirs: Limit to specific directories

Reports:
- Updated count
- Skipped count
- Errors

Plan format:
{
  "type": "project",
  "targetVersion": 2,
  "entries": [...]
}

Supports dry-run mode.

Requires git repository with clean working tree (unless dry-run).`,
		inputSchema: {
			plan_file: z.string().describe("Path to plan JSON file"),
			statuses: z
				.array(z.string())
				.optional()
				.describe(
					'Filter by entry status (default: ["outdated", "missing-version"])',
				),
			dir: z
				.string()
				.optional()
				.describe("Limit to directories (comma-separated)"),
			dry_run: z
				.boolean()
				.optional()
				.describe("Preview migration without writing (default: false)"),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: false,
			openWorldHint: false,
		},
	},
	async (args: Record<string, unknown>) => {
		const { plan_file, statuses, dir, dry_run, response_format } = args as {
			plan_file: string;
			statuses?: string[];
			dir?: string;
			dry_run?: boolean;
			response_format?: string;
		};
		const cid = createCorrelationId();
		const startTime = Date.now();
		log({
			cid,
			tool: "para_frontmatter_apply_plan",
			event: "request",
			plan_file,
		});

		try {
			const config = loadConfig();
			const dryRun = dry_run ?? false;
			const dirs = parseDirs(dir);

			// Load plan file
			const fs = await import("node:fs");
			const planContent = fs.readFileSync(plan_file, "utf8");
			const plan = JSON.parse(planContent);

			if (!plan?.entries || !Array.isArray(plan.entries)) {
				throw new Error("Plan file must contain entries[]");
			}
			if (typeof plan.targetVersion !== "number" || !plan.type) {
				throw new Error("Plan file must include targetVersion and type");
			}

			const result = applyVersionPlan(config, {
				plan,
				dryRun,
				statuses: (statuses ?? [
					"outdated",
					"missing-version",
				]) as VersionPlanStatus[],
				dirs: dirs ?? [],
				migrate: MIGRATIONS,
			});
			const format = parseResponseFormat(response_format);

			log({
				cid,
				tool: "para_frontmatter_apply_plan",
				event: "response",
				success: true,
				updated: result.updated,
				skipped: result.skipped,
				errors: result.errors,
				durationMs: Date.now() - startTime,
			});

			if (format === ResponseFormat.JSON) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(result, null, 2),
						},
					],
				};
			}

			const verb = dryRun ? "Would apply" : "Applied";
			const lines = [
				`## ${verb} Plan: ${plan_file}`,
				"",
				`**Updated:** ${result.updated}`,
				`**Would update:** ${result.wouldUpdate}`,
				`**Skipped:** ${result.skipped}`,
				`**Errors:** ${result.errors}`,
			];

			if (result.changes.length > 0) {
				lines.push("", "**Changes:**");
				for (const change of result.changes) {
					lines.push(`- ${change.file}: ${change.changes.join(", ")}`);
				}
			}

			return {
				content: [{ type: "text" as const, text: lines.join("\n") }],
			};
		} catch (error) {
			log({
				cid,
				tool: "para_frontmatter_apply_plan",
				event: "error",
				error: error instanceof Error ? error.message : String(error),
			});
			const format = parseResponseFormat(response_format);
			return {
				isError: true,
				content: [{ type: "text" as const, text: formatError(error, format) }],
			};
		}
	},
);

// ============================================================================
// Start Server
// ============================================================================

if (import.meta.main) {
	startServer("para-obsidian", {
		version: "0.1.0",
		fileLogging: {
			enabled: true,
			subsystems: ["mcp"],
			level: "info",
		},
	});
}
