/**
 * Scan functionality for reading and extracting content from inbox files
 */

export {
	createImageInboxFile,
	getMimeType,
	IMAGE_EXTENSIONS,
	imageExtractor,
	isImageExtension,
	readImageAsBase64,
	VISION_EXTRACTION_PROMPT,
} from "./extractors/image";
export {
	createMarkdownInboxFile,
	extractFrontmatterOnly,
	isMarkdownExtension,
	MARKDOWN_EXTENSIONS,
	markdownExtractor,
} from "./extractors/markdown";
export { createInboxFile, pdfExtractor } from "./extractors/pdf";
export {
	createDefaultRegistry,
	ExtractorRegistry,
	getDefaultRegistry,
	resetDefaultRegistry,
} from "./extractors/registry";
// Re-export extractors functionality until we move the files
export type {
	ContentExtractor,
	ExtractedContent,
	ExtractedMetadata,
	ExtractionSource,
	ExtractorMatch,
	InboxFile,
} from "./extractors/types";
