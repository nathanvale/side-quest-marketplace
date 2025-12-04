/**
 * Content insertion into notes.
 *
 * This module provides functionality to insert content into existing
 * notes at specific locations relative to headings. Supports multiple
 * insertion modes for flexible content placement.
 *
 * @module insert
 */
import fs from "node:fs";

import type { ParaObsidianConfig } from "./config";
import { resolveVaultPath } from "./fs";

/**
 * Insertion mode relative to a heading's content.
 *
 * - "append": Insert at the end of the section's content
 * - "prepend": Insert at the start of the section's content
 * - "before": Insert before the heading line itself
 * - "after": Insert immediately after the heading line
 */
export type InsertMode = "append" | "prepend" | "before" | "after";

/**
 * Options for inserting content into a note.
 */
export interface InsertOptions {
	/** Path to the file (relative to vault). */
	readonly file: string;
	/** Heading text to locate (without # prefix). */
	readonly heading: string;
	/** Content to insert. */
	readonly content: string;
	/** Where to insert relative to the heading. */
	readonly mode: InsertMode;
}

/** Internal representation of a found heading. */
interface HeadingMatch {
	/** Line index (0-based) where heading was found. */
	readonly index: number;
	/** Heading level (number of # characters). */
	readonly level: number;
}

/**
 * Normalizes line endings and splits into array.
 * Handles both Unix (LF) and Windows (CRLF) line endings.
 */
function normalizeLines(text: string): string[] {
	const normalized = text.replace(/\r\n/g, "\n");
	return normalized.split("\n");
}

/**
 * Finds a heading by its title text.
 *
 * @param lines - Array of document lines
 * @param heading - Heading title to find (without # prefix)
 * @returns Heading match with index and level, or undefined if not found
 */
function findHeading(
	lines: ReadonlyArray<string>,
	heading: string,
): HeadingMatch | undefined {
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line === undefined) continue;
		// Match heading pattern: one or more # followed by space and title
		const match = /^(#+)\s+(.*)$/.exec(line.trim());
		if (!match) continue;
		const hashes = match[1];
		const title = match[2];
		if (!hashes || !title) continue;
		if (title.trim() === heading.trim()) {
			return { index: i, level: hashes.length };
		}
	}
	return undefined;
}

/**
 * Finds the end of a heading's section.
 *
 * A section ends when we encounter a heading of equal or higher level,
 * or at the end of the document.
 *
 * @param lines - Array of document lines
 * @param startIndex - Line index of the heading
 * @param level - Heading level (e.g., 2 for ##)
 * @returns Line index where section ends (exclusive)
 */
function findSectionEnd(
	lines: ReadonlyArray<string>,
	startIndex: number,
	level: number,
): number {
	for (let i = startIndex + 1; i < lines.length; i++) {
		const line = lines[i];
		if (line === undefined) continue;
		const match = /^(#+)\s+(.*)$/.exec(line.trim());
		if (!match) continue;
		const hashes = match[1];
		if (!hashes) continue;
		const headingLevel = hashes.length;
		// Section ends at equal or higher level heading
		if (headingLevel <= level) return i;
	}
	return lines.length;
}

/**
 * Inserts items into an array at a specific index.
 *
 * @param items - Original array
 * @param index - Index to insert at
 * @param additions - Items to insert
 * @returns New array with items inserted
 */
function insertAtIndex<T>(
	items: ReadonlyArray<T>,
	index: number,
	additions: ReadonlyArray<T>,
): Array<T> {
	return [...items.slice(0, index), ...additions, ...items.slice(index)];
}

/**
 * Inserts content into a note at a location relative to a heading.
 *
 * Supports four insertion modes:
 * - "append": After the last content line in the section
 * - "prepend": Before the first content line in the section
 * - "before": Before the heading line itself
 * - "after": Immediately after the heading line
 *
 * @param config - Para-obsidian configuration
 * @param options - Insert options (file, heading, content, mode)
 * @returns Result with relative path and mode used
 * @throws Error if file doesn't exist or heading not found
 *
 * @example
 * ```typescript
 * insertIntoNote(config, {
 *   file: 'Projects/Note.md',
 *   heading: 'Tasks',
 *   content: '- [ ] New task',
 *   mode: 'append'
 * });
 * ```
 */
export function insertIntoNote(
	config: ParaObsidianConfig,
	options: InsertOptions,
): { relative: string; mode: InsertMode } {
	const target = resolveVaultPath(config.vault, options.file);
	if (!fs.existsSync(target.absolute)) {
		throw new Error(`File not found: ${options.file}`);
	}

	const raw = fs.readFileSync(target.absolute, "utf8");
	const lines = normalizeLines(raw);
	const heading = findHeading(lines, options.heading);
	if (!heading) {
		throw new Error(`Heading not found: ${options.heading}`);
	}

	const insertLines = normalizeLines(options.content);
	const sectionEnd = findSectionEnd(lines, heading.index, heading.level);

	// Find content boundaries (skip empty lines after heading)
	const start = heading.index + 1;
	let firstContentIndex = start;
	while (firstContentIndex < sectionEnd) {
		const current = lines[firstContentIndex];
		if (current === undefined || current.trim() !== "") break;
		firstContentIndex++;
	}

	// Find last non-empty line before section end
	let lastContentIndex = sectionEnd;
	while (lastContentIndex > start) {
		const current = lines[lastContentIndex - 1];
		if (current === undefined || current.trim() !== "") break;
		lastContentIndex--;
	}

	// Determine insertion point based on mode
	let insertIndex = start;
	if (options.mode === "append") {
		insertIndex = lastContentIndex;
	} else if (options.mode === "prepend" || options.mode === "after") {
		insertIndex = firstContentIndex;
	} else if (options.mode === "before") {
		insertIndex = heading.index;
	}

	const updatedLines = insertAtIndex(lines, insertIndex, insertLines);
	fs.writeFileSync(target.absolute, updatedLines.join("\n"), "utf8");

	return { relative: target.relative, mode: options.mode };
}
