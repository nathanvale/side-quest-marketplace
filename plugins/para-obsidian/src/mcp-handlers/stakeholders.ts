/**
 * Stakeholder management tools for Para-Obsidian MCP server.
 *
 * Tools:
 * - para_stakeholder_list: List all configured stakeholders
 * - para_stakeholder_add: Add or update stakeholders (deduplicates by name)
 * - para_stakeholder_remove: Remove a stakeholder by name or alias
 * - para_stakeholder_lookup: Fuzzy lookup by name, alias, or email prefix
 *
 * @module mcp/tools/stakeholders
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
	loadConfig,
	type Stakeholder,
	saveStakeholders,
} from "../config/index";

const logger = createLoggerAdapter(getLogger("para-obsidian.mcp"));
const createCid = () => randomUUID();

// ============================================================================
// List Tool
// ============================================================================

tool(
	"para_stakeholder_list",
	{
		description: `List all configured stakeholders.

Returns stakeholders with name, role, company, squad, project, alias, and email.
Stakeholders are used for voice memo speaker matching, meeting classification,
and project inference.`,
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
			const stakeholders = config.stakeholders ?? [];

			if (format === ResponseFormat.JSON) {
				return { stakeholders, count: stakeholders.length };
			}

			if (stakeholders.length === 0) {
				return "No stakeholders configured. Use `para_stakeholder_add` to add some.";
			}

			const lines = [`## Stakeholders (${stakeholders.length})`, ""];
			for (const s of stakeholders) {
				const parts = [s.name];
				if (s.alias) parts.push(`aka ${s.alias}`);
				if (s.role) parts.push(`(${s.role})`);
				const context: string[] = [];
				if (s.company) context.push(s.company);
				if (s.squad) context.push(s.squad);
				if (context.length > 0) parts.push(`- ${context.join("/")}`);
				lines.push(`- ${parts.join(" ")}`);
			}

			return lines.join("\n");
		},
		{ toolName: "para_stakeholder_list", logger, createCid },
	),
);

// ============================================================================
// Add Tool
// ============================================================================

const StakeholderSchema = z.object({
	name: z.string().describe("Full name (required)"),
	email: z.string().optional().describe("Email address"),
	role: z.string().optional().describe("Role or job title"),
	company: z.string().optional().describe("Company or organization"),
	squad: z.string().optional().describe("Squad or team name"),
	project: z.string().optional().describe("Related project wikilink"),
	alias: z.string().optional().describe("Nickname or alias"),
});

tool(
	"para_stakeholder_add",
	{
		description: `Add or update stakeholders.

Accepts an array of stakeholder objects. Deduplicates by name: if a stakeholder
with the same name already exists (case-insensitive), it is updated with the
new fields. Otherwise a new entry is created.

Required field: name. Optional: email, role, company, squad, project, alias.`,
		inputSchema: {
			stakeholders: z
				.array(StakeholderSchema)
				.describe("Array of stakeholder objects to add"),
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
			const incoming = args.stakeholders as Stakeholder[];

			if (!incoming || incoming.length === 0) {
				throw new Error("At least one stakeholder is required.");
			}

			const config = loadConfig();
			const existing = [...(config.stakeholders ?? [])];

			let added = 0;
			let updated = 0;

			for (const s of incoming) {
				const idx = existing.findIndex(
					(e) => e.name.toLowerCase() === s.name.toLowerCase(),
				);
				if (idx >= 0) {
					// Update existing: merge new fields over old
					existing[idx] = { ...existing[idx], ...s };
					updated++;
				} else {
					existing.push(s);
					added++;
				}
			}

			await saveStakeholders(existing);

			const result = {
				added,
				updated,
				total: existing.length,
			};

			if (format === ResponseFormat.JSON) {
				return result;
			}

			const parts: string[] = [];
			if (added > 0) parts.push(`${added} added`);
			if (updated > 0) parts.push(`${updated} updated`);
			return `Stakeholders saved: ${parts.join(", ")}. Total: ${existing.length}.`;
		},
		{ toolName: "para_stakeholder_add", logger, createCid },
	),
);

// ============================================================================
// Remove Tool
// ============================================================================

tool(
	"para_stakeholder_remove",
	{
		description: `Remove a stakeholder by name or alias.

Case-insensitive match on either the name or alias field.
Returns confirmation or error if not found.`,
		inputSchema: {
			name: z.string().describe("Name or alias of stakeholder to remove"),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: false,
			destructiveHint: true,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	wrapToolHandler(
		async (args, format) => {
			const query = (args.name as string).toLowerCase();
			const config = loadConfig();
			const existing = [...(config.stakeholders ?? [])];

			const idx = existing.findIndex(
				(s) =>
					s.name.toLowerCase() === query ||
					(s.alias && s.alias.toLowerCase() === query),
			);

			if (idx === -1) {
				throw new Error(
					`Stakeholder not found: "${args.name}". Use para_stakeholder_list to see all stakeholders.`,
				);
			}

			const removedName = existing[idx]?.name ?? args.name;
			existing.splice(idx, 1);
			await saveStakeholders(existing);

			const result = {
				removed: removedName,
				remaining: existing.length,
			};

			if (format === ResponseFormat.JSON) {
				return result;
			}

			return `Removed "${removedName}". ${existing.length} stakeholders remaining.`;
		},
		{ toolName: "para_stakeholder_remove", logger, createCid },
	),
);

// ============================================================================
// Lookup Tool
// ============================================================================

tool(
	"para_stakeholder_lookup",
	{
		description: `Look up stakeholders by name, alias, or email prefix.

Fuzzy match: returns stakeholders where the query matches (case-insensitive)
any part of their name, alias, or email prefix (before @).
Useful for "who is MJ?" or "find June".`,
		inputSchema: {
			query: z.string().describe("Search query (name, alias, or email prefix)"),
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
			const query = (args.query as string).toLowerCase();
			const config = loadConfig();
			const stakeholders = config.stakeholders ?? [];

			const matches = stakeholders.filter((s) => {
				if (s.name.toLowerCase().includes(query)) return true;
				if (s.alias && s.alias.toLowerCase().includes(query)) return true;
				if (s.email) {
					const prefix = s.email.split("@")[0]?.toLowerCase() ?? "";
					if (prefix.includes(query)) return true;
				}
				return false;
			});

			if (format === ResponseFormat.JSON) {
				return { matches, count: matches.length };
			}

			if (matches.length === 0) {
				return `No stakeholders matching "${args.query}".`;
			}

			const lines = [`## Matches for "${args.query}" (${matches.length})`, ""];
			for (const s of matches) {
				const parts = [`**${s.name}**`];
				if (s.alias) parts.push(`aka ${s.alias}`);
				if (s.role) parts.push(`(${s.role})`);
				const details: string[] = [];
				if (s.email) details.push(s.email);
				if (s.company) details.push(s.company);
				if (s.squad) details.push(s.squad);
				if (s.project) details.push(s.project);
				if (details.length > 0) parts.push(`- ${details.join(", ")}`);
				lines.push(`- ${parts.join(" ")}`);
			}

			return lines.join("\n");
		},
		{ toolName: "para_stakeholder_lookup", logger, createCid },
	),
);
