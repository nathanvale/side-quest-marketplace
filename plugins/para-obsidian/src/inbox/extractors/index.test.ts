/**
 * Extractor Barrel Export Tests
 *
 * Tests for the extractors module index - verifies all exports are accessible.
 *
 * @module extractors/index.test
 */

import { describe, expect, test } from "bun:test";
import {
	// Types
	type ContentExtractor,
	// Registry
	createDefaultRegistry,
	// Image extractor
	createImageInboxFile,
	// Markdown extractor
	createMarkdownInboxFile,
	type ExtractedContent,
	type ExtractedMetadata,
	type ExtractionSource,
	type ExtractorMatch,
	ExtractorRegistry,
	extractFrontmatterOnly,
	getDefaultRegistry,
	getMimeType,
	IMAGE_EXTENSIONS,
	type ImageExtension,
	type ImageExtractionMetadata,
	type InboxFile,
	imageExtractor,
	isImageExtension,
	isMarkdownExtension,
	MARKDOWN_EXTENSIONS,
	type MarkdownExtension,
	type MarkdownExtractionMetadata,
	markdownExtractor,
	readImageAsBase64,
	resetDefaultRegistry,
	VISION_EXTRACTION_PROMPT,
} from "./index";

describe("extractors/index barrel exports", () => {
	describe("image extractor exports", () => {
		test("should export imageExtractor", () => {
			expect(imageExtractor).toBeDefined();
			expect(imageExtractor.id).toBe("image");
			expect(imageExtractor.displayName).toBe("Image Extractor (Vision AI)");
		});

		test("should export IMAGE_EXTENSIONS constant", () => {
			expect(IMAGE_EXTENSIONS).toBeDefined();
			expect(Array.isArray(IMAGE_EXTENSIONS)).toBe(true);
			expect(IMAGE_EXTENSIONS).toContain(".png");
			expect(IMAGE_EXTENSIONS).toContain(".jpg");
		});

		test("should export isImageExtension function", () => {
			expect(typeof isImageExtension).toBe("function");
			expect(isImageExtension(".png")).toBe(true);
			expect(isImageExtension(".pdf")).toBe(false);
		});

		test("should export getMimeType function", () => {
			expect(typeof getMimeType).toBe("function");
			expect(getMimeType(".png")).toBe("image/png");
			expect(getMimeType(".jpg")).toBe("image/jpeg");
		});

		test("should export createImageInboxFile function", () => {
			expect(typeof createImageInboxFile).toBe("function");
			const file = createImageInboxFile("/vault/Inbox/test.png");
			expect(file.path).toBe("/vault/Inbox/test.png");
			expect(file.extension).toBe(".png");
		});

		test("should export readImageAsBase64 function", () => {
			expect(typeof readImageAsBase64).toBe("function");
		});

		test("should export VISION_EXTRACTION_PROMPT constant", () => {
			expect(VISION_EXTRACTION_PROMPT).toBeDefined();
			expect(typeof VISION_EXTRACTION_PROMPT).toBe("string");
			expect(VISION_EXTRACTION_PROMPT.length).toBeGreaterThan(0);
		});
	});

	describe("markdown extractor exports", () => {
		test("should export markdownExtractor", () => {
			expect(markdownExtractor).toBeDefined();
			expect(markdownExtractor.id).toBe("markdown");
			expect(markdownExtractor.displayName).toBe("Markdown Extractor");
		});

		test("should export MARKDOWN_EXTENSIONS constant", () => {
			expect(MARKDOWN_EXTENSIONS).toBeDefined();
			expect(Array.isArray(MARKDOWN_EXTENSIONS)).toBe(true);
			expect(MARKDOWN_EXTENSIONS).toContain(".md");
			expect(MARKDOWN_EXTENSIONS).toContain(".markdown");
		});

		test("should export isMarkdownExtension function", () => {
			expect(typeof isMarkdownExtension).toBe("function");
			expect(isMarkdownExtension(".md")).toBe(true);
			expect(isMarkdownExtension(".pdf")).toBe(false);
		});

		test("should export createMarkdownInboxFile function", () => {
			expect(typeof createMarkdownInboxFile).toBe("function");
			const file = createMarkdownInboxFile("/vault/Inbox/note.md");
			expect(file.path).toBe("/vault/Inbox/note.md");
			expect(file.extension).toBe(".md");
		});

		test("should export extractFrontmatterOnly function", () => {
			expect(typeof extractFrontmatterOnly).toBe("function");
		});
	});

	describe("registry exports", () => {
		test("should export ExtractorRegistry class", () => {
			expect(ExtractorRegistry).toBeDefined();
			expect(typeof ExtractorRegistry).toBe("function");
		});

		test("should export createDefaultRegistry function", async () => {
			expect(typeof createDefaultRegistry).toBe("function");
			const registry = await createDefaultRegistry();
			expect(registry).toBeInstanceOf(ExtractorRegistry);
		});

		test("should export getDefaultRegistry function", async () => {
			expect(typeof getDefaultRegistry).toBe("function");
			const registry = await getDefaultRegistry();
			expect(registry).toBeInstanceOf(ExtractorRegistry);
		});

		test("should export resetDefaultRegistry function", () => {
			expect(typeof resetDefaultRegistry).toBe("function");
			// Should not throw
			resetDefaultRegistry();
		});
	});

	describe("type exports", () => {
		test("should allow InboxFile type usage", () => {
			const file: InboxFile = {
				path: "/test.png",
				extension: ".png",
				filename: "test.png",
			};
			expect(file.path).toBe("/test.png");
		});

		test("should allow ExtractedContent type usage", () => {
			const content: ExtractedContent = {
				source: "image" as ExtractionSource,
				filePath: "/test.png",
				text: "Test content",
			};
			expect(content.source).toBe("image");
		});

		test("should allow ExtractedMetadata type usage", () => {
			const metadata: ExtractedMetadata = {
				durationMs: 100,
			};
			expect(metadata.durationMs).toBe(100);
		});

		test("should allow ContentExtractor type usage", () => {
			const extractor: ContentExtractor = {
				id: "test",
				displayName: "Test Extractor",
				extensions: [".test"],
				canHandle: () => true,
				extract: async () => ({
					source: "markdown",
					filePath: "/test.md",
					text: "Test",
				}),
			};
			expect(extractor.id).toBe("test");
		});

		test("should allow ExtractorMatch type usage", () => {
			const match: ExtractorMatch = {
				extractor: imageExtractor,
				file: {
					path: "/test.png",
					extension: ".png",
					filename: "test.png",
				},
			};
			expect(match.extractor.id).toBe("image");
		});

		test("should allow ExtractionSource type usage", () => {
			const source1: ExtractionSource = "markdown";
			const source2: ExtractionSource = "image";
			const source3: ExtractionSource = "pdf";
			expect(source1).toBe("markdown");
			expect(source2).toBe("image");
			expect(source3).toBe("pdf");
		});

		test("should allow ImageExtension type usage", () => {
			const ext1: ImageExtension = ".png";
			const ext2: ImageExtension = ".jpg";
			const ext3: ImageExtension = ".jpeg";
			expect(ext1).toBe(".png");
			expect(ext2).toBe(".jpg");
			expect(ext3).toBe(".jpeg");
		});

		test("should allow MarkdownExtension type usage", () => {
			const ext1: MarkdownExtension = ".md";
			const ext2: MarkdownExtension = ".markdown";
			const ext3: MarkdownExtension = ".mdown";
			expect(ext1).toBe(".md");
			expect(ext2).toBe(".markdown");
			expect(ext3).toBe(".mdown");
		});

		test("should allow ImageExtractionMetadata type usage", () => {
			const metadata: ImageExtractionMetadata = {
				mimeType: "image/png",
				fileSize: 1024,
			};
			expect(metadata.mimeType).toBe("image/png");
			expect(metadata.fileSize).toBe(1024);
		});

		test("should allow MarkdownExtractionMetadata type usage", () => {
			const metadata: MarkdownExtractionMetadata = {
				hasFrontmatter: true,
				hasBody: true,
				wordCount: 100,
				charCount: 500,
				lineCount: 10,
				title: "Test Note",
				tags: ["tag1", "tag2"],
				frontmatterFields: ["title", "tags"],
			};
			expect(metadata.title).toBe("Test Note");
			expect(metadata.tags).toEqual(["tag1", "tag2"]);
		});
	});

	describe("integration - registry with extractors", () => {
		test("should be able to register and retrieve extractors", async () => {
			const registry = await createDefaultRegistry();

			// Registry should start with built-in extractors
			const imageMatch = registry.findExtractor({
				path: "/test.png",
				extension: ".png",
				filename: "test.png",
			});
			expect(imageMatch).toBeDefined();
			expect(imageMatch?.extractor.id).toBe("image");

			const markdownMatch = registry.findExtractor({
				path: "/test.md",
				extension: ".md",
				filename: "test.md",
			});
			expect(markdownMatch).toBeDefined();
			expect(markdownMatch?.extractor.id).toBe("markdown");
		});

		test("should be able to get all extractors from registry", async () => {
			const registry = await createDefaultRegistry();
			const extractors = registry.getAll();

			expect(extractors.length).toBeGreaterThan(0);
			const extractorIds = extractors.map((e: ContentExtractor) => e.id);
			expect(extractorIds).toContain("image");
			expect(extractorIds).toContain("markdown");
		});
	});
});
