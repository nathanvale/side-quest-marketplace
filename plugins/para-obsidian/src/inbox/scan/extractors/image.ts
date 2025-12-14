/**
 * Image Content Extractor
 *
 * Extracts text content from images using vision AI.
 * Currently a placeholder implementation that prepares the architecture
 * for when vision API support is available.
 *
 * Future integration options:
 * - Google Gemini Vision API (gemini-2.0-flash-exp)
 * - Claude Vision via API (claude-sonnet-4-20250514 with image support)
 * - Local OCR (Tesseract)
 *
 * @module extractors/image
 */

import { constants } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import { basename, extname } from "node:path";
import type { ContentExtractor, ExtractedContent, InboxFile } from "./types";

/** Supported image extensions */
export const IMAGE_EXTENSIONS = [
	".png",
	".jpg",
	".jpeg",
	".gif",
	".webp",
	".bmp",
	".tiff",
	".tif",
] as const;

export type ImageExtension = (typeof IMAGE_EXTENSIONS)[number];

/** Maximum file size for image extraction (50MB) */
export const MAX_IMAGE_SIZE_BYTES = 50 * 1024 * 1024;

/**
 * Image-specific metadata from extraction.
 */
export interface ImageExtractionMetadata {
	/** Image dimensions in pixels */
	dimensions?: { width: number; height: number };
	/** File size in bytes */
	fileSize: number;
	/** MIME type */
	mimeType: string;
	/** Whether OCR was used */
	ocrUsed?: boolean;
	/** Vision AI model used */
	visionModel?: string;
	/** Extraction confidence (0-1) */
	confidence?: number;
}

/**
 * Get MIME type for an image extension.
 */
export function getMimeType(extension: string): string {
	const mimeTypes: Record<string, string> = {
		".png": "image/png",
		".jpg": "image/jpeg",
		".jpeg": "image/jpeg",
		".gif": "image/gif",
		".webp": "image/webp",
		".bmp": "image/bmp",
		".tiff": "image/tiff",
		".tif": "image/tiff",
	};
	return mimeTypes[extension.toLowerCase()] ?? "application/octet-stream";
}

/**
 * Check if an extension is a supported image format.
 * Case-insensitive comparison.
 */
export function isImageExtension(ext: string): ext is ImageExtension {
	const normalizedExt = ext.toLowerCase() as ImageExtension;
	return IMAGE_EXTENSIONS.includes(normalizedExt);
}

/**
 * Check if a file exists and is readable.
 *
 * @param filePath - Path to file
 * @returns true if file exists and is readable
 */
async function fileExists(filePath: string): Promise<boolean> {
	try {
		await access(filePath, constants.R_OK);
		return true;
	} catch {
		return false;
	}
}

/**
 * Read image file as base64 for API calls.
 * Includes file existence and size validation.
 *
 * @param filePath - Path to image file
 * @returns Base64-encoded image data
 * @throws Error if file doesn't exist, is too large, or can't be read
 */
export async function readImageAsBase64(filePath: string): Promise<string> {
	// Check file exists first (TOCTOU mitigation - fail fast)
	if (!(await fileExists(filePath))) {
		throw new Error(`Image file not found: ${filePath}`);
	}

	// Check file size before reading
	const stats = await stat(filePath);
	if (stats.size > MAX_IMAGE_SIZE_BYTES) {
		throw new Error(
			`Image file too large: ${stats.size} bytes exceeds ${MAX_IMAGE_SIZE_BYTES} byte limit`,
		);
	}

	// Read file - may still fail due to TOCTOU, but we've minimized the window
	try {
		const buffer = await readFile(filePath);
		return buffer.toString("base64");
	} catch (error) {
		throw new Error(
			`Failed to read image file: ${filePath} - ${error instanceof Error ? error.message : "unknown error"}`,
		);
	}
}

/**
 * Get image file stats with existence validation.
 *
 * @param filePath - Path to image file
 * @returns File size in bytes
 * @throws Error if file doesn't exist or can't be read
 */
export async function getImageFileSize(filePath: string): Promise<number> {
	// Check file exists first
	if (!(await fileExists(filePath))) {
		throw new Error(`Image file not found: ${filePath}`);
	}

	try {
		const stats = await stat(filePath);
		return stats.size;
	} catch (error) {
		throw new Error(
			`Failed to get file stats: ${filePath} - ${error instanceof Error ? error.message : "unknown error"}`,
		);
	}
}

/**
 * Image content extractor using vision AI.
 *
 * Current status: PLACEHOLDER
 * This extractor is architecturally complete but returns unavailable
 * until we integrate a vision API.
 *
 * The extraction prompt is designed to:
 * 1. Extract any visible text (OCR)
 * 2. Describe the image content for classification
 * 3. Identify document type (receipt, screenshot, photo, diagram, etc.)
 *
 * @example
 * ```typescript
 * const file: InboxFile = {
 *   path: '/vault/Inbox/receipt.jpg',
 *   extension: '.jpg',
 *   filename: 'receipt.jpg',
 * };
 *
 * const availability = await imageExtractor.checkAvailability();
 * if (availability.available) {
 *   const content = await imageExtractor.extract(file, 'cid-123');
 *   console.log(content.text); // OCR text + image description
 * }
 * ```
 */
export const imageExtractor: ContentExtractor = {
	id: "image",
	displayName: "Image Extractor (Vision AI)",
	extensions: [...IMAGE_EXTENSIONS],

	canHandle(file: InboxFile): boolean {
		return isImageExtension(file.extension);
	},

	async checkAvailability(): Promise<{ available: boolean; error?: string }> {
		// TODO: Check for vision API availability
		// Options to implement:
		// 1. GOOGLE_AI_API_KEY env var for Gemini Vision
		// 2. ANTHROPIC_API_KEY env var for Claude Vision
		// 3. Local Tesseract for basic OCR

		const hasGeminiKey = !!process.env.GOOGLE_AI_API_KEY;
		const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;

		if (hasGeminiKey || hasAnthropicKey) {
			// For now, still return unavailable until we implement the actual API call
			return {
				available: false,
				error:
					"Vision API integration not yet implemented. API key detected but extraction logic pending.",
			};
		}

		return {
			available: false,
			error:
				"No vision API configured. Set GOOGLE_AI_API_KEY or ANTHROPIC_API_KEY environment variable.",
		};
	},

	async extract(file: InboxFile, _cid: string): Promise<ExtractedContent> {
		const startTime = Date.now();

		// Validate file exists before processing (TOCTOU mitigation)
		if (!(await fileExists(file.path))) {
			throw new Error(`Image file not found: ${file.path}`);
		}

		// Get file size with validation
		let fileSize: number;
		try {
			fileSize = await getImageFileSize(file.path);
		} catch (error) {
			throw new Error(
				`Failed to read image file: ${file.path} - ${error instanceof Error ? error.message : "unknown error"}`,
			);
		}

		// Check file size limit
		if (fileSize > MAX_IMAGE_SIZE_BYTES) {
			throw new Error(
				`Image file too large: ${file.filename} is ${Math.round(fileSize / 1024 / 1024)}MB, max is ${Math.round(MAX_IMAGE_SIZE_BYTES / 1024 / 1024)}MB`,
			);
		}

		const mimeType = getMimeType(file.extension);

		// TODO: Implement actual vision API call using VISION_EXTRACTION_PROMPT
		// The extraction should:
		// 1. Read image as base64: await readImageAsBase64(file.path)
		// 2. Call vision API with the prompt
		// 3. Parse structured response

		// Placeholder: Return a stub response indicating vision is not available
		// This allows the pipeline to handle images gracefully until vision is implemented
		const stubText = `[Image: ${file.filename}]
Unable to extract content - vision API not yet configured.
File type: ${mimeType}
Size: ${Math.round(fileSize / 1024)} KB

To enable image extraction, configure one of:
- GOOGLE_AI_API_KEY for Gemini Vision
- ANTHROPIC_API_KEY for Claude Vision`;

		return {
			text: stubText,
			source: "image",
			filePath: file.path,
			metadata: {
				durationMs: Date.now() - startTime,
				warnings: ["Vision API not configured - using placeholder extraction"],
			},
		};
	},
};

/**
 * Create an InboxFile from an image path.
 * Utility for converting raw paths to the InboxFile interface.
 */
export function createImageInboxFile(filePath: string): InboxFile {
	return {
		path: filePath,
		extension: extname(filePath).toLowerCase(),
		filename: basename(filePath),
	};
}

/**
 * Vision extraction prompt for future API integration.
 * Exported for use in tests and future implementation.
 */
export const VISION_EXTRACTION_PROMPT = `
Analyze this image and provide a structured extraction:

1. **OCR Text**: Extract ALL visible text from the image, preserving layout where possible.
   - Include headers, body text, labels, watermarks
   - Note any text that's partially visible or unclear

2. **Image Description**: Describe the visual content:
   - What type of image is this? (photo, screenshot, document scan, diagram, etc.)
   - What is the main subject or purpose?
   - Any notable visual elements?

3. **Classification Hints**: Provide hints for inbox triage:
   - Is this actionable? (receipt to file, task to create, reference material?)
   - Suggested PARA category: Project / Area / Resource / Archive
   - Any dates, amounts, or key identifiers visible?

Output format:
---
OCR_TEXT:
[extracted text]

DESCRIPTION:
[visual description]

CLASSIFICATION:
- Type: [document type]
- Actionable: [yes/no]
- Category hint: [PARA category]
- Key info: [dates, amounts, identifiers]
---
`.trim();
