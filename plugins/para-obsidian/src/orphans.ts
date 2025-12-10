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
	/** Directory to scan for notes (default: entire vault) */
	readonly dir?: string;
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
 *
 * @param link - Raw wikilink content (without brackets)
 * @returns Normalized file path with .md extension
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
	// Add .md extension if not present
	if (!normalized.endsWith(".md")) {
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
	const content = fs.readFileSync(absolute, "utf8");

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
 * Finds orphan attachments and broken links.
 *
 * Scans vault for:
 * - Files in Attachments/ not referenced by any note
 * - Wikilinks in notes pointing to non-existent files
 *
 * @param vault - Absolute path to vault root
 * @param options - Detection options
 * @returns Orphan detection results
 */
export function findOrphans(
	vault: string,
	options: OrphanOptions = {},
): OrphanResult {
	const { dir = "." } = options;

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

			// Check if linked file exists (both attachments and note-to-note links)
			const { absolute: linkAbsolute } = resolveVaultPath(
				vault,
				normalizedLink,
			);
			if (!fs.existsSync(linkAbsolute)) {
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
