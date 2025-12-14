/**
 * Content Extractor Types
 *
 * Defines the interfaces for Stage 1 of the inbox processing pipeline:
 * format-specific content extraction from various input sources.
 *
 * The key insight: LLM doesn't care about source format - it just needs
 * text/content to classify and extract. Extractors bridge the gap between
 * source formats (PDF, image, markdown) and the format-agnostic LLM stage.
 *
 * @module extractors/types
 */

// =============================================================================
// Input Types
// =============================================================================

/**
 * Represents a file in the inbox awaiting processing.
 */
export interface InboxFile {
	/** Absolute path to the file */
	readonly path: string;
	/** File extension including dot (e.g., '.pdf', '.png') */
	readonly extension: string;
	/** Filename without path (basename) */
	readonly filename: string;
	/** File size in bytes (optional, for filtering large files) */
	readonly size?: number;
}

// =============================================================================
// Output Types
// =============================================================================

/**
 * Source type indicating how content was extracted.
 */
export type ExtractionSource = "pdf" | "image" | "markdown" | "text";

/**
 * Result of content extraction from a file.
 */
export interface ExtractedContent {
	/** Extracted text content for LLM processing */
	readonly text: string;
	/** How the content was extracted */
	readonly source: ExtractionSource;
	/** Original file path */
	readonly filePath: string;
	/** Optional metadata from extraction (e.g., page count, image dimensions) */
	readonly metadata?: ExtractedMetadata;
}

/**
 * Optional metadata from extraction process.
 */
export interface ExtractedMetadata {
	/** Number of pages (PDF) */
	readonly pageCount?: number;
	/** Image dimensions (image) */
	readonly dimensions?: { width: number; height: number };
	/** Whether content was truncated */
	readonly truncated?: boolean;
	/** Original content length before truncation */
	readonly originalLength?: number;
	/** Extraction duration in milliseconds */
	readonly durationMs?: number;
	/** Any extraction warnings */
	readonly warnings?: readonly string[];
}

// =============================================================================
// Extractor Interface
// =============================================================================

/**
 * Content extractor for a specific file format.
 *
 * Extractors are Stage 1 of the inbox processing pipeline. They convert
 * format-specific files into text that can be processed by the LLM.
 *
 * @example
 * ```typescript
 * const pdfExtractor: ContentExtractor = {
 *   id: 'pdf',
 *   displayName: 'PDF Extractor',
 *   extensions: ['.pdf'],
 *   canHandle: (file) => file.extension === '.pdf',
 *   extract: async (file, cid) => {
 *     const text = await extractPdfText(file.path, cid);
 *     return { text, source: 'pdf', filePath: file.path };
 *   },
 * };
 * ```
 */
export interface ContentExtractor {
	/** Unique identifier for this extractor */
	readonly id: string;

	/** Human-readable name for display */
	readonly displayName: string;

	/** File extensions this extractor handles (e.g., ['.pdf']) */
	readonly extensions: readonly string[];

	/**
	 * Check if this extractor can handle a file.
	 * Usually based on file extension, but can include other checks.
	 */
	canHandle(file: InboxFile): boolean;

	/**
	 * Check if the extractor's dependencies are available.
	 * For example, PDF extractor checks if pdftotext is installed.
	 *
	 * @returns Object with availability status and optional error message
	 */
	checkAvailability?(): Promise<{ available: boolean; error?: string }>;

	/**
	 * Extract text content from a file.
	 *
	 * @param file - The inbox file to extract from
	 * @param cid - Correlation ID for logging
	 * @returns Extracted content with text and metadata
	 * @throws Error if extraction fails
	 */
	extract(file: InboxFile, cid: string): Promise<ExtractedContent>;
}

// =============================================================================
// Registry Types
// =============================================================================

/**
 * Result of finding an extractor for a file.
 */
export interface ExtractorMatch {
	/** The matched extractor */
	readonly extractor: ContentExtractor;
	/** The file that was matched */
	readonly file: InboxFile;
}
