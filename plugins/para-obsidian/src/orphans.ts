/**
 * Orphan detection utilities.
 *
 * This module provides functionality to find:
 * 1. Orphan attachments - files in Attachments/ not referenced by any note
 * 2. Broken links - wikilinks in notes pointing to non-existent files
 *
 * Useful for cleanup after deleting files or reorganizing vault.
 *
 * @module orphans
 */
import fs from "node:fs";
import path from "node:path";
import {
	isDirectorySync,
	isFileSync,
	pathExistsSync,
	readDir,
	readTextFileSync,
} from "@sidequest/core/fs";

import { parseFrontmatter } from "./frontmatter";
import { resolveVaultPath } from "./fs";

/**
 * Result of orphan detection.
 */
export interface OrphanResult {
	/** Attachments not referenced by any note */
	readonly orphanAttachments: ReadonlyArray<string>;
	/** Broken wikilinks found in notes */
	readonly brokenLinks: ReadonlyArray<{
		readonly note: string;
		readonly link: string;
		readonly location: "frontmatter" | "body";
	}>;
}

/**
 * Options for orphan detection.
 */
export interface OrphanOptions {
	/** Directories to scan for notes (default: entire vault) */
	readonly dirs?: ReadonlyArray<string>;
}

/**
 * Normalizes a wikilink by removing aliases, headings, and block references.
 *
 * Examples:
 * - `[[Note#Heading|Alias]]` → `Note.md`
 * - `[[Note#Heading]]` → `Note.md`
 * - `[[Note|Alias]]` → `Note.md`
 * - `[[Note^block]]` → `Note.md`
 * - `[[Note]]` → `Note.md`
 * - `[[Attachments/file.pdf]]` → `Attachments/file.pdf` (preserved)
 *
 * @param link - Raw wikilink content (without brackets)
 * @returns Normalized file path (with .md extension only if no extension present)
 */
function normalizeWikilink(link: string): string {
	// Remove everything after | (alias)
	let normalized = link.split("|")[0] ?? link;
	// Remove everything after # (heading)
	normalized = normalized.split("#")[0] ?? normalized;
	// Remove everything after ^ (block reference)
	normalized = normalized.split("^")[0] ?? normalized;
	// Trim whitespace
	normalized = normalized.trim();
	// Only add .md extension if the link has no file extension
	// This preserves PDFs, images, and other attachments
	const hasExtension = /\.[a-zA-Z0-9]+$/.test(normalized);
	if (!hasExtension) {
		normalized = `${normalized}.md`;
	}
	return normalized;
}

/**
 * Extracts all wikilinks from note content.
 *
 * Finds wikilinks in both frontmatter and body.
 *
 * @param vault - Absolute path to vault root
 * @param notePath - Vault-relative path to note
 * @returns Array of wikilink targets with location
 */
function extractWikilinks(
	vault: string,
	notePath: string,
): ReadonlyArray<{ link: string; location: "frontmatter" | "body" }> {
	const { absolute } = resolveVaultPath(vault, notePath);
	const content = readTextFileSync(absolute);

	let attributes: Record<string, unknown>;
	let body: string;

	try {
		const parsed = parseFrontmatter(content);
		attributes = parsed.attributes;
		body = parsed.body;
	} catch {
		// Skip files with invalid frontmatter (e.g., Templater templates)
		return [];
	}

	const links: Array<{ link: string; location: "frontmatter" | "body" }> = [];

	// Extract from frontmatter arrays
	for (const value of Object.values(attributes)) {
		if (Array.isArray(value)) {
			for (const item of value) {
				if (typeof item === "string") {
					const match = item.match(/^\[\[(.+?)\]\]$/);
					if (match?.[1]) {
						links.push({ link: match[1], location: "frontmatter" });
					}
				}
			}
		} else if (typeof value === "string") {
			const match = value.match(/^\[\[(.+?)\]\]$/);
			if (match?.[1]) {
				links.push({ link: match[1], location: "frontmatter" });
			}
		}
	}

	// Extract from body
	const bodyRegex = /\[\[(.+?)\]\]/g;
	for (const match of body.matchAll(bodyRegex)) {
		const link = match[1];
		if (link !== undefined) {
			links.push({ link, location: "body" });
		}
	}

	return links;
}

/**
 * Builds an index of all files in the vault by their basename.
 * Used for Obsidian-style flat-search wikilink resolution.
 *
 * @param vault - Absolute path to vault root
 * @returns Map of lowercase basename to array of vault-relative paths
 */
function buildFileIndex(vault: string): Map<string, string[]> {
	const index = new Map<string, string[]>();

	function walkDir(currentDir: string): void {
		try {
			for (const entry of readDir(currentDir)) {
				// Skip hidden files/folders
				if (entry.startsWith(".")) continue;

				const fullPath = path.join(currentDir, entry);
				if (isDirectorySync(fullPath)) {
					walkDir(fullPath);
				} else if (isFileSync(fullPath)) {
					const rel = path.relative(vault, fullPath);
					const basename = path.basename(rel).toLowerCase();
					const existing = index.get(basename) ?? [];
					existing.push(rel);
					index.set(basename, existing);
				}
			}
		} catch {
			// Skip directories we can't read
		}
	}

	walkDir(vault);
	return index;
}

/**
 * Checks if a wikilink resolves to an existing file.
 * Uses Obsidian-style resolution: first tries direct path, then vault-wide filename search.
 *
 * @param vault - Absolute path to vault root
 * @param normalizedLink - Normalized wikilink path (with .md extension)
 * @param fileIndex - Pre-built file index for vault-wide search
 * @returns true if the link resolves to an existing file
 */
function wikilinkExists(
	vault: string,
	normalizedLink: string,
	fileIndex: Map<string, string[]>,
): boolean {
	// First, try direct path resolution (e.g., [[Attachments/file.pdf]])
	const { absolute: linkAbsolute } = resolveVaultPath(vault, normalizedLink);
	if (pathExistsSync(linkAbsolute)) {
		return true;
	}

	// If direct path fails, try Obsidian-style flat search by filename
	// This handles cases like [[Note Title]] resolving to 01 Projects/Subfolder/Note Title.md
	const basename = path.basename(normalizedLink).toLowerCase();
	const matches = fileIndex.get(basename);

	return matches !== undefined && matches.length > 0;
}

/**
 * Finds orphan attachments and broken links.
 *
 * Scans vault for:
 * - Files in Attachments/ not referenced by any note
 * - Wikilinks in notes pointing to non-existent files
 *
 * Uses Obsidian-style wikilink resolution:
 * - First tries direct path from vault root
 * - Falls back to vault-wide filename search (flat search)
 *
 * @param vault - Absolute path to vault root
 * @param options - Detection options
 * @returns Orphan detection results
 */
export function findOrphans(
	vault: string,
	options: OrphanOptions = {},
): OrphanResult {
	const { dirs } = options;

	// Build file index for vault-wide wikilink resolution
	const fileIndex = buildFileIndex(vault);

	// Get all attachments
	const attachmentsDir = path.join(vault, "Attachments");
	const allAttachments = new Set<string>();

	if (fs.existsSync(attachmentsDir)) {
		for (const file of fs.readdirSync(attachmentsDir)) {
			// Skip system files
			if (file.startsWith(".") || file.toLowerCase() === "ds-store") {
				continue;
			}
			allAttachments.add(`Attachments/${file}`);
		}
	}

	const notes: string[] = [];

	function walkDir(currentDir: string): void {
		for (const entry of readDir(currentDir)) {
			const fullPath = path.join(currentDir, entry);
			if (isDirectorySync(fullPath)) {
				walkDir(fullPath);
			} else if (isFileSync(fullPath) && entry.endsWith(".md")) {
				const rel = path.relative(vault, fullPath);
				notes.push(rel);
			}
		}
	}

	// Walk each directory (or entire vault if no dirs specified)
	const dirsToWalk = dirs && dirs.length > 0 ? dirs : ["."];
	for (const dir of dirsToWalk) {
		const { absolute: dirAbsolute } = resolveVaultPath(vault, dir);
		if (pathExistsSync(dirAbsolute)) {
			walkDir(dirAbsolute);
		}
		// Silently skip non-existent dirs (like validate-all does)
	}

	// Track referenced attachments and broken links
	const referencedAttachments = new Set<string>();
	const brokenLinks: Array<{
		note: string;
		link: string;
		location: "frontmatter" | "body";
	}> = [];

	for (const notePath of notes) {
		const links = extractWikilinks(vault, notePath);

		for (const { link, location } of links) {
			// Normalize wikilink (remove aliases, headings, blocks)
			const normalizedLink = normalizeWikilink(link);

			// Track attachment references
			if (normalizedLink.startsWith("Attachments/")) {
				referencedAttachments.add(normalizedLink);
			}

			// Check if linked file exists using Obsidian-style resolution
			if (!wikilinkExists(vault, normalizedLink, fileIndex)) {
				brokenLinks.push({ note: notePath, link, location });
			}
		}
	}

	// Find orphans (attachments not referenced)
	const orphanAttachments = Array.from(allAttachments).filter(
		(att) => !referencedAttachments.has(att),
	);

	return {
		orphanAttachments,
		brokenLinks,
	};
}

/**
 * Suggested fix for a broken link.
 */
export interface LinkFix {
	/** Original link text (without brackets) */
	readonly from: string;
	/** Suggested replacement */
	readonly to: string;
	/** Confidence level */
	readonly confidence: "high" | "medium";
	/** Reason for suggestion */
	readonly reason: string;
}

/**
 * Calculates Levenshtein distance between two strings.
 * Used for fuzzy matching of filenames and note titles.
 */
function levenshteinDistance(a: string, b: string): number {
	const matrix: number[][] = [];

	for (let i = 0; i <= b.length; i++) {
		matrix[i] = [i];
	}
	for (let j = 0; j <= a.length; j++) {
		matrix[0]![j] = j;
	}

	for (let i = 1; i <= b.length; i++) {
		for (let j = 1; j <= a.length; j++) {
			if (b.charAt(i - 1) === a.charAt(j - 1)) {
				matrix[i]![j] = matrix[i - 1]![j - 1]!;
			} else {
				matrix[i]![j] = Math.min(
					matrix[i - 1]![j - 1]! + 1, // substitution
					matrix[i]![j - 1]! + 1, // insertion
					matrix[i - 1]![j]! + 1, // deletion
				);
			}
		}
	}

	return matrix[b.length]![a.length]!;
}

/**
 * Calculates similarity score between two strings (0-1).
 * Higher is more similar.
 */
function similarityScore(a: string, b: string): number {
	const maxLen = Math.max(a.length, b.length);
	if (maxLen === 0) return 1;
	const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
	return 1 - distance / maxLen;
}

/**
 * Finds the best fuzzy match from candidates.
 * Returns null if no match meets the threshold.
 */
function findBestMatch(
	target: string,
	candidates: string[],
	threshold = 0.6,
): { match: string; score: number } | null {
	let bestMatch: string | null = null;
	let bestScore = 0;

	for (const candidate of candidates) {
		const score = similarityScore(target, candidate);
		if (score > bestScore && score >= threshold) {
			bestScore = score;
			bestMatch = candidate;
		}
	}

	return bestMatch ? { match: bestMatch, score: bestScore } : null;
}

/**
 * Builds an index of all markdown notes in the vault.
 * Returns map of lowercase basename (without .md) to full vault-relative path.
 */
function buildNoteIndex(vault: string): Map<string, string> {
	const index = new Map<string, string>();

	function walkDir(currentDir: string): void {
		try {
			for (const entry of fs.readdirSync(currentDir)) {
				if (entry.startsWith(".")) continue;

				const fullPath = path.join(currentDir, entry);
				const stat = fs.statSync(fullPath);

				if (stat.isDirectory()) {
					// Skip Attachments folder
					if (entry !== "Attachments") {
						walkDir(fullPath);
					}
				} else if (stat.isFile() && entry.endsWith(".md")) {
					const rel = path.relative(vault, fullPath);
					const basename = path.basename(entry, ".md").toLowerCase();
					// Store first occurrence (prefer shorter paths)
					if (!index.has(basename)) {
						index.set(basename, rel);
					}
				}
			}
		} catch {
			// Skip directories we can't read
		}
	}

	walkDir(vault);
	return index;
}

/**
 * Generates fix suggestions for broken links.
 *
 * Analyzes broken links and suggests rewrite-links commands:
 * - High confidence: Exact filename match in Attachments/ or note title match
 * - Medium confidence: Fuzzy match (similar filename/title)
 *
 * @param vault - Absolute path to vault root
 * @param brokenLinks - Array of broken links from findOrphans
 * @returns Array of suggested fixes (deduplicated)
 */
export function suggestFixes(
	vault: string,
	brokenLinks: OrphanResult["brokenLinks"],
): ReadonlyArray<LinkFix> {
	const attachmentsDir = path.join(vault, "Attachments");
	const attachmentFiles: string[] = [];
	const attachmentFilesLower = new Set<string>();

	// Build list of attachment filenames
	if (fs.existsSync(attachmentsDir)) {
		for (const file of fs.readdirSync(attachmentsDir)) {
			if (!file.startsWith(".")) {
				attachmentFiles.push(file);
				attachmentFilesLower.add(file.toLowerCase());
			}
		}
	}

	// Build index of all notes
	const noteIndex = buildNoteIndex(vault);
	const noteBasenames = Array.from(noteIndex.keys());

	const fixes = new Map<string, LinkFix>();

	for (const { link } of brokenLinks) {
		// Skip if already suggested
		if (fixes.has(link)) continue;

		// Check if link looks like a file (has extension)
		const hasExtension = /\.[a-zA-Z0-9]+$/.test(link);

		if (hasExtension) {
			// === ATTACHMENT LINK ===

			// Skip links that already have Attachments/ prefix (file doesn't exist)
			if (link.startsWith("Attachments/")) {
				// Try fuzzy match for wrong filename in Attachments/
				const linkedFilename = path.basename(link);
				const fuzzy = findBestMatch(linkedFilename, attachmentFiles, 0.5);
				if (fuzzy) {
					fixes.set(link, {
						from: link,
						to: `Attachments/${fuzzy.match}`,
						confidence: "medium",
						reason: `Similar file: ${fuzzy.match} (${Math.round(fuzzy.score * 100)}% match)`,
					});
				}
				continue;
			}

			const basename = path.basename(link).toLowerCase();

			// High confidence: exact filename exists in Attachments/
			if (attachmentFilesLower.has(basename)) {
				const actualFile = attachmentFiles.find(
					(f) => f.toLowerCase() === basename,
				);
				if (actualFile) {
					fixes.set(link, {
						from: link,
						to: `Attachments/${actualFile}`,
						confidence: "high",
						reason: `File exists at Attachments/${actualFile}`,
					});
				}
			} else {
				// Medium confidence: fuzzy match
				const fuzzy = findBestMatch(basename, attachmentFiles, 0.5);
				if (fuzzy) {
					fixes.set(link, {
						from: link,
						to: `Attachments/${fuzzy.match}`,
						confidence: "medium",
						reason: `Similar file: ${fuzzy.match} (${Math.round(fuzzy.score * 100)}% match)`,
					});
				}
			}
		} else {
			// === NOTE LINK ===
			const linkLower = link.toLowerCase();

			// High confidence: exact note title match
			if (noteIndex.has(linkLower)) {
				const notePath = noteIndex.get(linkLower)!;
				const noteTitle = path.basename(notePath, ".md");
				// Only suggest if case differs
				if (link !== noteTitle) {
					fixes.set(link, {
						from: link,
						to: noteTitle,
						confidence: "high",
						reason: `Note exists: ${notePath}`,
					});
				}
			} else {
				// Medium confidence: fuzzy match note title
				const fuzzy = findBestMatch(linkLower, noteBasenames, 0.5);
				if (fuzzy) {
					const notePath = noteIndex.get(fuzzy.match)!;
					const noteTitle = path.basename(notePath, ".md");
					fixes.set(link, {
						from: link,
						to: noteTitle,
						confidence: "medium",
						reason: `Similar note: ${notePath} (${Math.round(fuzzy.score * 100)}% match)`,
					});
				}
			}
		}
	}

	return Array.from(fixes.values());
}

/**
 * Formats suggested fixes as a ready-to-run CLI command.
 *
 * @param fixes - Array of link fixes
 * @returns Formatted command string (empty if no fixes)
 */
export function formatFixCommand(fixes: ReadonlyArray<LinkFix>): string {
	if (fixes.length === 0) return "";

	const args = fixes
		.map((f) => `  --from "${f.from}" --to "${f.to}"`)
		.join(" \\\n");

	return `para-obsidian rewrite-links \\\n${args}`;
}
