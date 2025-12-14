/**
 * Content Extractors
 *
 * Stage 1 of the inbox processing pipeline: format-specific content extraction.
 *
 * @module extractors
 */

export type { ImageExtension, ImageExtractionMetadata } from "./image";
// Extractors
export {
	createImageInboxFile,
	getMimeType,
	IMAGE_EXTENSIONS,
	imageExtractor,
	isImageExtension,
	readImageAsBase64,
	VISION_EXTRACTION_PROMPT,
} from "./image";
export type { MarkdownExtension, MarkdownExtractionMetadata } from "./markdown";
export {
	createMarkdownInboxFile,
	extractFrontmatterOnly,
	isMarkdownExtension,
	MARKDOWN_EXTENSIONS,
	markdownExtractor,
} from "./markdown";
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
