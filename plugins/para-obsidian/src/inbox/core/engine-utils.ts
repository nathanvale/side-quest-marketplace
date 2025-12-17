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
 * Extract first 4 characters of a hash as a short ID.
 *
 * @param hash - Full SHA256 hash (64 chars)
 * @returns 4-character hash prefix
 *
 * @example
 * ```typescript
 * getHashPrefix("a7b3c4d5e6f7..."); // "a7b3"
 * ```
 */
export function getHashPrefix(hash: string): string {
	return hash.slice(0, 4);
}

/**
 * Generates a hash-based filename for an attachment.
 *
 * Transforms the note title to filename format:
 *   Note title:  "2024 12 10 a7b3 Invoice Amazon"
 *   Attachment:  "2024-12-10-a7b3-invoice-amazon.pdf"
 *
 * Simply takes generateTitle output, replaces spaces with hyphens,
 * and lowercases. This keeps note and attachment names in sync.
 *
 * @param originalPath - Original file path (for extension)
 * @param hash - SHA256 hash of file contents
 * @param noteType - Document type (invoice, booking, etc.)
 * @param fields - Extracted fields (provider, date, etc.)
 * @returns Generated filename
 *
 * @example
 * ```typescript
 * generateFilename("/path/to/doc.pdf", "a7b3c4d5...", "invoice", {
 *   date: "2024-12-10",
 *   provider: "Amazon"
 * });
 * // "2024-12-10-a7b3-invoice-amazon.pdf"
 * ```
 */
export function generateFilename(
	originalPath: string,
	hash: string,
	noteType?: string,
	fields?: Record<string, unknown>,
): string {
	const ext = extname(originalPath);

	// Get note title and transform to filename-safe format:
	// - lowercase
	// - replace spaces and special chars with hyphens
	// - collapse multiple hyphens
	// - trim leading/trailing hyphens
	const title = generateTitle(basename(originalPath), noteType, fields, hash);
	const filename = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

	return `${filename}${ext}`;
}

/**
 * Generate a PARA-formatted attachment name from extracted fields.
 *
 * Format: YYYY-MM-DD-type-provider-slug.ext
 *
 * This is used as a fallback when the LLM doesn't provide suggestedFilenameDescription.
 * Unlike generateFilename(), this doesn't require a hash - it uses extracted data.
 *
 * @param originalPath - Original file path (for extension)
 * @param noteType - Document type (invoice, booking, etc.)
 * @param fields - Extracted fields from document (date, provider, etc.)
 * @returns Generated filename or undefined if insufficient data
 *
 * @example
 * ```typescript
 * generateAttachmentName(
 *   "/inbox/statement.pdf",
 *   "medical-statement",
 *   { date: "2025-10-21", provider: "PV Foulkes Medical Services" }
 * );
 * // "2025-10-21-medical-statement-pv-foulkes-medical-services.pdf"
 * ```
 */
export function generateAttachmentName(
	originalPath: string,
	noteType?: string,
	fields?: Record<string, unknown>,
): string | undefined {
	// Get date from various field names
	const date = (fields?.date ??
		fields?.statementDate ??
		fields?.invoice_date ??
		fields?.invoiceDate) as string | undefined;

	// Get provider
	const provider = fields?.provider as string | undefined;

	// Need at least date and type to generate a meaningful name
	if (!date || !noteType) {
		return undefined;
	}

	const ext = extname(originalPath);

	// Build slug from provider (if available) or just use type
	const providerSlug = provider
		? provider
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-+|-+$/g, "")
				.slice(0, 40) // Limit length
		: undefined;

	const typeSlug = noteType
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

	// Format: date-type-provider.ext
	const parts = [date, typeSlug, providerSlug].filter(Boolean);
	return `${parts.join("-")}${ext}`;
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
 * Format a date string with spaces instead of hyphens.
 *
 * @param date - Date in YYYY-MM-DD format
 * @returns Date in YYYY MM DD format
 *
 * @example
 * ```typescript
 * formatDateWithSpaces("2024-12-10"); // "2024 12 10"
 * ```
 */
export function formatDateWithSpaces(date: string): string {
	return date.replace(/-/g, " ");
}

/**
 * Generate a suggested title from filename and extracted data.
 *
 * When a hash is provided (from source attachment), the format is:
 *   YYYY MM DD hash4 Type Provider
 *
 * This links the note to its source attachment which uses the same hash prefix.
 *
 * When no hash is provided (manual note, markdown in inbox):
 *   Date Type Provider (with hyphens)
 *
 * @param filename - Original filename
 * @param noteType - Suggested note type (optional)
 * @param fields - Extracted fields from document (optional)
 * @param hash - SHA256 hash of source attachment (optional)
 * @returns Generated title
 *
 * @example
 * ```typescript
 * // With hash (from PDF/image):
 * generateTitle("invoice.pdf", "invoice", { provider: "Amazon", date: "2024-12-10" }, "a7b3...");
 * // "2024 12 10 a7b3 Invoice Amazon"
 *
 * // Without hash (manual note):
 * generateTitle("notes.md", "note", { provider: "Meeting" });
 * // "Note - Meeting"
 * ```
 */
export function generateTitle(
	filename: string,
	noteType?: string,
	fields?: Record<string, unknown>,
	hash?: string,
): string {
	// Try to use extracted provider and date
	// Check multiple date field variations (date, statementDate, invoice_date)
	const provider = fields?.provider as string | undefined;
	const date = (fields?.date ??
		fields?.statementDate ??
		fields?.invoice_date) as string | undefined;

	// Title case: "medical-statement" → "Medical Statement"
	const typeLabel = noteType
		? noteType
				.split("-")
				.map((word) => capitalizeFirst(word))
				.join(" ")
		: "Document";

	// When hash is provided, use space-separated format for linking to attachment
	if (hash) {
		const hashPrefix = getHashPrefix(hash);
		const formattedDate = date ? formatDateWithSpaces(date) : "";

		// Format: YYYY MM DD Type Provider hash4 (hash at end for visual cleanliness)
		const parts = [formattedDate, typeLabel, provider, hashPrefix].filter(
			Boolean,
		);
		return parts.join(" ");
	}

	// No hash - use traditional format with hyphens (manual notes, markdown files)
	// Format: Date - Type - Provider (date first for chronological sorting)
	if (provider && date) {
		return `${date} - ${typeLabel} - ${provider}`;
	}

	if (date) {
		return `${date} - ${typeLabel}`;
	}

	if (provider) {
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
 * // → "/vault/Notes/Invoice - Amazon - 2024-12-10 (2).md"
 * ```
 */
export function generateUniqueNotePath(basePath: string): string {
	if (!pathExistsSync(basePath)) {
		return basePath;
	}

	const ext = extname(basePath);
	const base = ext ? basePath.slice(0, -ext.length) : basePath;
	let counter = 2;

	// Obsidian pattern: "Title.md", "Title (2).md", "Title (3).md"
	while (pathExistsSync(`${base} (${counter})${ext}`)) {
		counter++;
	}

	return `${base} (${counter})${ext}`;
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
