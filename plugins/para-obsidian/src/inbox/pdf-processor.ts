/**
 * Inbox Processing Framework - PDF Processor
 *
 * Handles PDF text extraction and heuristic detection:
 * - pdftotext availability check
 * - Text extraction with timeout/error handling
 * - Filename pattern detection (invoice, booking, etc.)
 * - Content marker detection
 *
 * @example
 * ```typescript
 * import { checkPdfToText, extractPdfText, detectByFilename, detectByContent } from "./pdf-processor";
 *
 * const check = await checkPdfToText();
 * if (!check.available) throw new Error(check.error);
 *
 * const text = await extractPdfText("/path/to/file.pdf", correlationId);
 * const filenameResult = detectByFilename("invoice-001.pdf");
 * const contentResult = detectByContent(text);
 * ```
 */

import { stat } from "node:fs/promises";
import { basename } from "node:path";
import { $ } from "bun";
import { createInboxError, InboxError } from "./errors";
import { pdfLogger } from "./logger";

// Non-null assertion for logger (we know it exists since we defined the subsystem)
const log = pdfLogger as NonNullable<typeof pdfLogger>;

// =============================================================================
// Constants
// =============================================================================

/** Maximum PDF file size in bytes (50MB) */
const MAX_PDF_SIZE = 50 * 1024 * 1024;

/** Maximum extracted text size in bytes (10MB) */
const MAX_TEXT_SIZE = 10 * 1024 * 1024;

/** Timeout for pdftotext extraction in milliseconds (30 seconds) */
const EXTRACTION_TIMEOUT = 30_000;

// =============================================================================
// Types
// =============================================================================

/**
 * Result of pdftotext availability check.
 */
export interface PdfToTextCheck {
	readonly available: boolean;
	readonly error?: string;
	readonly version?: string;
}

/**
 * Result of heuristic detection (filename or content).
 */
export interface HeuristicResult {
	/** Whether a type was detected */
	readonly detected: boolean;

	/** Suggested note type (invoice, booking, etc.) */
	readonly suggestedType?: string;

	/** Confidence score (0-1) */
	readonly confidence: number;

	/** Patterns that matched */
	readonly matchedPatterns?: string[];
}

// =============================================================================
// Filename Patterns
// =============================================================================

/**
 * Patterns for detecting document type from filename.
 * Maps pattern to document type.
 */
const FILENAME_PATTERNS: ReadonlyArray<{
	pattern: RegExp;
	type: string;
	weight: number;
}> = [
	// Invoice patterns
	{ pattern: /invoice/i, type: "invoice", weight: 1.0 },
	{ pattern: /tax[_-]?invoice/i, type: "invoice", weight: 1.0 },
	{ pattern: /receipt/i, type: "invoice", weight: 0.8 },
	{ pattern: /bill/i, type: "invoice", weight: 0.6 },
	{ pattern: /statement/i, type: "invoice", weight: 0.5 },

	// Booking patterns
	{ pattern: /booking/i, type: "booking", weight: 1.0 },
	{ pattern: /reservation/i, type: "booking", weight: 1.0 },
	{ pattern: /confirmation/i, type: "booking", weight: 0.7 },
	{ pattern: /itinerary/i, type: "booking", weight: 0.9 },
	{ pattern: /e[_-]?ticket/i, type: "booking", weight: 1.0 },
	{ pattern: /boarding[_-]?pass/i, type: "booking", weight: 1.0 },
	{ pattern: /flight/i, type: "booking", weight: 0.8 },
	{ pattern: /hotel/i, type: "booking", weight: 0.7 },
];

// =============================================================================
// Content Markers
// =============================================================================

/**
 * Markers for detecting document type from content.
 */
const CONTENT_MARKERS: ReadonlyArray<{
	marker: string | RegExp;
	type: string;
	weight: number;
}> = [
	// Invoice markers
	{ marker: /TAX\s+INVOICE/i, type: "invoice", weight: 1.0 },
	{ marker: /Invoice\s+Number/i, type: "invoice", weight: 0.9 },
	{ marker: /Invoice\s+#/i, type: "invoice", weight: 0.9 },
	{ marker: /Amount\s+Due/i, type: "invoice", weight: 0.7 },
	{ marker: /Total\s+Amount/i, type: "invoice", weight: 0.6 },
	{ marker: /ABN[:.\s]/i, type: "invoice", weight: 0.8 }, // Australian Business Number
	{ marker: /GST/i, type: "invoice", weight: 0.5 },
	{ marker: /Subtotal/i, type: "invoice", weight: 0.4 },

	// Booking markers
	{ marker: /Flight\s+Confirmation/i, type: "booking", weight: 1.0 },
	{ marker: /Booking\s+Reference/i, type: "booking", weight: 1.0 },
	{ marker: /Confirmation\s+Number/i, type: "booking", weight: 0.9 },
	{ marker: /Hotel\s+Reservation/i, type: "booking", weight: 1.0 },
	{ marker: /Check-?in/i, type: "booking", weight: 0.6 },
	{ marker: /Check-?out/i, type: "booking", weight: 0.6 },
	{ marker: /Passenger/i, type: "booking", weight: 0.7 },
	{ marker: /Departure/i, type: "booking", weight: 0.5 },
	{ marker: /Arrival/i, type: "booking", weight: 0.5 },
	{ marker: /E-?Ticket/i, type: "booking", weight: 0.9 },
	{ marker: /Boarding\s+Pass/i, type: "booking", weight: 1.0 },
	{ marker: /Flight\s+Number/i, type: "booking", weight: 0.8 },
];

// =============================================================================
// pdftotext Check
// =============================================================================

/**
 * Check if pdftotext CLI is available.
 *
 * @returns Check result with availability and optional error message
 */
export async function checkPdfToText(): Promise<PdfToTextCheck> {
	try {
		const result = await $`which pdftotext`.quiet();

		if (result.exitCode === 0) {
			// Try to get version
			try {
				const versionResult = await $`pdftotext -v 2>&1 || true`.quiet();
				const versionMatch = versionResult.text().match(/version\s+([\d.]+)/i);
				return {
					available: true,
					version: versionMatch?.[1],
				};
			} catch {
				return { available: true };
			}
		}

		return {
			available: false,
			error: "pdftotext not found. Install with: brew install poppler",
		};
	} catch {
		return {
			available: false,
			error: "pdftotext not found. Install with: brew install poppler",
		};
	}
}

// =============================================================================
// PDF Text Extraction
// =============================================================================

/**
 * Extract text content from a PDF file using pdftotext.
 *
 * @param filePath - Path to the PDF file
 * @param cid - Correlation ID for logging
 * @returns Extracted text content
 * @throws InboxError if extraction fails
 */
export async function extractPdfText(
	filePath: string,
	cid: string,
): Promise<string> {
	log.debug`Extracting PDF text from=${filePath} ${cid}`;

	// Check pdftotext availability
	const check = await checkPdfToText();
	if (!check.available) {
		throw createInboxError("DEP_PDFTOTEXT_MISSING", {
			cid,
			source: filePath,
		});
	}

	// Check file size (pre-extraction)
	let preExtractionStats: { size: number } | undefined;
	try {
		preExtractionStats = await stat(filePath);
		if (preExtractionStats.size > MAX_PDF_SIZE) {
			throw createInboxError("EXT_PDF_TOO_LARGE", {
				cid,
				source: filePath,
				fileSize: preExtractionStats.size,
				maxSize: MAX_PDF_SIZE,
			});
		}

		log.debug`PDF file size=${preExtractionStats.size} bytes ${cid}`;
	} catch (error) {
		if (error instanceof InboxError) throw error;

		throw createInboxError("EXT_PDF_CORRUPT", {
			cid,
			source: filePath,
			originalError: String(error),
		});
	}

	// Extract text with timeout
	const startTime = Date.now();
	let proc: ReturnType<typeof Bun.spawn> | null = null;
	let timeoutId: Timer | null = null;

	try {
		// Set up timeout that will kill the subprocess
		timeoutId = setTimeout(() => {
			if (proc && !proc.killed) {
				log.warn`PDF extraction timeout, killing subprocess ${cid}`;
				proc.kill();
			}
		}, EXTRACTION_TIMEOUT);

		// Spawn pdftotext subprocess
		proc = Bun.spawn(["pdftotext", "-layout", filePath, "-"], {
			stdout: "pipe",
			stderr: "pipe",
		});

		// Wait for extraction to complete
		const exitCode = await proc.exited;
		clearTimeout(timeoutId);
		timeoutId = null;

		if (exitCode !== 0) {
			const stderr =
				proc.stderr && typeof proc.stderr !== "number"
					? await new Response(proc.stderr).text()
					: "unknown error";
			throw new Error(`pdftotext failed with exit code ${exitCode}: ${stderr}`);
		}

		if (!proc.stdout || typeof proc.stdout === "number") {
			throw new Error("pdftotext stdout is not available");
		}

		// Stream stdout and check accumulated size to prevent OOM
		const reader = proc.stdout.getReader();
		const chunks: Uint8Array[] = [];
		let totalSize = 0;

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				totalSize += value.length;
				if (totalSize > MAX_TEXT_SIZE) {
					throw createInboxError("EXT_PDF_TOO_LARGE", {
						cid,
						source: filePath,
						fileSize: totalSize,
						maxSize: MAX_TEXT_SIZE,
						reason: "extracted text exceeds limit",
					});
				}
				chunks.push(value);
			}
		} finally {
			reader.releaseLock();
		}

		// Concatenate chunks and decode to string
		const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
		const combined = new Uint8Array(totalLength);
		let offset = 0;
		for (const chunk of chunks) {
			combined.set(chunk, offset);
			offset += chunk.length;
		}

		const text = new TextDecoder().decode(combined).trim();
		const durationMs = Date.now() - startTime;

		log.info`PDF extraction complete source=${basename(filePath)} textLength=${text.length} durationMs=${durationMs} ${cid}`;

		if (text.length === 0) {
			throw createInboxError("EXT_PDF_EMPTY", {
				cid,
				source: filePath,
			});
		}

		// Post-extraction verification: detect TOCTOU attacks
		try {
			const postExtractionStats = await stat(filePath);
			if (postExtractionStats.size > MAX_PDF_SIZE) {
				throw createInboxError("EXT_PDF_CORRUPT", {
					cid,
					source: filePath,
					originalError: `File size changed during extraction (possible TOCTOU attack): ${preExtractionStats.size} → ${postExtractionStats.size} bytes`,
				});
			}

			// Log if size changed significantly (even if still under limit)
			const sizeDiff = Math.abs(
				postExtractionStats.size - preExtractionStats.size,
			);
			if (sizeDiff > 0) {
				log.debug`File size changed during extraction: ${preExtractionStats.size} → ${postExtractionStats.size} bytes ${cid}`;
			}
		} catch (error) {
			if (error instanceof InboxError) throw error;

			// File was deleted or moved - that's fine, we already extracted
			log.debug`File no longer accessible after extraction, proceeding ${cid}`;
		}

		return text;
	} catch (error) {
		if (error instanceof InboxError) throw error;

		// Check if process was killed by timeout
		if (proc?.killed) {
			throw createInboxError("EXT_PDF_TIMEOUT", {
				cid,
				source: filePath,
				timeout: EXTRACTION_TIMEOUT,
			});
		}

		throw createInboxError("EXT_PDF_CORRUPT", {
			cid,
			source: filePath,
			originalError: String(error),
		});
	} finally {
		// Safety net: ensure subprocess is killed on any exit path
		if (timeoutId !== null) {
			clearTimeout(timeoutId);
		}
		if (proc && !proc.killed) {
			proc.kill();
		}
	}
}

// =============================================================================
// Heuristic Detection
// =============================================================================

/**
 * Detect document type from filename patterns.
 *
 * @param filename - Filename to analyze (with or without path)
 * @returns Detection result with type and confidence
 */
export function detectByFilename(filename: string): HeuristicResult {
	const name = basename(filename).toLowerCase();
	const matches: Array<{ type: string; weight: number; pattern: string }> = [];

	for (const { pattern, type, weight } of FILENAME_PATTERNS) {
		if (pattern.test(name)) {
			matches.push({ type, weight, pattern: pattern.source });
		}
	}

	if (matches.length === 0) {
		return { detected: false, confidence: 0 };
	}

	// Group by type and sum weights
	const typeScores = new Map<string, number>();
	for (const match of matches) {
		const current = typeScores.get(match.type) ?? 0;
		typeScores.set(match.type, current + match.weight);
	}

	// Find best type
	let bestType = "";
	let bestScore = 0;
	for (const [type, score] of typeScores) {
		if (score > bestScore) {
			bestType = type;
			bestScore = score;
		}
	}

	// Normalize confidence (cap at 1.0)
	const confidence = Math.min(bestScore / 2, 1.0);

	return {
		detected: true,
		suggestedType: bestType,
		confidence,
		matchedPatterns: matches.map((m) => m.pattern),
	};
}

/**
 * Detect document type from content markers.
 *
 * @param content - Text content to analyze
 * @returns Detection result with type and confidence
 */
export function detectByContent(content: string): HeuristicResult {
	const matches: Array<{ type: string; weight: number; marker: string }> = [];
	let hasStrongSignal = false;

	for (const { marker, type, weight } of CONTENT_MARKERS) {
		const regex = typeof marker === "string" ? new RegExp(marker, "i") : marker;
		const match = content.match(regex);
		if (match) {
			matches.push({
				type,
				weight,
				marker: match[0],
			});
			if (weight >= 0.9) {
				hasStrongSignal = true;
			}
		}
	}

	if (matches.length === 0) {
		return { detected: false, confidence: 0 };
	}

	// Group by type and sum weights
	const typeScores = new Map<string, number>();
	for (const match of matches) {
		const current = typeScores.get(match.type) ?? 0;
		typeScores.set(match.type, current + match.weight);
	}

	// Find best type
	let bestType = "";
	let bestScore = 0;
	for (const [type, score] of typeScores) {
		if (score > bestScore) {
			bestType = type;
			bestScore = score;
		}
	}

	// Confidence based on match count and weights
	// More markers = higher confidence
	let confidence = Math.min(bestScore / 3, 1.0);

	// CRITICAL: Penalize confidence if no strong signal present
	if (!hasStrongSignal && confidence > 0.5) {
		confidence *= 0.6; // 40% penalty for weak-only detection
	}

	return {
		detected: true,
		suggestedType: bestType,
		confidence,
		matchedPatterns: matches.map((m) => m.marker),
	};
}

/**
 * Combine filename and content heuristics for overall detection.
 *
 * @param filename - Filename to analyze
 * @param content - Text content to analyze
 * @returns Combined detection result
 */
export function combineHeuristics(
	filename: string,
	content: string,
): HeuristicResult {
	const filenameResult = detectByFilename(filename);
	const contentResult = detectByContent(content);

	// If both agree, high confidence
	if (
		filenameResult.detected &&
		contentResult.detected &&
		filenameResult.suggestedType === contentResult.suggestedType
	) {
		return {
			detected: true,
			suggestedType: filenameResult.suggestedType,
			confidence: Math.min(
				(filenameResult.confidence + contentResult.confidence) / 1.5,
				1.0,
			),
			matchedPatterns: [
				...(filenameResult.matchedPatterns ?? []),
				...(contentResult.matchedPatterns ?? []),
			],
		};
	}

	// If only content detected (stronger signal for content)
	if (contentResult.detected && contentResult.confidence > 0.5) {
		return contentResult;
	}

	// If only filename detected
	if (filenameResult.detected) {
		return {
			...filenameResult,
			// Lower confidence if content didn't confirm
			confidence: filenameResult.confidence * 0.7,
		};
	}

	// Content detected but low confidence
	if (contentResult.detected) {
		return contentResult;
	}

	return { detected: false, confidence: 0 };
}
