/**
 * Para-Obsidian MCP Tools: Frontmatter
 *
 * Frontmatter extraction, validation, and migration tools.
 */

import { randomUUID } from "node:crypto";
import { getLogger } from "@logtape/logtape";
import { tool, z } from "@side-quest/core/mcp";
import {
	createLoggerAdapter,
	ResponseFormat,
	wrapToolHandler,
} from "@side-quest/core/mcp-response";
import {
	coerceValue,
	computeFrontmatterHint,
	formatFrontmatterHint,
	parseDirs,
} from "../../mcp/utils";
import { loadConfig } from "../config/index";
import {
	applyVersionPlan,
	migrateAllTemplateVersions,
	migrateTemplateVersion,
	planTemplateVersionBump,
	readFrontmatterFile,
	updateFrontmatterFile,
	type VersionPlanStatus,
	validateFrontmatterFile,
} from "../frontmatter/index";
import { ensureGitGuard } from "../git/index";
import { MIGRATIONS } from "../templates/migrations";

const logger = createLoggerAdapter(getLogger("para-obsidian.mcp"));
const createCid = () => randomUUID();

// ============================================================================
// Frontmatter Get Tool
// ============================================================================

tool(
	"para_fm_get",
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
	wrapToolHandler(
		async (args, format) => {
			const { file } = args as { file: string };
			const config = loadConfig();
			const { attributes } = readFrontmatterFile(config, file);

			if (format === ResponseFormat.JSON) {
				return { file, frontmatter: attributes };
			}

			return `## Frontmatter: ${file}\n\n\`\`\`yaml\n${JSON.stringify(attributes, null, 2)}\n\`\`\``;
		},
		{ toolName: "para_fm_get", logger, createCid },
	),
);

// ============================================================================
// Frontmatter Validate Tool
// ============================================================================

tool(
	"para_fm_validate",
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
	wrapToolHandler(
		async (args, format) => {
			const { file } = args as { file: string };
			const config = loadConfig();
			const result = validateFrontmatterFile(config, file);

			if (format === ResponseFormat.JSON) {
				return {
					file: result.relative,
					valid: result.valid,
					issues: result.issues,
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

			return lines.join("\n");
		},
		{ toolName: "para_fm_validate", logger, createCid },
	),
);

// ============================================================================
// Frontmatter Set Tool
// ============================================================================

tool(
	"para_fm_set",
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
	wrapToolHandler(
		async (args, format) => {
			const { file, set, unset, dry_run } = args as {
				file: string;
				set?: Record<string, string>;
				unset?: string[];
				dry_run?: boolean;
			};
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

			// Ensure git is clean before writing (unless dry-run)
			if (!dryRun) {
				await ensureGitGuard(config);
			}

			const result = updateFrontmatterFile(config, file, {
				set: typedSet,
				unset: unset ?? [],
				dryRun,
				preWriteFilter: { config, noteType },
			});

			if (format === ResponseFormat.JSON) {
				return result;
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

			// Report skipped fields from pre-write filtering
			if (result.filtered && !result.filtered.allAccepted) {
				lines.push("", "**Skipped fields:**");
				for (const s of result.filtered.skippedUnknown) {
					lines.push(`- ${s.field}: unknown (${s.reason})`);
				}
				for (const s of result.filtered.skippedInvalid) {
					lines.push(`- ${s.field}: invalid (${s.reason})`);
				}
				for (const s of result.filtered.skippedForbidden) {
					lines.push(`- ${s.field}: forbidden (${s.reason})`);
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

			return lines.join("\n");
		},
		{ toolName: "para_fm_set", logger, createCid },
	),
);

// ============================================================================
// Frontmatter Migrate Tool
// ============================================================================

tool(
	"para_fm_migrate",
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
	wrapToolHandler(
		async (args, format) => {
			const { file, force_version, dry_run } = args as {
				file: string;
				force_version?: number;
				dry_run?: boolean;
			};
			const config = loadConfig();
			const dryRun = dry_run ?? false;
			const result = migrateTemplateVersion(config, file, {
				forceVersion: force_version,
				dryRun,
				migrate: MIGRATIONS,
			});

			if (format === ResponseFormat.JSON) {
				return result;
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

			return lines.join("\n");
		},
		{ toolName: "para_fm_migrate", logger, createCid },
	),
);

// ============================================================================
// Frontmatter Migrate All Tool
// ============================================================================

tool(
	"para_fm_migrate_all",
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
	wrapToolHandler(
		async (args, format) => {
			const { type, dir, force_version, dry_run } = args as {
				type?: string;
				dir?: string;
				force_version?: number;
				dry_run?: boolean;
			};
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

			if (format === ResponseFormat.JSON) {
				return result;
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

			return lines.join("\n");
		},
		{ toolName: "para_fm_migrate_all", logger, createCid },
	),
);

// ============================================================================
// Frontmatter Plan Tool
// ============================================================================

tool(
	"para_fm_plan",
	{
		description: `Plan template version bump for a note type.

Analyzes notes and generates a migration plan showing:
- Outdated notes (template_version < target)
- Missing version field notes
- Current version notes
- Ahead notes (template_version > target)
- Type mismatches

Plan can be saved to JSON and executed via para_fm_apply_plan.

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
	wrapToolHandler(
		async (args, format) => {
			const { type, to_version, dir } = args as {
				type: string;
				to_version: number;
				dir?: string;
			};
			const config = loadConfig();
			const dirs = parseDirs(dir);
			const plan = planTemplateVersionBump(config, {
				type,
				toVersion: to_version,
				dir: dirs,
			});

			if (format === ResponseFormat.JSON) {
				return plan;
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

			return lines.join("\n");
		},
		{ toolName: "para_fm_plan", logger, createCid },
	),
);

// ============================================================================
// Frontmatter Apply Plan Tool
// ============================================================================

tool(
	"para_fm_apply_plan",
	{
		description: `Execute a migration plan from para_fm_plan.

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
	wrapToolHandler(
		async (args, format) => {
			const { plan_file, statuses, dir, dry_run } = args as {
				plan_file: string;
				statuses?: string[];
				dir?: string;
				dry_run?: boolean;
			};
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

			if (format === ResponseFormat.JSON) {
				return result;
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

			return lines.join("\n");
		},
		{ toolName: "para_fm_apply_plan", logger, createCid },
	),
);
