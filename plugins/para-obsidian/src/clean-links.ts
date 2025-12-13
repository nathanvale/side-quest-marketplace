/**
 * Clean broken links utilities.
 *
 * This module provides functionality to remove broken wikilinks from notes.
 *
 * @module clean-links
 */
import {
	pathExistsSync,
	readTextFileSync,
	writeTextFileSync,
} from "@sidequest/core/fs";

import { parseFrontmatter, serializeFrontmatter } from "./frontmatter/index";
import { resolveVaultPath } from "./fs";
import { findOrphans } from "./orphans";

/**
 * Result of cleaning broken links.
 */
export interface CleanLinksResult {
	/** Number of notes updated */
	readonly notesUpdated: number;
	/** Number of links removed */
	readonly linksRemoved: number;
	/** Details of updates */
	readonly updates: ReadonlyArray<{
		readonly note: string;
		readonly linksRemoved: number;
	}>;
}

/**
 * Options for clean-links operation.
 */
export interface CleanLinksOptions {
	/** If true, show what would happen without making changes */
	readonly dryRun?: boolean;
	/** Directory to scan (default: entire vault) */
	readonly dir?: string;
}

/**
 * Removes broken links from note frontmatter.
 *
 * Scans for broken wikilinks in frontmatter arrays and removes them.
 *
 * @param vault - Absolute path to vault root
 * @param options - Clean options
 * @returns Summary of cleaning operation
 */
export function cleanBrokenLinks(
	vault: string,
	options: CleanLinksOptions = {},
): CleanLinksResult {
	const { dryRun = false, dir = "." } = options;

	// Find all broken links (wrap single dir in array for multi-dir API)
	const { brokenLinks } = findOrphans(vault, { dirs: [dir] });

	// Group by note
	const linksByNote = new Map<string, Set<string>>();
	for (const { note, link, location } of brokenLinks) {
		// Only clean frontmatter links (body links are user content)
		if (location !== "frontmatter") continue;

		if (!linksByNote.has(note)) {
			linksByNote.set(note, new Set());
		}
		linksByNote.get(note)?.add(link);
	}

	const updates: Array<{ note: string; linksRemoved: number }> = [];
	let totalLinksRemoved = 0;

	for (const [notePath, brokenSet] of linksByNote.entries()) {
		const { absolute } = resolveVaultPath(vault, notePath);
		if (!pathExistsSync(absolute)) {
			continue;
		}
		const content = readTextFileSync(absolute);
		const { attributes, body } = parseFrontmatter(content);

		let linksRemoved = 0;
		const updatedAttributes = { ...attributes };

		// Clean arrays in frontmatter
		for (const [key, value] of Object.entries(attributes)) {
			if (Array.isArray(value)) {
				const cleaned = value.filter((item) => {
					if (typeof item !== "string") return true;
					const match = item.match(/^\[\[(.+?)\]\]$/);
					if (!match?.[1]) return true;
					const link = match[1];
					if (brokenSet.has(link)) {
						linksRemoved++;
						return false;
					}
					return true;
				});

				if (cleaned.length !== value.length) {
					updatedAttributes[key] = cleaned;
				}
			} else if (typeof value === "string") {
				const match = value.match(/^\[\[(.+?)\]\]$/);
				if (match?.[1] && brokenSet.has(match[1])) {
					delete updatedAttributes[key];
					linksRemoved++;
				}
			}
		}

		if (linksRemoved > 0) {
			if (!dryRun) {
				const updatedContent = serializeFrontmatter(updatedAttributes, body);
				writeTextFileSync(absolute, updatedContent);
			}

			updates.push({ note: notePath, linksRemoved });
			totalLinksRemoved += linksRemoved;
		}
	}

	return {
		notesUpdated: updates.length,
		linksRemoved: totalLinksRemoved,
		updates,
	};
}
