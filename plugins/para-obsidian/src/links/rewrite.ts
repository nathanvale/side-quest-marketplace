/**
 * Link rewriting utilities.
 *
 * This module provides functionality to replace link targets across the vault
 * without renaming files. Use cases:
 * - Fix broken attachment links after external rename
 * - Update wikilink targets after restructuring
 * - Bulk find/replace for renamed concepts
 *
 * @module rewrite-links
 */
import path from "node:path";
import {
	isDirectorySync,
	isFileSync,
	readDir,
	readTextFileSync,
	writeTextFileSync,
} from "@sidequest/core/fs";

import { parseFrontmatter, serializeFrontmatter } from "../frontmatter/index";

/**
 * A single link rewrite mapping.
 */
export interface RewriteMapping {
	/** Link target to find (without brackets, e.g., "old.pdf" or "Attachments/old.pdf") */
	readonly from: string;
	/** Link target to replace with (without brackets) */
	readonly to: string;
}

/**
 * Result of a rewrite operation.
 */
export interface RewriteResult {
	/** Total links rewritten across all files */
	readonly linksRewritten: number;
	/** Number of notes that were updated */
	readonly notesUpdated: number;
	/** Details per note */
	readonly updates: ReadonlyArray<{
		readonly note: string;
		readonly rewrites: ReadonlyArray<{
			readonly from: string;
			readonly to: string;
			readonly location: "frontmatter" | "body";
			readonly count: number;
		}>;
	}>;
}

/**
 * Options for rewrite operations.
 */
export interface RewriteOptions {
	/** If true, preview changes without writing */
	readonly dryRun?: boolean;
	/** Directories to scope (default: entire vault) */
	readonly dirs?: ReadonlyArray<string>;
}

/**
 * Escapes special regex characters in a string.
 */
function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replaces link targets in body content.
 *
 * Handles:
 * - Wikilinks: [[from]] → [[to]]
 * - With aliases: [[from|alias]] → [[to|alias]]
 * - With headings: [[from#section]] → [[to#section]]
 * - With block refs: [[from^block]] → [[to^block]]
 * - Markdown links: [text](from) → [text](to)
 *
 * @param content - The note body content
 * @param from - Link target to find
 * @param to - Replacement target
 * @returns Updated content and change count
 */
function replaceLinksInBody(
	content: string,
	from: string,
	to: string,
): { content: string; changes: number } {
	const escaped = escapeRegex(from);
	let changes = 0;

	// Match wikilinks with optional alias/heading/block
	// [[from]], [[from|alias]], [[from#heading]], [[from^block]]
	// Also handles combinations: [[from#heading|alias]]
	const wikilinkPattern = new RegExp(
		`\\[\\[${escaped}((?:#[^\\]|]*)?(?:\\^[^\\]|]*)?(?:\\|[^\\]]*)?)?\\]\\]`,
		"gi",
	);

	let updated = content.replace(wikilinkPattern, (_match, suffix) => {
		changes++;
		return `[[${to}${suffix ?? ""}]]`;
	});

	// Match Markdown links: [text](from) or [text](from.md)
	const mdLinkPattern = new RegExp(
		`\\[([^\\]]*)\\]\\(${escaped}(?:\\.md)?\\)`,
		"gi",
	);

	updated = updated.replace(mdLinkPattern, (_match, text) => {
		changes++;
		return `[${text}](${to})`;
	});

	return { content: updated, changes };
}

/**
 * Replaces link targets in a frontmatter value.
 *
 * Handles:
 * - String values: "[[from]]" → "[[to]]"
 * - Array values: ["[[from]]"] → ["[[to]]"]
 *
 * @param value - Frontmatter value (string or array)
 * @param from - Link target to find
 * @param to - Replacement target
 * @returns Updated value and whether any changes were made
 */
function replaceLinksInFrontmatterValue(
	value: unknown,
	from: string,
	to: string,
): { value: unknown; changed: boolean } {
	const escaped = escapeRegex(from);
	// Match [[from]] with optional suffix, allowing for already-present or missing brackets
	const pattern = new RegExp(
		`\\[\\[${escaped}((?:#[^\\]|]*)?(?:\\^[^\\]|]*)?(?:\\|[^\\]]*)?)?\\]\\]`,
		"gi",
	);

	if (typeof value === "string") {
		const updated = value.replace(pattern, (_match, suffix) => {
			return `[[${to}${suffix ?? ""}]]`;
		});
		return { value: updated, changed: updated !== value };
	}

	if (Array.isArray(value)) {
		let anyChanged = false;
		const updatedArray = value.map((item) => {
			if (typeof item === "string") {
				const updated = item.replace(pattern, (_match, suffix) => {
					return `[[${to}${suffix ?? ""}]]`;
				});
				if (updated !== item) anyChanged = true;
				return updated;
			}
			return item;
		});
		return { value: updatedArray, changed: anyChanged };
	}

	return { value, changed: false };
}

/**
 * Recursively lists all Markdown files in a directory.
 */
function listMarkdownFiles(root: string): string[] {
	const results: string[] = [];
	try {
		for (const entry of readDir(root)) {
			if (entry.startsWith(".")) continue;
			const full = path.join(root, entry);
			if (isDirectorySync(full)) {
				results.push(...listMarkdownFiles(full));
			} else if (isFileSync(full) && entry.endsWith(".md")) {
				results.push(full);
			}
		}
	} catch {
		// Skip directories we can't read
	}
	return results;
}

/**
 * Checks if a file path is within any of the specified directories.
 */
function isInDirs(
	filePath: string,
	vault: string,
	dirs?: ReadonlyArray<string>,
): boolean {
	if (!dirs || dirs.length === 0) return true;

	const relative = path.relative(vault, filePath);
	return dirs.some((dir) => {
		const normalizedDir = dir.replace(/\\/g, "/").replace(/\/+$/, "");
		const normalizedPath = relative.replace(/\\/g, "/");
		return (
			normalizedPath === normalizedDir ||
			normalizedPath.startsWith(`${normalizedDir}/`)
		);
	});
}

/**
 * Rewrites link targets across vault notes.
 *
 * Handles both body content and frontmatter:
 * - Wikilinks: [[old]] → [[new]]
 * - With aliases: [[old|alias]] → [[new|alias]]
 * - With headings: [[old#section]] → [[new#section]]
 * - With block refs: [[old^block]] → [[new^block]]
 * - Markdown links: [text](old.md) → [text](new.md)
 * - Frontmatter strings and arrays
 *
 * @param vault - Absolute path to vault root
 * @param mappings - Array of from/to link rewrites
 * @param options - Rewrite options (dryRun, dirs)
 * @returns Rewrite result with counts and details
 *
 * @example
 * ```typescript
 * const result = rewriteLinks(vault, [
 *   { from: "old-attachment.pdf", to: "new-attachment.pdf" },
 *   { from: "Attachments/old.pdf", to: "Attachments/new.pdf" }
 * ], { dryRun: true });
 * console.log(`Would rewrite ${result.linksRewritten} links in ${result.notesUpdated} notes`);
 * ```
 */
export function rewriteLinks(
	vault: string,
	mappings: ReadonlyArray<RewriteMapping>,
	options: RewriteOptions = {},
): RewriteResult {
	const { dryRun = false, dirs } = options;

	if (mappings.length === 0) {
		return { linksRewritten: 0, notesUpdated: 0, updates: [] };
	}

	const updates: Array<{
		note: string;
		rewrites: Array<{
			from: string;
			to: string;
			location: "frontmatter" | "body";
			count: number;
		}>;
	}> = [];

	let totalLinksRewritten = 0;

	// Get all markdown files in vault (or scoped to dirs)
	const files = listMarkdownFiles(vault).filter((f) =>
		isInDirs(f, vault, dirs),
	);

	for (const filePath of files) {
		const noteRewrites: Array<{
			from: string;
			to: string;
			location: "frontmatter" | "body";
			count: number;
		}> = [];

		let content: string;
		try {
			content = readTextFileSync(filePath);
		} catch {
			continue; // Skip files we can't read
		}

		let modified = false;
		let updatedContent = content;

		// Try to parse frontmatter
		let attributes: Record<string, unknown> = {};
		let body = content;
		let hasFrontmatter = false;

		try {
			const parsed = parseFrontmatter(content);
			attributes = { ...parsed.attributes };
			body = parsed.body;
			hasFrontmatter = content.startsWith("---");
		} catch {
			// No valid frontmatter, treat entire content as body
		}

		// Apply each mapping
		for (const { from, to } of mappings) {
			// Rewrite in frontmatter
			if (hasFrontmatter) {
				for (const [key, value] of Object.entries(attributes)) {
					const { value: newValue, changed } = replaceLinksInFrontmatterValue(
						value,
						from,
						to,
					);
					if (changed) {
						attributes[key] = newValue;
						modified = true;
						// Count how many links were replaced (rough estimate)
						const oldStr = JSON.stringify(value);
						const newStr = JSON.stringify(newValue);
						const count =
							(oldStr.match(new RegExp(escapeRegex(from), "gi")) || []).length -
							(newStr.match(new RegExp(escapeRegex(from), "gi")) || []).length;
						if (count > 0) {
							noteRewrites.push({ from, to, location: "frontmatter", count });
							totalLinksRewritten += count;
						}
					}
				}
			}

			// Rewrite in body
			const { content: newBody, changes } = replaceLinksInBody(body, from, to);
			if (changes > 0) {
				body = newBody;
				modified = true;
				noteRewrites.push({ from, to, location: "body", count: changes });
				totalLinksRewritten += changes;
			}
		}

		// Write changes if modified and not dry-run
		if (modified) {
			if (hasFrontmatter) {
				updatedContent = serializeFrontmatter(attributes, body);
			} else {
				updatedContent = body;
			}

			if (!dryRun) {
				writeTextFileSync(filePath, updatedContent);
			}

			updates.push({
				note: path.relative(vault, filePath),
				rewrites: noteRewrites,
			});
		}
	}

	return {
		linksRewritten: totalLinksRewritten,
		notesUpdated: updates.length,
		updates,
	};
}
