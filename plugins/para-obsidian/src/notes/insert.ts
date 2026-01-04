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
import {
	pathExistsSync,
	readTextFileSync,
	writeTextFileSync,
} from "@sidequest/core/fs";

import type { ParaObsidianConfig } from "../config/index";
import { resolveVaultPath } from "../shared/fs";
import { fsLogger } from "../shared/logger";

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
 * Normalizes a heading parameter by stripping any leading # symbols.
 * Accepts both "## Tasks" and "Tasks" formats.
 */
function normalizeHeadingParam(heading: string): string {
	return heading.replace(/^#+\s*/, "").trim();
}

/**
 * Finds a heading by its title text.
 *
 * @param lines - Array of document lines
 * @param heading - Heading title to find (with or without # prefix)
 * @returns Heading match with index and level, or undefined if not found
 */
function findHeading(
	lines: ReadonlyArray<string>,
	heading: string,
): HeadingMatch | undefined {
	const normalizedHeading = normalizeHeadingParam(heading);

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line === undefined) continue;
		// Match heading pattern: one or more # followed by space and title
		const match = /^(#+)\s+(.*)$/.exec(line.trim());
		if (!match) continue;
		const hashes = match[1];
		const title = match[2];
		if (!hashes || !title) continue;
		if (title.trim() === normalizedHeading) {
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
	if (fsLogger) {
		fsLogger.debug`fs:insert:start vault=${config.vault} file=${options.file} heading=${options.heading} absolutePath=${target.absolute}`;
	}

	if (!pathExistsSync(target.absolute)) {
		if (fsLogger) {
			fsLogger.error`fs:insert:fileNotFound file=${target.absolute}`;
		}
		throw new Error(`File not found: ${options.file}`);
	}

	const raw = readTextFileSync(target.absolute);
	const lines = normalizeLines(raw);
	if (fsLogger) {
		fsLogger.debug`fs:insert:read lines=${lines.length}`;
	}

	const heading = findHeading(lines, options.heading);
	if (!heading) {
		// Log available headings for debugging
		const availableHeadings: string[] = [];
		for (const line of lines) {
			const match = /^(#+)\s+(.*)$/.exec(line?.trim() ?? "");
			if (match?.[2]) {
				availableHeadings.push(`${match[1]} ${match[2]}`);
			}
		}
		if (fsLogger) {
			fsLogger.error`fs:insert:headingNotFound heading=${options.heading} available=${availableHeadings.join(", ")}`;
		}
		throw new Error(`Heading not found: ${options.heading}`);
	}
	if (fsLogger) {
		fsLogger.debug`fs:insert:headingFound line=${heading.index} level=${heading.level}`;
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
	writeTextFileSync(target.absolute, updatedLines.join("\n"));

	if (fsLogger) {
		fsLogger.info`fs:insert:success file=${target.relative} mode=${options.mode}`;
	}

	return { relative: target.relative, mode: options.mode };
}

/**
 * Options for replacing content in a section.
 */
export interface ReplaceSectionOptions {
	/** Path to the file (relative to vault). */
	readonly file: string;
	/** Heading text to locate (without # prefix). */
	readonly heading: string;
	/** New content to replace the section with. */
	readonly content: string;
	/** If true, preserve HTML comments in the section. */
	readonly preserveComments?: boolean;
}

/**
 * Replaces the content of a section under a heading.
 *
 * Unlike insertIntoNote which appends/prepends, this function
 * completely replaces the content between a heading and the next
 * heading of equal or higher level.
 *
 * @param config - Para-obsidian configuration
 * @param options - Replace options (file, heading, content)
 * @returns Result with relative path
 * @throws Error if file doesn't exist or heading not found
 *
 * @example
 * ```typescript
 * replaceSectionContent(config, {
 *   file: 'Projects/Note.md',
 *   heading: 'Why This Matters',
 *   content: 'This project solves...'
 * });
 * ```
 */
export function replaceSectionContent(
	config: ParaObsidianConfig,
	options: ReplaceSectionOptions,
): { relative: string } {
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

	const sectionEnd = findSectionEnd(lines, heading.index, heading.level);
	const sectionStart = heading.index + 1;

	// Extract comments if preserving
	const comments: string[] = [];
	if (options.preserveComments) {
		for (let i = sectionStart; i < sectionEnd; i++) {
			const line = lines[i];
			if (line && /^\s*<!--.*-->\s*$/.test(line)) {
				comments.push(line);
			}
		}
	}

	// Build new section content
	const newContent = normalizeLines(options.content);
	const newSection =
		options.preserveComments && comments.length > 0
			? [...comments, "", ...newContent, ""]
			: ["", ...newContent, ""];

	// Replace section content
	const updatedLines = [
		...lines.slice(0, sectionStart),
		...newSection,
		...lines.slice(sectionEnd),
	];

	fs.writeFileSync(target.absolute, updatedLines.join("\n"), "utf8");

	return { relative: target.relative };
}

/**
 * Replaces the H1 title in a note.
 *
 * Finds the first `# title` line and replaces it with the new title.
 *
 * @param config - Para-obsidian configuration
 * @param file - Path to the file (relative to vault)
 * @param newTitle - New title text (without # prefix)
 * @returns Result indicating if replacement was made
 *
 * @example
 * ```typescript
 * replaceH1Title(config, 'Projects/Note.md', 'My Project');
 * // Changes "# null" to "# My Project"
 * ```
 */
export function replaceH1Title(
	config: ParaObsidianConfig,
	file: string,
	newTitle: string,
): { relative: string; replaced: boolean } {
	const target = resolveVaultPath(config.vault, file);
	if (!fs.existsSync(target.absolute)) {
		throw new Error(`File not found: ${file}`);
	}

	const raw = fs.readFileSync(target.absolute, "utf8");
	const lines = normalizeLines(raw);

	let replaced = false;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line === undefined) continue;
		// Match H1: exactly one # followed by space
		if (/^#\s+/.test(line)) {
			lines[i] = `# ${newTitle}`;
			replaced = true;
			break;
		}
	}

	if (replaced) {
		fs.writeFileSync(target.absolute, lines.join("\n"), "utf8");
	}

	return { relative: target.relative, replaced };
}
