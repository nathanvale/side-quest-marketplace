/**
 * PDF Content Extractor
 *
 * Extracts text content from PDF files using pdftotext CLI.
 * Wraps the existing pdf-processor functions in the ContentExtractor interface.
 *
 * @module extractors/pdf
 */

import { basename, extname } from "node:path";
import { observe } from "../../../shared/instrumentation";
import { pdfLogger } from "../../../shared/logger";
import {
	checkPdfToText,
	extractPdfText,
} from "../../classify/detection/pdf-processor";
import type { OperationContext } from "../../shared/context";
import type { ContentExtractor, ExtractedContent, InboxFile } from "./types";

/**
 * PDF content extractor using pdftotext CLI.
 *
 * Requirements:
 * - pdftotext must be installed (brew install poppler on macOS)
 *
 * @example
 * ```typescript
 * const file: InboxFile = {
 *   path: '/vault/Inbox/invoice.pdf',
 *   extension: '.pdf',
 *   filename: 'invoice.pdf',
 * };
 *
 * if (pdfExtractor.canHandle(file)) {
 *   const content = await pdfExtractor.extract(file, 'cid-123');
 *   console.log(content.text); // Extracted PDF text
 * }
 * ```
 */
export const pdfExtractor: ContentExtractor = {
	id: "pdf",
	displayName: "PDF Extractor",
	extensions: [".pdf"],

	canHandle(file: InboxFile): boolean {
		return file.extension.toLowerCase() === ".pdf";
	},

	async checkAvailability(): Promise<{ available: boolean; error?: string }> {
		const result = await checkPdfToText();
		return {
			available: result.available,
			error: result.error,
		};
	},

	async extract(
		file: InboxFile,
		cid: string,
		parentCid?: string,
		options?: OperationContext,
	): Promise<ExtractedContent> {
		const { sessionCid } = options ?? {};

		return await observe(
			pdfLogger,
			"pdf:extract",
			async () => {
				// extractPdfText handles all validation and error cases
				const text = await extractPdfText(file.path, cid, parentCid);

				return {
					text,
					source: "pdf",
					filePath: file.path,
					metadata: {
						// durationMs removed - observe() tracks this automatically
					},
				};
			},
			{
				parentCid,
				context: { filename: file.filename, sessionCid },
			},
		);
	},
};

/**
 * Create an InboxFile from a file path.
 * Utility for converting raw paths to the InboxFile interface.
 */
export function createInboxFile(filePath: string): InboxFile {
	return {
		path: filePath,
		extension: extname(filePath).toLowerCase(),
		filename: basename(filePath),
	};
}
