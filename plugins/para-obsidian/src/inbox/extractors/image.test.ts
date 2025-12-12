/**
 * Image Extractor Tests
 *
 * Tests for the image content extractor.
 *
 * @module extractors/image.test
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	createImageInboxFile,
	getMimeType,
	IMAGE_EXTENSIONS,
	imageExtractor,
	isImageExtension,
} from "./image";
import type { InboxFile } from "./types";

describe("imageExtractor", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = join(tmpdir(), `image-extractor-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("metadata", () => {
		test("should have correct id", () => {
			expect(imageExtractor.id).toBe("image");
		});

		test("should have correct display name", () => {
			expect(imageExtractor.displayName).toBe("Image Extractor (Vision AI)");
		});

		test("should support common image extensions", () => {
			expect(imageExtractor.extensions).toContain(".png");
			expect(imageExtractor.extensions).toContain(".jpg");
			expect(imageExtractor.extensions).toContain(".jpeg");
			expect(imageExtractor.extensions).toContain(".gif");
			expect(imageExtractor.extensions).toContain(".webp");
		});
	});

	describe("canHandle", () => {
		test("should handle PNG files", () => {
			const file: InboxFile = {
				path: "/vault/Inbox/screenshot.png",
				extension: ".png",
				filename: "screenshot.png",
			};
			expect(imageExtractor.canHandle(file)).toBe(true);
		});

		test("should handle JPG files", () => {
			const file: InboxFile = {
				path: "/vault/Inbox/photo.jpg",
				extension: ".jpg",
				filename: "photo.jpg",
			};
			expect(imageExtractor.canHandle(file)).toBe(true);
		});

		test("should handle JPEG files", () => {
			const file: InboxFile = {
				path: "/vault/Inbox/photo.jpeg",
				extension: ".jpeg",
				filename: "photo.jpeg",
			};
			expect(imageExtractor.canHandle(file)).toBe(true);
		});

		test("should handle WebP files", () => {
			const file: InboxFile = {
				path: "/vault/Inbox/image.webp",
				extension: ".webp",
				filename: "image.webp",
			};
			expect(imageExtractor.canHandle(file)).toBe(true);
		});

		test("should handle uppercase extensions", () => {
			const file: InboxFile = {
				path: "/vault/Inbox/Screenshot.PNG",
				extension: ".PNG",
				filename: "Screenshot.PNG",
			};
			expect(imageExtractor.canHandle(file)).toBe(true);
		});

		test("should not handle PDF files", () => {
			const file: InboxFile = {
				path: "/vault/Inbox/document.pdf",
				extension: ".pdf",
				filename: "document.pdf",
			};
			expect(imageExtractor.canHandle(file)).toBe(false);
		});

		test("should not handle markdown files", () => {
			const file: InboxFile = {
				path: "/vault/Inbox/note.md",
				extension: ".md",
				filename: "note.md",
			};
			expect(imageExtractor.canHandle(file)).toBe(false);
		});
	});

	describe("checkAvailability", () => {
		test("should report unavailable without API keys", async () => {
			// Save original env vars
			const originalGoogle = process.env.GOOGLE_AI_API_KEY;
			const originalAnthropic = process.env.ANTHROPIC_API_KEY;

			// Clear env vars
			delete process.env.GOOGLE_AI_API_KEY;
			delete process.env.ANTHROPIC_API_KEY;

			try {
				const result = await imageExtractor.checkAvailability!();
				expect(result.available).toBe(false);
				expect(result.error).toContain("No vision API configured");
			} finally {
				// Restore env vars
				if (originalGoogle) process.env.GOOGLE_AI_API_KEY = originalGoogle;
				if (originalAnthropic)
					process.env.ANTHROPIC_API_KEY = originalAnthropic;
			}
		});

		test("should indicate pending implementation with API key", async () => {
			// Save original env var
			const originalGoogle = process.env.GOOGLE_AI_API_KEY;

			// Set a test API key
			process.env.GOOGLE_AI_API_KEY = "test-key-for-testing";

			try {
				const result = await imageExtractor.checkAvailability!();
				// Even with API key, should still be unavailable until implemented
				expect(result.available).toBe(false);
				expect(result.error).toContain("not yet implemented");
			} finally {
				// Restore env var
				if (originalGoogle) {
					process.env.GOOGLE_AI_API_KEY = originalGoogle;
				} else {
					delete process.env.GOOGLE_AI_API_KEY;
				}
			}
		});
	});

	describe("extract", () => {
		test("should return placeholder content for images", async () => {
			// Create a test image file (just bytes, doesn't need to be valid image)
			const imagePath = join(testDir, "test-image.png");
			writeFileSync(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47])); // PNG magic bytes

			const file: InboxFile = {
				path: imagePath,
				extension: ".png",
				filename: "test-image.png",
			};

			const result = await imageExtractor.extract(file, "test-cid");

			expect(result.source).toBe("image");
			expect(result.filePath).toBe(imagePath);
			expect(result.text).toContain("[Image: test-image.png]");
			expect(result.text).toContain("vision API not yet configured");
			expect(result.metadata?.warnings).toContain(
				"Vision API not configured - using placeholder extraction",
			);
		});

		test("should include file metadata in placeholder", async () => {
			const imagePath = join(testDir, "photo.jpg");
			// Create a ~1KB test file
			writeFileSync(imagePath, Buffer.alloc(1024, "x"));

			const file: InboxFile = {
				path: imagePath,
				extension: ".jpg",
				filename: "photo.jpg",
			};

			const result = await imageExtractor.extract(file, "test-cid");

			expect(result.text).toContain("image/jpeg");
			expect(result.text).toContain("1 KB");
		});

		test("should track extraction duration", async () => {
			const imagePath = join(testDir, "quick.png");
			writeFileSync(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

			const file: InboxFile = {
				path: imagePath,
				extension: ".png",
				filename: "quick.png",
			};

			const result = await imageExtractor.extract(file, "test-cid");

			expect(result.metadata?.durationMs).toBeDefined();
			expect(result.metadata!.durationMs).toBeGreaterThanOrEqual(0);
		});
	});
});

describe("isImageExtension", () => {
	test("should return true for supported extensions", () => {
		expect(isImageExtension(".png")).toBe(true);
		expect(isImageExtension(".jpg")).toBe(true);
		expect(isImageExtension(".jpeg")).toBe(true);
		expect(isImageExtension(".gif")).toBe(true);
		expect(isImageExtension(".webp")).toBe(true);
		expect(isImageExtension(".bmp")).toBe(true);
		expect(isImageExtension(".tiff")).toBe(true);
		expect(isImageExtension(".tif")).toBe(true);
	});

	test("should return true for uppercase extensions", () => {
		expect(isImageExtension(".PNG")).toBe(true);
		expect(isImageExtension(".JPG")).toBe(true);
	});

	test("should return false for non-image extensions", () => {
		expect(isImageExtension(".pdf")).toBe(false);
		expect(isImageExtension(".md")).toBe(false);
		expect(isImageExtension(".txt")).toBe(false);
		expect(isImageExtension(".doc")).toBe(false);
	});
});

describe("getMimeType", () => {
	test("should return correct MIME types", () => {
		expect(getMimeType(".png")).toBe("image/png");
		expect(getMimeType(".jpg")).toBe("image/jpeg");
		expect(getMimeType(".jpeg")).toBe("image/jpeg");
		expect(getMimeType(".gif")).toBe("image/gif");
		expect(getMimeType(".webp")).toBe("image/webp");
		expect(getMimeType(".bmp")).toBe("image/bmp");
		expect(getMimeType(".tiff")).toBe("image/tiff");
		expect(getMimeType(".tif")).toBe("image/tiff");
	});

	test("should handle uppercase extensions", () => {
		expect(getMimeType(".PNG")).toBe("image/png");
		expect(getMimeType(".JPG")).toBe("image/jpeg");
	});

	test("should return octet-stream for unknown extensions", () => {
		expect(getMimeType(".xyz")).toBe("application/octet-stream");
	});
});

describe("IMAGE_EXTENSIONS", () => {
	test("should include all common image formats", () => {
		expect(IMAGE_EXTENSIONS).toContain(".png");
		expect(IMAGE_EXTENSIONS).toContain(".jpg");
		expect(IMAGE_EXTENSIONS).toContain(".jpeg");
		expect(IMAGE_EXTENSIONS).toContain(".gif");
		expect(IMAGE_EXTENSIONS).toContain(".webp");
		expect(IMAGE_EXTENSIONS).toContain(".bmp");
		expect(IMAGE_EXTENSIONS).toContain(".tiff");
		expect(IMAGE_EXTENSIONS).toContain(".tif");
	});

	test("should have 8 extensions", () => {
		expect(IMAGE_EXTENSIONS.length).toBe(8);
	});
});

describe("createImageInboxFile", () => {
	test("should create InboxFile from path", () => {
		const file = createImageInboxFile("/vault/Inbox/screenshot.png");

		expect(file.path).toBe("/vault/Inbox/screenshot.png");
		expect(file.extension).toBe(".png");
		expect(file.filename).toBe("screenshot.png");
	});

	test("should handle uppercase extensions", () => {
		const file = createImageInboxFile("/vault/Inbox/Photo.JPG");

		expect(file.extension).toBe(".jpg");
		expect(file.filename).toBe("Photo.JPG");
	});

	test("should handle nested paths", () => {
		const file = createImageInboxFile(
			"/vault/00 Inbox/2024/12/receipt-scan.jpeg",
		);

		expect(file.path).toBe("/vault/00 Inbox/2024/12/receipt-scan.jpeg");
		expect(file.extension).toBe(".jpeg");
		expect(file.filename).toBe("receipt-scan.jpeg");
	});
});
