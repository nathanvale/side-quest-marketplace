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

import { tool, z } from "@sidequest/core/mcp";
import {
	createCorrelationId,
	log,
	parseResponseFormat,
	ResponseFormat,
	respondError,
	respondText,
} from "../../mcp/utils";
import { loadConfig } from "../config/index";
import { renameWithLinkRewrite } from "../links/index";
import { deleteFile } from "../notes/delete";
import { type InsertMode, insertIntoNote } from "../notes/insert";
import { listDir, readFile } from "../shared/fs";

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
				return respondText(format, JSON.stringify({ dir, entries }, null, 2));
			}

			return respondText(format, `## Files in ${dir}\n\n${entries.join("\n")}`);
		} catch (error) {
			log({
				cid,
				tool: "para_list",
				event: "error",
				error: error instanceof Error ? error.message : String(error),
			});
			const format = parseResponseFormat(response_format);
			return respondError(format, error);
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
				return respondText(format, JSON.stringify({ file, content }, null, 2));
			}

			return respondText(format, content);
		} catch (error) {
			log({
				cid,
				tool: "para_read",
				event: "error",
				error: error instanceof Error ? error.message : String(error),
			});
			const format = parseResponseFormat(response_format);
			return respondError(format, error);
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
	async (args: Record<string, unknown>) => {
		const {
			template,
			title,
			dest,
			args: templateArgs,
			content,
			response_format,
		} = args as {
			template: string;
			title: string;
			dest?: string;
			args?: Record<string, string>;
			content?: Record<string, string>;
			response_format?: string;
		};
		const cid = createCorrelationId();
		const startTime = Date.now();
		log({
			cid,
			tool: "para_create",
			event: "request",
			template,
			title,
			hasContent: !!content,
		});

		try {
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
			const format = parseResponseFormat(response_format);

			log({
				cid,
				tool: "para_create",
				event: "response",
				success: true,
				filePath: result.filePath,
				sectionsInjected: result.sectionsInjected,
				durationMs: Date.now() - startTime,
			});

			if (format === ResponseFormat.JSON) {
				return respondText(format, JSON.stringify(result, null, 2));
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

			return respondText(format, lines.join("\n"));
		} catch (error) {
			log({
				cid,
				tool: "para_create",
				event: "error",
				error: error instanceof Error ? error.message : String(error),
			});
			const format = parseResponseFormat(response_format);
			return respondError(format, error);
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
				return respondText(format, JSON.stringify(result, null, 2));
			}

			return respondText(
				format,
				`## Text Inserted\n\n**File:** ${result.relative}\n**Mode:** ${mode}\n**Heading:** "${heading}"`,
			);
		} catch (error) {
			log({
				cid,
				tool: "para_insert",
				event: "error",
				error: error instanceof Error ? error.message : String(error),
			});
			const format = parseResponseFormat(response_format);
			return respondError(format, error);
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
				return respondText(format, JSON.stringify(result, null, 2));
			}

			const verb = dryRun ? "Would rename" : "Renamed";
			const lines = [
				`## ${verb} File`,
				"",
				`**From:** ${from}`,
				`**To:** ${to}`,
				`**Link rewrites:** ${result.rewrites.length}`,
			];

			return respondText(format, lines.join("\n"));
		} catch (error) {
			log({
				cid,
				tool: "para_rename",
				event: "error",
				error: error instanceof Error ? error.message : String(error),
			});
			const format = parseResponseFormat(response_format);
			return respondError(format, error);
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
				return respondText(format, JSON.stringify(result, null, 2));
			}

			const verb = dryRun ? "Would delete" : "Deleted";
			return respondText(
				format,
				`## ${verb} File\n\n**Path:** ${result.relative}`,
			);
		} catch (error) {
			log({
				cid,
				tool: "para_delete",
				event: "error",
				error: error instanceof Error ? error.message : String(error),
			});
			const format = parseResponseFormat(response_format);
			return respondError(format, error);
		}
	},
);
