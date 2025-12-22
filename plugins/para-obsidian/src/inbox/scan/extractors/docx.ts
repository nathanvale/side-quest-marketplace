/**
 * DOCX Content Extractor
 *
 * Extracts text content from Word documents (.docx) using mammoth library.
 * Provides both plain text (for classification) and formatted markdown
 * (for Type A document embedding in note bodies).
 *
 * @module extractors/docx
 */

import { readFile } from "node:fs/promises";
import mammoth from "mammoth";
import TurndownService from "turndown";
import { observe } from "../../../shared/instrumentation";
import { docxLogger } from "../../../shared/logger";
import type { OperationContext } from "../../shared/context";
import type { ContentExtractor, ExtractedContent, InboxFile } from "./types";

/**
 * Check if mammoth is available.
 * Since mammoth is a pure JS library, it should always be available
 * once installed.
 */
async function checkMammoth(): Promise<{ available: boolean; error?: string }> {
	try {
		// Mammoth is always available if the package is installed
		// No external dependencies needed
		return { available: true };
	} catch {
		return {
			available: false,
			error: "Mammoth library not available for DOCX extraction",
		};
	}
}

/**
 * Result of DOCX extraction containing both text and markdown.
 */
interface DocxExtractionResult {
	/** Plain text for classification */
	text: string;
	/** Formatted markdown for Type A embedding */
	markdown: string;
}

/**
 * Create and configure a Turndown service for DOCX conversion.
 * Uses GitHub Flavored Markdown settings for clean output.
 */
function createTurndownService(): TurndownService {
	const turndown = new TurndownService({
		headingStyle: "atx", // Use # for headings
		hr: "---",
		bulletListMarker: "-",
		codeBlockStyle: "fenced",
		emDelimiter: "*",
		strongDelimiter: "**",
	});

	return turndown;
}

/**
 * Extract both text and markdown from a DOCX file.
 *
 * @param filePath - Absolute path to the DOCX file
 * @param cid - Correlation ID for logging
 * @param parentCid - Optional parent correlation ID
 * @returns Extracted text and markdown content
 */
async function extractDocxContent(
	filePath: string,
	cid: string,
	_parentCid?: string,
): Promise<DocxExtractionResult> {
	const buffer = await readFile(filePath);

	// Extract plain text for classification
	const textResult = await mammoth.extractRawText({ buffer });

	if (textResult.messages.length > 0) {
		// Log warnings but don't fail
		for (const msg of textResult.messages) {
			docxLogger.warn`DOCX text extraction warning: ${msg.message} ${cid}`;
		}
	}

	// Extract HTML for markdown conversion
	const htmlResult = await mammoth.convertToHtml({ buffer });

	if (htmlResult.messages.length > 0) {
		// Log warnings but don't fail
		for (const msg of htmlResult.messages) {
			docxLogger.warn`DOCX HTML extraction warning: ${msg.message} ${cid}`;
		}
	}

	// Convert HTML to clean markdown
	const turndown = createTurndownService();
	const markdown = turndown.turndown(htmlResult.value);

	return {
		text: textResult.value.trim(),
		markdown: markdown.trim(),
	};
}

/**
 * DOCX content extractor using mammoth and turndown libraries.
 *
 * Extracts both plain text (for classification) and formatted markdown
 * (for Type A document embedding). The markdown preserves document structure
 * including headings, lists, emphasis, and tables.
 *
 * Requirements:
 * - mammoth npm package installed
 * - turndown npm package installed
 *
 * @example
 * ```typescript
 * const file: InboxFile = {
 *   path: '/vault/Inbox/resume.docx',
 *   extension: '.docx',
 *   filename: 'resume.docx',
 * };
 *
 * if (docxExtractor.canHandle(file)) {
 *   const content = await docxExtractor.extract(file, 'cid-123');
 *   console.log(content.text);     // Plain text for classification
 *   console.log(content.markdown); // Formatted markdown for embedding
 * }
 * ```
 */
export const docxExtractor: ContentExtractor = {
	id: "docx",
	displayName: "DOCX Extractor",
	extensions: [".docx"],

	canHandle(file: InboxFile): boolean {
		return file.extension.toLowerCase() === ".docx";
	},

	async checkAvailability(): Promise<{ available: boolean; error?: string }> {
		return checkMammoth();
	},

	async extract(
		file: InboxFile,
		cid: string,
		parentCid?: string,
		options?: OperationContext,
	): Promise<ExtractedContent> {
		const { sessionCid } = options ?? {};

		return await observe(
			docxLogger,
			"docx:extract",
			async () => {
				const { text, markdown } = await extractDocxContent(
					file.path,
					cid,
					parentCid,
				);

				return {
					text,
					markdown,
					source: "docx" as const,
					filePath: file.path,
					metadata: {},
				};
			},
			{
				parentCid,
				context: { filename: file.filename, sessionCid },
			},
		);
	},
};
