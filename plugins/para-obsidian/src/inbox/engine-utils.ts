/**
 * Inbox Engine Utility Functions
 *
 * Pure utility functions used by the inbox processing engine.
 * These have no dependencies on engine state and can be reused.
 *
 * @module inbox/engine-utils
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
 * @param basePath - The desired file path
 * @returns Unique path (original or with -N suffix before extension)
 *
 * @example
 * ```typescript
 * // If "2025-12-10-invoice.pdf" exists:
 * generateUniquePath("/vault/Attachments/2025-12-10-invoice.pdf");
 * // → "/vault/Attachments/2025-12-10-invoice-1.pdf"
 * ```
 */
export function generateUniquePath(basePath: string): string {
	if (!pathExistsSync(basePath)) {
		return basePath;
	}

	const ext = extname(basePath);
	const base = ext ? basePath.slice(0, -ext.length) : basePath;
	let counter = 1;

	while (pathExistsSync(`${base}-${counter}${ext}`)) {
		counter++;
	}

	return `${base}-${counter}${ext}`;
}
