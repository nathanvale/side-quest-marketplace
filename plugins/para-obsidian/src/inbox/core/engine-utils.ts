/**
 * Inbox Engine Utility Functions
 *
 * Pure utility functions used by the inbox processing engine.
 * These have no dependencies on engine state and can be reused.
 *
 * @module inbox/core/engine-utils
 */

import { basename, extname } from "node:path";
import { pathExistsSync } from "@sidequest/core/fs";

/**
 * Generates a timestamp-based filename for an attachment.
 *
 * Format: YYYYMMDD-HHMM-description.ext
 *
 * @param originalPath - Original file path
 * @param timestamp - Optional timestamp (default: now)
 * @returns Generated filename
 *
 * @example
 * ```typescript
 * generateFilename("/path/to/Invoice ABC.pdf");
 * // "20241210-1430-invoice-abc.pdf"
 * ```
 */
export function generateFilename(
	originalPath: string,
	timestamp?: Date,
): string {
	const ts = timestamp ?? new Date();
	const year = ts.getFullYear();
	const month = String(ts.getMonth() + 1).padStart(2, "0");
	const day = String(ts.getDate()).padStart(2, "0");
	const hour = String(ts.getHours()).padStart(2, "0");
	const minute = String(ts.getMinutes()).padStart(2, "0");

	const timestampPrefix = `${year}${month}${day}-${hour}${minute}`;

	const file = basename(originalPath);
	const ext = extname(file);
	const nameWithoutExt = basename(file, ext);

	const description = nameWithoutExt
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

	return `${timestampPrefix}-${description}${ext}`;
}

/**
 * Capitalize first letter of a string.
 *
 * @param s - String to capitalize
 * @returns String with first letter capitalized
 *
 * @example
 * ```typescript
 * capitalizeFirst("invoice"); // "Invoice"
 * capitalizeFirst("booking"); // "Booking"
 * ```
 */
export function capitalizeFirst(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Generate a suggested title from filename and extracted data.
 *
 * Uses extracted provider and date fields if available,
 * otherwise falls back to cleaned filename.
 *
 * @param filename - Original filename
 * @param noteType - Suggested note type (optional)
 * @param fields - Extracted fields from document (optional)
 * @returns Generated title
 *
 * @example
 * ```typescript
 * generateTitle("invoice.pdf", "invoice", { provider: "Amazon", date: "2024-12-10" });
 * // "Invoice - Amazon - 2024-12-10"
 * ```
 */
export function generateTitle(
	filename: string,
	noteType?: string,
	fields?: Record<string, unknown>,
): string {
	// Try to use extracted provider and date
	const provider = fields?.provider as string | undefined;
	const date = fields?.date as string | undefined;

	if (provider && date) {
		const typeLabel = noteType ? capitalizeFirst(noteType) : "Document";
		return `${typeLabel} - ${provider} - ${date}`;
	}

	if (provider) {
		const typeLabel = noteType ? capitalizeFirst(noteType) : "Document";
		return `${typeLabel} - ${provider}`;
	}

	// Fall back to cleaned filename
	const name = basename(filename, extname(filename));
	return name.replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Generate a unique file path by appending a counter if the path already exists.
 *
 * Uses a simple counter pattern for sequential inbox processing.
 * Pattern: filename-2.ext, filename-3.ext, etc.
 *
 * @param basePath - The desired file path
 * @returns Unique path (original or with -N suffix before extension)
 *
 * @example
 * ```typescript
 * // If "2025-12-10-invoice.pdf" exists:
 * generateUniquePath("/vault/Attachments/2025-12-10-invoice.pdf");
 * // → "/vault/Attachments/2025-12-10-invoice-2.pdf"
 * ```
 */
export function generateUniquePath(basePath: string): string {
	if (!pathExistsSync(basePath)) {
		return basePath;
	}

	const ext = extname(basePath);
	const base = ext ? basePath.slice(0, -ext.length) : basePath;
	let counter = 2;

	while (pathExistsSync(`${base}-${counter}${ext}`)) {
		counter++;
	}

	return `${base}-${counter}${ext}`;
}

/**
 * Generate a unique path for notes using Obsidian's naming convention.
 *
 * Pattern: "Title.md", "Title 1.md", "Title 2.md", etc.
 * This matches Obsidian's native behavior when creating duplicate notes.
 *
 * @param basePath - The desired file path (should end with .md)
 * @returns Unique path (original or with " N" suffix before extension)
 *
 * @example
 * ```typescript
 * // If "Invoice - Amazon - 2024-12-10.md" exists:
 * generateUniqueNotePath("/vault/Notes/Invoice - Amazon - 2024-12-10.md");
 * // → "/vault/Notes/Invoice - Amazon - 2024-12-10 1.md"
 * ```
 */
export function generateUniqueNotePath(basePath: string): string {
	if (!pathExistsSync(basePath)) {
		return basePath;
	}

	const ext = extname(basePath);
	const base = ext ? basePath.slice(0, -ext.length) : basePath;
	let counter = 1;

	// Obsidian uses space before number: "Title 1.md", "Title 2.md"
	while (pathExistsSync(`${base} ${counter}${ext}`)) {
		counter++;
	}

	return `${base} ${counter}${ext}`;
}

/**
 * Parse wikilink format [[Name]] to plain string.
 *
 * Handles both wikilink format and plain strings.
 * Returns undefined for non-string or empty values.
 *
 * @param value - Value to parse (typically from frontmatter)
 * @returns Extracted name or undefined
 *
 * @example
 * ```typescript
 * parseWikilink("[[Health]]"); // "Health"
 * parseWikilink("Finance"); // "Finance"
 * parseWikilink(""); // undefined
 * parseWikilink(null); // undefined
 * ```
 */
export function parseWikilink(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	if (!value.trim()) return undefined;

	// Match wikilink format [[Name]] or [[Name|Alias]]
	const match = value.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
	if (match?.[1]) {
		return match[1].trim() || undefined;
	}
	return value.trim() || undefined;
}
