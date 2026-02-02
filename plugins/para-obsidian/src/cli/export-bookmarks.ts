/**
 * Export bookmarks CLI command handler.
 *
 * Queries notes with type:bookmark frontmatter, groups by PARA category,
 * and generates Netscape Bookmark File Format 1 HTML for browser import.
 *
 * @module cli/export-bookmarks
 */

import path from "node:path";
import { pathExistsSync, writeTextFileSync } from "@side-quest/core/fs";
import { color } from "@side-quest/core/terminal";
import { getErrorMessage } from "@side-quest/core/utils";
import { buildIndex } from "../search/indexer";
import type { CommandContext, CommandResult } from "./types";

/**
 * Bookmark entry for export.
 */
interface BookmarkEntry {
	readonly title: string;
	readonly url: string;
	readonly addDate: number;
	readonly para: string;
}

/**
 * Generates Netscape Bookmark File Format 1 HTML.
 *
 * @param bookmarks - Bookmarks grouped by PARA category
 * @returns HTML string in Netscape format
 *
 * @example
 * ```typescript
 * const html = generateNetscapeHtml({
 *   Projects: [{ title: "GitHub", url: "https://github.com", addDate: 1234567890, para: "projects" }]
 * });
 * ```
 */
function generateNetscapeHtml(
	bookmarks: Record<string, BookmarkEntry[]>,
): string {
	const lines: string[] = [
		"<!DOCTYPE NETSCAPE-Bookmark-file-1>",
		"<!-- This is an automatically generated file.",
		"     It will be read and overwritten.",
		"     DO NOT EDIT! -->",
		'<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
		"<TITLE>Bookmarks</TITLE>",
		"<H1>Bookmarks</H1>",
		"<DL><p>",
	];

	// Sort categories by PARA order
	const categoryOrder = ["Projects", "Areas", "Resources", "Archives"];
	const sortedCategories = categoryOrder.filter(
		(cat) => bookmarks[cat]?.length,
	);

	for (const category of sortedCategories) {
		const entries = bookmarks[category];
		if (!entries?.length) continue;

		lines.push(`    <DT><H3>${category}</H3>`);
		lines.push("    <DL><p>");

		// Sort bookmarks by title within category
		const sorted = [...entries].sort((a, b) => a.title.localeCompare(b.title));

		for (const entry of sorted) {
			lines.push(
				`        <DT><A HREF="${escapeHtml(entry.url)}" ADD_DATE="${entry.addDate}">${escapeHtml(entry.title)}</A>`,
			);
		}

		lines.push("    </DL><p>");
	}

	lines.push("</DL><p>");
	return lines.join("\n");
}

/**
 * Escapes HTML special characters.
 *
 * @param str - String to escape
 * @returns Escaped string
 */
function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

/**
 * Resolves output path, expanding ~ and ensuring parent directory exists.
 *
 * @param outputPath - Path to resolve
 * @returns Absolute path
 * @throws Error if parent directory doesn't exist
 */
export function resolveOutputPath(outputPath: string): string {
	// Expand ~ to home directory
	const expanded = outputPath.startsWith("~/")
		? path.join(process.env.HOME ?? "", outputPath.slice(2))
		: outputPath;

	const absolute = path.isAbsolute(expanded)
		? expanded
		: path.join(process.cwd(), expanded);

	const parentDir = path.dirname(absolute);
	if (!pathExistsSync(parentDir)) {
		throw new Error(`Parent directory does not exist: ${parentDir}`);
	}

	return absolute;
}

/**
 * Converts frontmatter para value to category name.
 *
 * @param paraValue - Value from frontmatter (e.g., "projects", "01 Projects")
 * @returns Standardized category name
 */
function normalizeParaCategory(paraValue: unknown): string {
	if (typeof paraValue !== "string") return "Resources"; // Default category

	const lower = paraValue.toLowerCase();
	if (lower.includes("project")) return "Projects";
	if (lower.includes("area")) return "Areas";
	if (lower.includes("resource")) return "Resources";
	if (lower.includes("archive")) return "Archives";

	return "Resources"; // Default fallback
}

/**
 * Exports bookmarks to Netscape HTML format.
 *
 * @param ctx - Command context
 * @returns Command result with success status
 *
 * @example
 * ```typescript
 * const result = await handleExportBookmarks(ctx);
 * if (!result.success) {
 *   console.error(result.message);
 * }
 * ```
 */
export async function handleExportBookmarks(
	ctx: CommandContext,
): Promise<CommandResult> {
	try {
		const { config, flags, isJson } = ctx;

		// Parse flags
		const filterStr =
			typeof flags.filter === "string" ? flags.filter : "type:bookmark";
		const outputPath =
			typeof flags.out === "string" ? flags.out : "bookmarks.html";

		// Validate filter format (must be type:bookmark or include it)
		if (!filterStr.includes("type:bookmark")) {
			const msg = "Filter must include 'type:bookmark'";
			if (isJson) {
				console.log(JSON.stringify({ success: false, error: msg }, null, 2));
			} else {
				console.error(color("red", msg));
			}
			return { success: false, error: msg, exitCode: 1 };
		}

		// Parse filter string (format: "key:value,key:value")
		const filters: Record<string, string> = {};
		for (const part of filterStr.split(",")) {
			const [key, ...rest] = part.split(":");
			if (key && rest.length > 0) {
				const value = rest.join(":").trim();
				filters[key.trim()] = value;
			}
		}

		// Build index to query frontmatter
		const index = buildIndex(config);

		// Filter entries by all frontmatter criteria
		const bookmarkEntries = index.entries.filter((entry) => {
			for (const [key, value] of Object.entries(filters)) {
				const entryValue = entry.frontmatter[key];
				// String comparison (case-insensitive for strings)
				if (typeof entryValue === "string" && typeof value === "string") {
					if (entryValue.toLowerCase() !== value.toLowerCase()) {
						return false;
					}
				}
				// Exact comparison for other types
				else if (entryValue !== value) {
					return false;
				}
			}
			return true;
		});

		if (bookmarkEntries.length === 0) {
			const msg = "No bookmarks found with type:bookmark frontmatter";
			if (isJson) {
				console.log(
					JSON.stringify(
						{ success: true, count: 0, output_path: null },
						null,
						2,
					),
				);
			} else {
				console.log(color("yellow", msg));
			}
			return { success: true };
		}

		// Extract bookmark data
		const bookmarks: BookmarkEntry[] = [];
		for (const entry of bookmarkEntries) {
			const url = entry.frontmatter.url;
			const title = entry.frontmatter.title ?? path.basename(entry.file, ".md");
			const para = entry.frontmatter.para ?? "resources";

			if (typeof url !== "string" || !url) {
				console.warn(
					color(
						"yellow",
						`Skipping ${entry.file}: missing or invalid url field`,
					),
				);
				continue;
			}

			// Use clipped timestamp (when bookmark was captured), fallback to created, then current time
			// Defense-in-depth: validate timestamp to prevent NaN in browser import
			const clippedStr = entry.frontmatter.clipped;
			const createdStr = entry.frontmatter.created;
			const fallbackTimestamp = Math.floor(Date.now() / 1000);
			let addDate = fallbackTimestamp;

			// Try clipped first (primary for bookmarks)
			if (typeof clippedStr === "string") {
				const timestamp = new Date(clippedStr).getTime();
				if (!Number.isNaN(timestamp)) {
					addDate = Math.floor(timestamp / 1000);
				}
			}
			// Fallback to created if clipped is missing/invalid
			else if (typeof createdStr === "string") {
				const timestamp = new Date(createdStr).getTime();
				if (!Number.isNaN(timestamp)) {
					addDate = Math.floor(timestamp / 1000);
				}
			}

			bookmarks.push({
				title: typeof title === "string" ? title : String(title),
				url,
				addDate,
				para: typeof para === "string" ? para : "resources",
			});
		}

		// Group by PARA category
		const grouped: Record<string, BookmarkEntry[]> = {
			Projects: [],
			Areas: [],
			Resources: [],
			Archives: [],
		};

		for (const bookmark of bookmarks) {
			const category = normalizeParaCategory(bookmark.para);
			grouped[category]?.push(bookmark);
		}

		// Generate HTML
		const html = generateNetscapeHtml(grouped);

		// Resolve and write output file
		const resolvedPath = resolveOutputPath(outputPath);
		writeTextFileSync(resolvedPath, html);

		const msg = `Exported ${bookmarks.length} bookmarks to ${resolvedPath}`;
		if (isJson) {
			console.log(
				JSON.stringify(
					{
						success: true,
						count: bookmarks.length,
						output_path: resolvedPath,
						categories: Object.fromEntries(
							Object.entries(grouped).map(([k, v]) => [k, v.length]),
						),
					},
					null,
					2,
				),
			);
		} else {
			console.log(color("green", msg));
			console.log(color("dim", `  Categories:`));
			for (const [category, entries] of Object.entries(grouped)) {
				if (entries.length > 0) {
					console.log(color("dim", `    ${category}: ${entries.length}`));
				}
			}
		}

		return { success: true };
	} catch (error) {
		const msg = `Failed to export bookmarks: ${getErrorMessage(error)}`;
		if (ctx.isJson) {
			console.log(JSON.stringify({ success: false, error: msg }, null, 2));
		} else {
			console.error(color("red", msg));
		}
		return { success: false, error: msg, exitCode: 1 };
	}
}
