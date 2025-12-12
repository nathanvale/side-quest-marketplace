/**
 * Content Extractors
 *
 * Stage 1 of the inbox processing pipeline: format-specific content extraction.
 *
 * @module extractors
 */

// Extractors
export { createInboxFile, pdfExtractor } from "./pdf";

// Registry
export {
	createDefaultRegistry,
	ExtractorRegistry,
	getDefaultRegistry,
	resetDefaultRegistry,
} from "./registry";

// Types
export type {
	ContentExtractor,
	ExtractedContent,
	ExtractedMetadata,
	ExtractionSource,
	ExtractorMatch,
	InboxFile,
} from "./types";
