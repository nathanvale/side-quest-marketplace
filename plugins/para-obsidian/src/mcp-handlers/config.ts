/**
 * Configuration and template tools for Para-Obsidian MCP server.
 *
 * Tools:
 * - para_config: Load resolved configuration
 * - para_templates: List configured template versions
 * - para_template_fields: Inspect template fields
 *
 * @module mcp/tools/config
 */

import { tool, z } from "@sidequest/core/mcp";
import {
	createCorrelationId,
	log,
	parseResponseFormat,
	ResponseFormat,
	respondError,
	respondText,
} from "../../mcp/utils";
import { listTemplateVersions, loadConfig } from "../config";
import { getTemplate, getTemplateFields } from "../templates";

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
				return respondText(format, JSON.stringify(config, null, 2));
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

			return respondText(format, lines.join("\n"));
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
			return respondError(format, error);
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
				return respondText(format, JSON.stringify({ templates }, null, 2));
			}

			const lines = ["## Template Versions", ""];
			for (const tpl of templates) {
				lines.push(`- **${tpl.name}:** v${tpl.version}`);
			}

			return respondText(format, lines.join("\n"));
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
			return respondError(format, error);
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

					// Check if template already wraps this prompt in wikilinks
					const promptPattern = `<% tp.system.prompt("${f.key}") %>`;
					const isWrappedInWikilinks = template.content.includes(
						`[[${promptPattern}]]`,
					);

					// Infer type and example from key name
					if (f.key.toLowerCase().includes("date")) {
						result.type = "date";
						result.example = new Date().toISOString().split("T")[0];
					} else if (
						f.key.toLowerCase().includes("area") ||
						f.key.toLowerCase().includes("project")
					) {
						result.type = "wikilink";
						// If template already has [[ ]], provide just the name
						result.example = isWrappedInWikilinks
							? "Note Name"
							: "[[Note Name]]";
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

				return respondText(
					format,
					JSON.stringify(
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
				);
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

			return respondText(format, lines.join("\n"));
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
			return respondError(format, error);
		}
	},
);
