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

import { basename } from "node:path";
import { stat } from "@sidequest/core/fs";
import { $ } from "bun";
import { pdfLogger } from "../logger";
import type { InboxConverter } from "./converters";
import {
	DEFAULT_INBOX_CONVERTERS,
	findBestConverter,
	scoreContent,
	scoreFilename,
} from "./converters";
import { createInboxError, InboxError } from "./errors";

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
// Converter-Based Detection (NEW)
// =============================================================================

/**
 * Detect document type using converter heuristics.
 *
 * @param filename - Filename to analyze
 * @param content - Text content to analyze
 * @param converters - Array of converters to match against
 * @returns Detection result with type and confidence, or null if no match
 */
export function detectWithConverters(
	filename: string,
	content: string,
	converters: readonly InboxConverter[],
): { type: string; confidence: number } | null {
	const match = findBestConverter(converters, filename, content);
	if (!match) return null;
	return { type: match.converter.id, confidence: match.score };
}

// =============================================================================
// Heuristic Detection
// =============================================================================

/**
 * Detect document type from filename patterns using modern converter system.
 *
 * @param filename - Filename to analyze (with or without path)
 * @param converters - Optional array of converters to use (default: DEFAULT_INBOX_CONVERTERS)
 * @returns Detection result with type and confidence
 */
export function detectByFilename(
	filename: string,
	converters?: readonly InboxConverter[],
): HeuristicResult {
	// Use default converters if none provided
	const activeConverters = converters ?? DEFAULT_INBOX_CONVERTERS;
	const name = basename(filename);
	let bestScore = 0;
	let bestType = "";
	const matchedPatterns: string[] = [];

	for (const converter of activeConverters) {
		const score = scoreFilename(name, converter.heuristics.filenamePatterns);
		if (score > bestScore) {
			bestScore = score;
			bestType = converter.id;
			// Collect pattern info for debugging
			matchedPatterns.push(`${converter.id}(${score.toFixed(2)})`);
		}
	}

	if (bestScore === 0) {
		return { detected: false, confidence: 0 };
	}

	// Normalize confidence (0-1 scale)
	const confidence = Math.min(bestScore, 1.0);

	return {
		detected: true,
		suggestedType: bestType,
		confidence,
		matchedPatterns,
	};
}

/**
 * Detect document type from content markers using modern converter system.
 *
 * @param content - Text content to analyze
 * @param converters - Optional array of converters to use (default: DEFAULT_INBOX_CONVERTERS)
 * @returns Detection result with type and confidence
 */
export function detectByContent(
	content: string,
	converters?: readonly InboxConverter[],
): HeuristicResult {
	// Use default converters if none provided
	const activeConverters = converters ?? DEFAULT_INBOX_CONVERTERS;
	let bestScore = 0;
	let bestType = "";
	const matchedPatterns: string[] = [];

	for (const converter of activeConverters) {
		const score = scoreContent(content, converter.heuristics.contentMarkers);
		if (score > bestScore) {
			bestScore = score;
			bestType = converter.id;
			// Collect pattern info for debugging
			matchedPatterns.push(`${converter.id}(${score.toFixed(2)})`);
		}
	}

	if (bestScore === 0) {
		return { detected: false, confidence: 0 };
	}

	// Normalize confidence (0-1 scale)
	const confidence = Math.min(bestScore, 1.0);

	return {
		detected: true,
		suggestedType: bestType,
		confidence,
		matchedPatterns,
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
