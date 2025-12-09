/**
 * Auto-link attachments to notes utilities.
 *
 * This module provides functionality to automatically link flattened
 * attachments to their corresponding notes based on name matching.
 *
 * Workflow:
 * 1. Scan all notes in a directory
 * 2. Find matching attachments by fuzzy name matching
 * 3. Update frontmatter `attachments:` field
 * 4. Optionally commit changes
 *
 * @module link-attachments
 */
import fs from "node:fs";
import path from "node:path";

import { parseFrontmatter, serializeFrontmatter } from "./frontmatter";
import { resolveVaultPath } from "./fs";

/**
 * Result of linking attachments to a single note.
 */
export interface LinkAttachmentsResult {
	/** Path to the note that was updated */
	readonly note: string;
	/** Attachments linked to this note */
	readonly attachments: ReadonlyArray<string>;
}

/**
 * Summary of link-attachments operation.
 */
export interface LinkAttachmentsSummary {
	/** Total number of attachments linked */
	readonly totalLinks: number;
	/** Number of notes updated */
	readonly notesUpdated: number;
	/** Details of each note update */
	readonly updates: ReadonlyArray<LinkAttachmentsResult>;
}

/**
 * Options for link-attachments operation.
 */
export interface LinkAttachmentsOptions {
	/** If true, show what would happen without making changes */
	readonly dryRun?: boolean;
	/** Similarity threshold (0-1) for fuzzy matching */
	readonly threshold?: number;
}

/**
 * Calculates similarity score between two strings (0-1).
 *
 * Uses a simple character overlap metric for fuzzy matching.
 * Higher scores = more similar strings.
 *
 * @param a - First string
 * @param b - Second string
 * @returns Similarity score (0 = no match, 1 = identical)
 */
function similarity(a: string, b: string): number {
	const lowerA = a.toLowerCase();
	const lowerB = b.toLowerCase();

	// Exact match
	if (lowerA === lowerB) return 1.0;

	// Substring match
	if (lowerA.includes(lowerB) || lowerB.includes(lowerA)) {
		return 0.8;
	}

	// Word overlap
	const wordsA = lowerA.split(/[^a-z0-9]+/).filter(Boolean);
	const wordsB = lowerB.split(/[^a-z0-9]+/).filter(Boolean);

	const commonWords = wordsA.filter((w) => wordsB.includes(w));
	const totalWords = new Set([...wordsA, ...wordsB]).size;

	return commonWords.length / totalWords;
}

/**
 * Finds best matching attachments for a note based on name similarity.
 *
 * @param notePath - Vault-relative path to note
 * @param attachments - Array of vault-relative attachment paths
 * @param threshold - Minimum similarity score (0-1)
 * @returns Array of matching attachment paths
 */
function findMatchingAttachments(
	notePath: string,
	attachments: ReadonlyArray<string>,
	threshold: number,
): ReadonlyArray<string> {
	const noteName = path.basename(notePath, ".md");

	// Remove emoji prefixes and normalize
	const cleanName = noteName
		.replace(/^(?:🎫|📊|✅|🗓️)\s*/u, "") // Remove emoji prefix
		.toLowerCase();

	const matches: Array<{ path: string; score: number }> = [];

	for (const att of attachments) {
		const attName = path.basename(att);

		// Skip .DS_Store and other system files
		if (attName.startsWith(".") || attName.toLowerCase() === "ds-store") {
			continue;
		}

		// Extract meaningful parts from timestamp-based filename
		// Format: YYYYMMDD-HHMM-type-description.ext
		const parts = attName.split("-");
		if (parts.length < 3) continue;

		// Skip timestamp and get description parts
		const descriptionParts = parts.slice(2); // Everything after YYYYMMDD-HHMM
		const description = descriptionParts
			.join("-")
			.replace(/\.[^.]+$/, "") // Remove extension
			.toLowerCase();

		const score = similarity(cleanName, description);

		if (score >= threshold) {
			matches.push({ path: att, score });
		}
	}

	// Sort by score descending
	matches.sort((a, b) => b.score - a.score);

	return matches.map((m) => m.path);
}

/**
 * Links attachments to notes in a directory.
 *
 * Scans all markdown files in the directory, finds matching attachments
 * based on name similarity, and updates the frontmatter `attachments:` field.
 *
 * @param vault - Absolute path to vault root
 * @param dir - Directory to scan (relative to vault)
 * @param options - Link options
 * @returns Summary of linking operation
 */
export async function linkAttachmentsToNotes(
	vault: string,
	dir: string,
	options: LinkAttachmentsOptions = {},
): Promise<LinkAttachmentsSummary> {
	const { dryRun = false, threshold = 0.3 } = options;

	// Get all attachments
	const attachmentsDir = path.join(vault, "Attachments");
	if (!fs.existsSync(attachmentsDir)) {
		return { totalLinks: 0, notesUpdated: 0, updates: [] };
	}

	const allAttachments = fs
		.readdirSync(attachmentsDir)
		.map((file) => `Attachments/${file}`);

	// Get all notes in directory
	const { absolute: dirAbsolute } = resolveVaultPath(vault, dir);
	if (!fs.existsSync(dirAbsolute)) {
		throw new Error(`Directory not found: ${dir}`);
	}

	const notes: string[] = [];

	function walkDir(currentDir: string): void {
		for (const entry of fs.readdirSync(currentDir)) {
			const fullPath = path.join(currentDir, entry);
			const stat = fs.statSync(fullPath);

			if (stat.isDirectory()) {
				walkDir(fullPath);
			} else if (stat.isFile() && entry.endsWith(".md")) {
				const rel = path.relative(vault, fullPath);
				notes.push(rel);
			}
		}
	}

	walkDir(dirAbsolute);

	// Link attachments to each note
	const updates: LinkAttachmentsResult[] = [];
	let totalLinks = 0;

	for (const notePath of notes) {
		const matches = findMatchingAttachments(
			notePath,
			allAttachments,
			threshold,
		);

		if (matches.length === 0) continue;

		// Read current frontmatter
		const { absolute: noteAbsolute } = resolveVaultPath(vault, notePath);
		const content = fs.readFileSync(noteAbsolute, "utf8");
		const { attributes } = parseFrontmatter(content);

		// Get existing attachments
		const existing = Array.isArray(attributes.attachments)
			? attributes.attachments
			: [];

		// Convert wikilinks to paths for comparison
		const existingPaths = existing
			.map((link) => {
				if (typeof link !== "string") return null;
				const match = link.match(/^\[\[(.+?)\]\]$/);
				return match?.[1] ?? null;
			})
			.filter(Boolean) as string[];

		// Add new matches not already present
		const newMatches = matches.filter((m) => !existingPaths.includes(m));

		if (newMatches.length === 0) continue;

		// Format as wikilinks
		const newLinks = newMatches.map((m) => `[[${m}]]`);
		const updatedAttachments = [...existing, ...newLinks];

		// Update frontmatter
		if (!dryRun) {
			const { body } = parseFrontmatter(content);
			const updatedAttributes = {
				...attributes,
				attachments: updatedAttachments,
			};
			const updatedContent = serializeFrontmatter(updatedAttributes, body);
			fs.writeFileSync(noteAbsolute, updatedContent, "utf8");
		}

		updates.push({ note: notePath, attachments: newMatches });
		totalLinks += newMatches.length;
	}

	return {
		totalLinks,
		notesUpdated: updates.length,
		updates,
	};
}
