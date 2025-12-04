import fs from "node:fs";

import type { ParaObsidianConfig } from "./config";
import { resolveVaultPath } from "./fs";

export type InsertMode = "append" | "prepend" | "before" | "after";

export interface InsertOptions {
	readonly file: string;
	readonly heading: string;
	readonly content: string;
	readonly mode: InsertMode;
}

interface HeadingMatch {
	readonly index: number;
	readonly level: number;
}

function normalizeLines(text: string): string[] {
	const normalized = text.replace(/\r\n/g, "\n");
	return normalized.split("\n");
}

function findHeading(
	lines: ReadonlyArray<string>,
	heading: string,
): HeadingMatch | undefined {
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line === undefined) continue;
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
		if (headingLevel <= level) return i;
	}
	return lines.length;
}

function insertAtIndex<T>(
	items: ReadonlyArray<T>,
	index: number,
	additions: ReadonlyArray<T>,
): Array<T> {
	return [...items.slice(0, index), ...additions, ...items.slice(index)];
}

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

	const start = heading.index + 1;
	let firstContentIndex = start;
	while (firstContentIndex < sectionEnd) {
		const current = lines[firstContentIndex];
		if (current === undefined || current.trim() !== "") break;
		firstContentIndex++;
	}

	let lastContentIndex = sectionEnd;
	while (lastContentIndex > start) {
		const current = lines[lastContentIndex - 1];
		if (current === undefined || current.trim() !== "") break;
		lastContentIndex--;
	}

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
