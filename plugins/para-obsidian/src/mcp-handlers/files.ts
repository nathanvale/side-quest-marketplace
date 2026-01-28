/**
 * File operation tools for Para-Obsidian MCP server.
 *
 * Tools:
 * - para_list: List files and directories
 * - para_read: Read file contents
 * - para_create: Create note from template
 * - para_insert: Insert content under heading
 * - para_rename: Rename with link rewriting
 * - para_delete: Delete file with confirmation
 *
 * @module mcp/tools/files
 */

import { randomUUID } from "node:crypto";
import { getLogger } from "@logtape/logtape";
import { tool, z } from "@sidequest/core/mcp";
import {
	createLoggerAdapter,
	ResponseFormat,
	wrapToolHandler,
} from "@sidequest/core/mcp-response";
import { loadConfig } from "../config/index";
import { renameWithLinkRewrite } from "../links/index";
import { deleteFile } from "../notes/delete";
import {
	type InsertMode,
	insertIntoNote,
	replaceSectionContent,
} from "../notes/insert";
import { listDir, readFile } from "../shared/fs";

const logger = createLoggerAdapter(getLogger("para-obsidian.mcp"));
const createCid = () => randomUUID();

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
	wrapToolHandler(
		async (args, format) => {
			const { path } = args as { path?: string };
			const config = loadConfig();
			const dir = path ?? ".";
			const entries = listDir(config.vault, dir);

			if (format === ResponseFormat.JSON) {
				return { dir, entries };
			}

			return `## Files in ${dir}\n\n${entries.join("\n")}`;
		},
		{ toolName: "para_list", logger, createCid },
	),
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
	wrapToolHandler(
		async (args, format) => {
			const { file } = args as { file: string };
			const config = loadConfig();
			const content = readFile(config.vault, file);

			if (format === ResponseFormat.JSON) {
				return { file, content };
			}

			return content;
		},
		{ toolName: "para_read", logger, createCid },
	),
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

Template files expected at vault/Templates/{template}.md (configurable via PARA_TEMPLATES_DIR)

Filename: Title Case with spaces (e.g., "My Project Note.md")

Optionally injects content into template sections (headings) in a single operation.

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
			content: z
				.record(z.string())
				.optional()
				.describe(
					'Content to inject into template sections (heading → body mapping, e.g., {"Why This Matters": "This project addresses..."})',
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
	wrapToolHandler(
		async (args, format) => {
			const {
				template,
				title,
				dest,
				args: templateArgs,
				content,
			} = args as {
				template: string;
				title: string;
				dest?: string;
				args?: Record<string, string>;
				content?: Record<string, string>;
			};

			// Build CLI args - MCP is thin wrapper, CLI does heavy lifting
			const cliArgs = [
				"create",
				"--template",
				template,
				"--title",
				title,
				"--format",
				"json",
			];

			if (dest) {
				cliArgs.push("--dest", dest);
			}

			if (templateArgs) {
				for (const [key, value] of Object.entries(templateArgs)) {
					cliArgs.push("--arg", `${key}=${value}`);
				}
			}

			if (content) {
				cliArgs.push("--content", JSON.stringify(content));
			}

			// Call CLI via subprocess
			const cliPath = new URL("../../src/cli.ts", import.meta.url).pathname;
			const proc = Bun.spawn(["bun", "run", cliPath, ...cliArgs], {
				stdout: "pipe",
				stderr: "pipe",
			});

			const stdout = await new Response(proc.stdout).text();
			const stderr = await new Response(proc.stderr).text();
			const exitCode = await proc.exited;

			if (exitCode !== 0) {
				throw new Error(stderr.trim() || `CLI exited with code ${exitCode}`);
			}

			const result = JSON.parse(stdout);

			if (format === ResponseFormat.JSON) {
				return result;
			}

			// Format markdown output
			const lines = ["## Note Created", "", `**File:** ${result.filePath}`];
			if (result.sectionsInjected !== undefined) {
				lines.push(`**Sections injected:** ${result.sectionsInjected}`);
				if (result.injectedHeadings?.length > 0) {
					lines.push(`**Headings:** ${result.injectedHeadings.join(", ")}`);
				}
				if (result.sectionsSkipped?.length > 0) {
					lines.push(
						`**Skipped:** ${result.sectionsSkipped.map((s: { heading: string }) => s.heading).join(", ")}`,
					);
				}
			}

			return lines.join("\n");
		},
		{ toolName: "para_create", logger, createCid },
	),
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
			heading: z
				.string()
				.describe(
					'Heading to insert near. Accepts with or without # prefix (e.g., "Tasks" or "## Tasks")',
				),
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
	wrapToolHandler(
		async (args, format) => {
			const { file, heading, content, mode } = args as {
				file: string;
				heading: string;
				content: string;
				mode: InsertMode;
			};
			const config = loadConfig();
			const result = insertIntoNote(config, { file, heading, content, mode });

			if (format === ResponseFormat.JSON) {
				return result;
			}

			return `## Text Inserted\n\n**File:** ${result.relative}\n**Mode:** ${mode}\n**Heading:** "${heading}"`;
		},
		{ toolName: "para_insert", logger, createCid },
	),
);

// ============================================================================
// Replace Section Tool
// ============================================================================

tool(
	"para_replace_section",
	{
		description: `Replace all content under a heading.

Unlike para_insert which appends/prepends, this completely replaces
the section content between a heading and the next heading of equal
or higher level.

Use for: updating dataview queries, replacing AI-generated content,
rewriting entire sections.

Preserves the heading itself - only content below it is replaced.

Requires git repository with clean working tree (unless dry-run).`,
		inputSchema: {
			file: z.string().describe('File path (e.g., "Projects/My Note.md")'),
			heading: z
				.string()
				.describe(
					'Heading to target. Accepts with or without # prefix (e.g., "Tasks" or "## Tasks")',
				),
			content: z.string().describe("New content to replace the section with"),
			preserve_comments: z
				.boolean()
				.optional()
				.describe("Keep HTML comments in section (default: false)"),
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
			destructiveHint: true,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	wrapToolHandler(
		async (args, format) => {
			const { file, heading, content, preserve_comments, dry_run } = args as {
				file: string;
				heading: string;
				content: string;
				preserve_comments?: boolean;
				dry_run?: boolean;
			};
			const config = loadConfig();
			const dryRun = dry_run ?? false;

			// For dry-run, we still call the function but don't write
			// TODO: Add proper dry-run support to replaceSectionContent
			if (dryRun) {
				// Just validate that file and heading exist
				const { readFile } = await import("../shared/fs");
				const fileContent = readFile(config.vault, file);
				const headingPattern = new RegExp(
					`^#+\\s+${heading.replace(/^#+\s*/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
					"m",
				);
				if (!headingPattern.test(fileContent)) {
					throw new Error(`Heading not found: ${heading}`);
				}
				return format === ResponseFormat.JSON
					? {
							relative: file,
							dryRun: true,
							wouldReplace: heading,
						}
					: `## Dry Run\n\n**File:** ${file}\n**Would replace section:** "${heading}"`;
			}

			const result = replaceSectionContent(config, {
				file,
				heading,
				content,
				preserveComments: preserve_comments,
			});

			if (format === ResponseFormat.JSON) {
				return result;
			}

			return `## Section Replaced\n\n**File:** ${result.relative}\n**Heading:** "${heading}"\n**Lines removed:** ${result.linesRemoved}\n**Lines added:** ${result.linesAdded}`;
		},
		{ toolName: "para_replace_section", logger, createCid },
	),
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
	wrapToolHandler(
		async (args, format) => {
			const { from, to, dry_run } = args as {
				from: string;
				to: string;
				dry_run?: boolean;
			};
			const config = loadConfig();
			const dryRun = dry_run ?? false;
			const result = renameWithLinkRewrite(config, { from, to, dryRun });

			if (format === ResponseFormat.JSON) {
				return result;
			}

			const verb = dryRun ? "Would rename" : "Renamed";
			const lines = [
				`## ${verb} File`,
				"",
				`**From:** ${from}`,
				`**To:** ${to}`,
				`**Link rewrites:** ${result.rewrites.length}`,
			];

			return lines.join("\n");
		},
		{ toolName: "para_rename", logger, createCid },
	),
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
	wrapToolHandler(
		async (args, format) => {
			const { file, confirm, dry_run } = args as {
				file: string;
				confirm: boolean;
				dry_run?: boolean;
			};
			const config = loadConfig();
			const dryRun = dry_run ?? false;
			const result = deleteFile(config, { file, confirm, dryRun });

			if (format === ResponseFormat.JSON) {
				return result;
			}

			const verb = dryRun ? "Would delete" : "Deleted";
			return `## ${verb} File\n\n**Path:** ${result.relative}`;
		},
		{ toolName: "para_delete", logger, createCid },
	),
);
