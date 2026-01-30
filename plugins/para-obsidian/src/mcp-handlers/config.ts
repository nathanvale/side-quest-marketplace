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

import { randomUUID } from "node:crypto";
import { getLogger } from "@logtape/logtape";
import { tool, z } from "@sidequest/core/mcp";
import {
	createLoggerAdapter,
	ResponseFormat,
	wrapToolHandler,
} from "@sidequest/core/mcp-response";
import {
	DEFAULT_DESTINATIONS,
	DEFAULT_FRONTMATTER_RULES,
	DEFAULT_TEMPLATE_SECTIONS,
	DEFAULT_TITLE_PREFIXES,
} from "../config/defaults";
import { listTemplateVersions, loadConfig } from "../config/index";
import { resolveTemplate } from "../notes/create";
import { getTemplateFields } from "../templates/index";

const logger = createLoggerAdapter(getLogger("para-obsidian.mcp"));
const createCid = () => randomUUID();

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
	wrapToolHandler(
		async (_args, format) => {
			const config = loadConfig();

			if (format === ResponseFormat.JSON) {
				return config; // Auto-formatted as JSON
			}

			// Custom markdown formatting
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

			return lines.join("\n");
		},
		{ toolName: "para_config", logger, createCid },
	),
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
	wrapToolHandler(
		async (_args, format) => {
			const config = loadConfig();
			const templates = listTemplateVersions(config);

			if (format === ResponseFormat.JSON) {
				return { templates }; // Auto-formatted as JSON
			}

			// Custom markdown formatting
			const lines = ["## Template Versions", ""];
			for (const tpl of templates) {
				lines.push(`- **${tpl.name}:** v${tpl.version}`);
			}

			return lines.join("\n");
		},
		{ toolName: "para_templates", logger, createCid },
	),
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
	wrapToolHandler(
		async (args, format) => {
			const config = loadConfig();
			const templateName = args.template as string;
			const template = resolveTemplate(config, templateName);

			if (!template) {
				throw new Error(`Template not found: ${templateName}`);
			}

			const fields = getTemplateFields(template);

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

				// Build creation_meta from defaults
				const creationMeta: {
					dest: string;
					titlePrefix?: string;
					sections?: Array<{ heading: string; hasPrompt: boolean }>;
					bodyConfig?: {
						titleLine?: string;
						preamble?: string;
					};
					contentTargets?: string[];
				} = {
					dest:
						config.defaultDestinations?.[templateName] ??
						DEFAULT_DESTINATIONS[templateName] ??
						"00 Inbox",
				};
				const titlePrefix = DEFAULT_TITLE_PREFIXES[templateName];
				if (titlePrefix) {
					creationMeta.titlePrefix = titlePrefix;
				}
				const templateSections =
					config.templateSections?.[templateName] ??
					DEFAULT_TEMPLATE_SECTIONS[templateName];
				if (templateSections) {
					creationMeta.sections = [...templateSections];
				}

				// Add bodyConfig if template has custom body structure
				const bodyConfig = config.templateBodyConfig?.[templateName];
				if (bodyConfig) {
					creationMeta.bodyConfig = {
						titleLine: bodyConfig.titleLine,
						preamble: bodyConfig.preamble,
					};
				}

				// Compute content targets: sections safe for content injection
				// Exclude sections with static/Dataview content (they have `content` set)
				if (templateSections) {
					const contentTargets = templateSections
						.filter((s) => !s.content)
						.map((s) => s.heading);
					if (contentTargets.length > 0) {
						creationMeta.contentTargets = contentTargets;
					}
				}

				// Build validArgs from frontmatter rules
				const validArgRules =
					config.frontmatterRules?.[templateName] ??
					DEFAULT_FRONTMATTER_RULES[templateName];
				const validArgs = validArgRules?.required
					? Object.keys(validArgRules.required).filter(
							(k) =>
								k !== "created" &&
								k !== "type" &&
								k !== "template_version" &&
								k !== "title",
						)
					: undefined;

				// Return data - wrapper handles formatting
				return {
					template: templateName,
					version: template.version,
					fields: {
						required: enhancedRequired,
						auto: autoFields.map((f) => f.key),
						body: bodyFields.map((f) => f.key),
					},
					frontmatter_hints: frontmatterHints,
					creation_meta: creationMeta,
					validArgs,
					example: Object.fromEntries(
						enhancedRequired.map((f) => [f.key, f.example ?? "..."]),
					),
				};
			}

			// Custom markdown formatting
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

			return lines.join("\n");
		},
		{ toolName: "para_template_fields", logger, createCid },
	),
);
