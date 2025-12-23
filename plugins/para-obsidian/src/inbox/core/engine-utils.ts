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
 * Generates a hash-based filename for an attachment (fallback with hash always included).
 *
 * This is the FALLBACK function used when we can't generate an ideal name.
 * Always includes hash for guaranteed uniqueness.
 *
 * Transforms the note title to filename format:
 *   Note title:  "2024 12 10 Invoice Amazon a7b3"
 *   Attachment:  "2024-12-10-invoice-amazon-a7b3.pdf"
 *
 * @param originalPath - Original file path (for extension)
 * @param hash - SHA256 hash of file contents
 * @param noteType - Document type (invoice, booking, etc.)
 * @param fields - Extracted fields (provider, date, etc.)
 * @returns Generated filename with hash suffix
 *
 * @example
 * ```typescript
 * generateFilename("/path/to/doc.pdf", "a7b3c4d5...", "invoice", {
 *   date: "2024-12-10",
 *   provider: "Amazon"
 * });
 * // "2024-12-10-invoice-amazon-a7b3.pdf"
 * ```
 */
export function generateFilename(
	originalPath: string,
	hash: string,
	noteType?: string,
	fields?: Record<string, unknown>,
): string {
	const ext = extname(originalPath);

	// Get note title with hash included (hash is included by default when provided)
	// - lowercase
	// - replace spaces and special chars with hyphens
	// - collapse multiple hyphens
	// - trim leading/trailing hyphens
	const title = generateTitle(
		basename(originalPath),
		noteType,
		fields,
		hash, // Hash is included by default
	);
	const filename = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

	return `${filename}${ext}`;
}

/**
 * Generate a PARA-formatted attachment name from extracted fields.
 *
 * Format: YYYY-MM-DD-type-description-slug.ext
 *
 * This is used as a fallback when the LLM doesn't provide suggestedFilenameDescription.
 * Unlike generateFilename(), this doesn't require a hash - it uses extracted data.
 *
 * @param originalPath - Original file path (for extension)
 * @param noteType - Document type (invoice, booking, letter, cv, etc.)
 * @param fields - Extracted fields from document (date, provider, recipient, etc.)
 * @returns Generated filename or undefined if insufficient data
 * @throws {Error} If generated name contains path separators (security violation)
 *
 * @example
 * ```typescript
 * // Invoice:
 * generateAttachmentName(
 *   "/inbox/statement.pdf",
 *   "medical-statement",
 *   { date: "2025-10-21", provider: "PV Foulkes Medical Services" }
 * );
 * // "2025-10-21-medical-statement-pv-foulkes-medical-services.pdf"
 *
 * // Letter:
 * generateAttachmentName(
 *   "/inbox/letter.docx",
 *   "letter",
 *   { date_sent: "2025-12-15", recipient: "Bunnings HR" }
 * );
 * // "2025-12-15-letter-bunnings-hr.docx"
 *
 * // CV (fallback to today's date):
 * generateAttachmentName("/inbox/cv.docx", "cv", { title: "Nathan Vale CV 2025" });
 * // "2025-12-22-cv-nathan-vale-cv-2025.docx"
 * ```
 */
export function generateAttachmentName(
	originalPath: string,
	noteType?: string,
	fields?: Record<string, unknown>,
): string | undefined {
	// Get date using helper (with fallback to today for attachments)
	const date = extractDateField(fields, true);

	// Get description using helper (type-aware: provider/recipient/title)
	const description = extractDescriptionField(fields, noteType);

	// Need at least type to generate a meaningful name (date has fallback)
	if (!noteType) {
		return undefined;
	}

	const ext = extname(originalPath);

	// Build slug from description (if available)
	const descriptionSlug = description
		? description
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-+|-+$/g, "")
				.slice(0, 40) // Limit length
		: undefined;

	const typeSlug = noteType
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

	// Format: date-type-description.ext
	const parts = [date, typeSlug, descriptionSlug].filter(Boolean);
	const generatedName = `${parts.join("-")}${ext}`;

	// Security: Validate that generated name is a basename only (no path separators)
	// This prevents path traversal attacks via malicious field values
	const safeName = basename(generatedName);
	if (safeName !== generatedName) {
		throw new Error(
			`Invalid attachment name contains path separators: ${generatedName}`,
		);
	}

	return safeName;
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
 * Extract the best date field from extracted fields.
 *
 * Checks multiple date field names in priority order, with fallback to today's date.
 *
 * @param fields - Extracted fields from document
 * @param fallbackToToday - If true, return today's date when no date found (default: false)
 * @returns Date string in YYYY-MM-DD format, or undefined
 */
export function extractDateField(
	fields?: Record<string, unknown>,
	fallbackToToday = false,
): string | undefined {
	// Check multiple date field variations in priority order
	const date = (fields?.date ??
		fields?.start_date ?? // Employment contract start date
		fields?.date_sent ?? // Letter date
		fields?.statementDate ??
		fields?.invoice_date ??
		fields?.invoiceDate) as string | undefined;

	if (date) return date;

	// Fallback to today's date if requested
	if (fallbackToToday) {
		return new Date().toISOString().split("T")[0];
	}

	return undefined;
}

/**
 * Extract the best description field from extracted fields.
 *
 * Different document types use different fields for their "description" part:
 * - Invoice/Medical: provider (e.g., "Amazon", "PV Foulkes Medical")
 * - Employment Contract: employer (e.g., "Bunnings Group Limited")
 * - Letter: recipient (e.g., "Bunnings HR")
 * - CV: name or version (e.g., "Nathan Vale", "2025-v1")
 *
 * @param fields - Extracted fields from document
 * @param noteType - Document type to determine which field to use
 * @returns Description string, or undefined
 */
export function extractDescriptionField(
	fields?: Record<string, unknown>,
	noteType?: string,
): string | undefined {
	// Employment contract: use employer as description
	if (noteType === "employment-contract") {
		return (fields?.employer ?? fields?.provider) as string | undefined;
	}

	// Letter: use recipient as description
	if (noteType === "letter") {
		return (fields?.recipient ?? fields?.provider) as string | undefined;
	}

	// CV: use title or version as description
	if (noteType === "cv") {
		return (fields?.title ?? fields?.version ?? fields?.provider) as
			| string
			| undefined;
	}

	// Default: use provider (invoice, medical-statement, booking, etc.)
	return fields?.provider as string | undefined;
}

/**
 * Generate a suggested title from filename and extracted data.
 *
 * When hash is provided (from source attachment), format is:
 *   YYYY MM DD Type Provider hash4
 *
 * When no hash is provided (manual note, markdown in inbox):
 *   Date - Type - Provider (with hyphens)
 *
 * @param filename - Original filename
 * @param noteType - Suggested note type (optional)
 * @param fields - Extracted fields from document (optional)
 * @param hash - SHA256 hash of source attachment (optional)
 * @param includeHash - Whether to include hash suffix (default: true when hash provided)
 * @returns Generated title
 *
 * @example
 * ```typescript
 * // With hash (default behavior - hash included):
 * generateTitle("invoice.pdf", "invoice", { provider: "Amazon", date: "2024-12-10" }, "a7b3...");
 * // "2024 12 10 Invoice Amazon a7b3"
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
	includeHash?: boolean,
): string {
	// Try to use extracted description and date
	// For attachments (with hash), always fallback to today's date for sorting
	const description = extractDescriptionField(fields, noteType);
	const date = extractDateField(fields, !!hash);

	// Title case: "medical-statement" → "Medical Statement"
	const typeLabel = noteType
		? noteType
				.split("-")
				.map((word) => capitalizeFirst(word))
				.join(" ")
		: "Document";

	// When hash is provided, use space-separated format for linking to attachment
	if (hash) {
		const formattedDate = date ? formatDateWithSpaces(date) : "";

		// Build parts: date, type, description, and hash (by default)
		// includeHash defaults to true when hash is provided, but can be explicitly disabled
		const shouldIncludeHash = includeHash !== false;
		const parts = [formattedDate, typeLabel, description];
		if (shouldIncludeHash) {
			parts.push(getHashPrefix(hash));
		}
		return parts.filter(Boolean).join(" ");
	}

	// No hash - use traditional format with hyphens (manual notes, markdown files)
	// Format: Date - Type - Description (date first for chronological sorting)
	if (description && date) {
		return `${date} - ${typeLabel} - ${description}`;
	}

	if (date) {
		return `${date} - ${typeLabel}`;
	}

	if (description) {
		return `${typeLabel} - ${description}`;
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
 * Generate a smart attachment filename that only uses hash suffix on collision.
 *
 * Strategy:
 * 1. Try ideal name from extracted fields (date-type-provider.ext)
 * 2. If ideal name exists in attachments folder, add hash suffix
 * 3. Returns the best available unique name
 *
 * @param originalPath - Original file path (for extension)
 * @param hash - SHA256 hash of file contents
 * @param noteType - Document type (invoice, booking, etc.)
 * @param fields - Extracted fields (provider, date, etc.)
 * @param attachmentsDir - Absolute path to attachments folder
 * @returns Generated filename (with or without hash suffix)
 *
 * @example
 * ```typescript
 * // No collision:
 * generateSmartAttachmentName("/inbox/doc.pdf", "abc123...", "invoice",
 *   { date: "2024-12-10", provider: "Amazon" }, "/vault/Attachments");
 * // → "2024-12-10-invoice-amazon.pdf"
 *
 * // With collision:
 * generateSmartAttachmentName("/inbox/doc.pdf", "abc123...", "invoice",
 *   { date: "2024-12-10", provider: "Amazon" }, "/vault/Attachments");
 * // → "2024-12-10-invoice-amazon-abc1.pdf" (if first exists)
 * ```
 */
export function generateSmartAttachmentName(
	originalPath: string,
	hash: string,
	noteType?: string,
	fields?: Record<string, unknown>,
	attachmentsDir?: string,
): string {
	// Try ideal name first (no hash)
	const idealName = generateAttachmentName(originalPath, noteType, fields);

	if (idealName && attachmentsDir) {
		const idealPath = `${attachmentsDir}/${idealName}`;

		// If ideal name doesn't exist, use it
		if (!pathExistsSync(idealPath)) {
			return idealName;
		}

		// Collision detected - add hash suffix
		const ext = extname(originalPath);
		const base = idealName.slice(0, -ext.length);
		const hashPrefix = getHashPrefix(hash);
		return `${base}-${hashPrefix}${ext}`;
	}

	// Fallback to hash-based name (old behavior)
	return generateFilename(originalPath, hash, noteType, fields);
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
