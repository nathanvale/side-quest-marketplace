/**
 * Extractor Registry Tests
 *
 * Tests for the ExtractorRegistry class and factory functions.
 *
 * @module extractors/registry.test
 */

import { afterEach, describe, expect, test } from "bun:test";
import {
	createDefaultRegistry,
	ExtractorRegistry,
	getDefaultRegistry,
	resetDefaultRegistry,
} from "./registry";
import type { ContentExtractor, ExtractedContent, InboxFile } from "./types";

// =============================================================================
// Test Helpers
// =============================================================================

/** Create a mock extractor for testing */
function createMockExtractor(
	id: string,
	extensions: string[],
	options: {
		canHandleFn?: (file: InboxFile) => boolean;
		checkAvailability?: () => Promise<{ available: boolean; error?: string }>;
	} = {},
): ContentExtractor {
	return {
		id,
		displayName: `${id} Extractor`,
		extensions,
		canHandle:
			options.canHandleFn ??
			((file) => extensions.includes(file.extension.toLowerCase())),
		checkAvailability: options.checkAvailability,
		extract: async (
			file: InboxFile,
			_cid: string,
		): Promise<ExtractedContent> => ({
			text: `Extracted from ${file.filename}`,
			source: "text",
			filePath: file.path,
		}),
	};
}

/** Create an InboxFile for testing */
function createTestFile(filename: string, extension: string): InboxFile {
	return {
		path: `/vault/Inbox/${filename}`,
		extension,
		filename,
	};
}

// =============================================================================
// Tests
// =============================================================================

describe("extractors/registry", () => {
	describe("ExtractorRegistry", () => {
		describe("register", () => {
			test("should register an extractor", () => {
				const registry = new ExtractorRegistry();
				const extractor = createMockExtractor("pdf", [".pdf"]);

				registry.register(extractor);

				expect(registry.size).toBe(1);
				expect(registry.get("pdf")).toBe(extractor);
			});

			test("should register multiple extractors", () => {
				const registry = new ExtractorRegistry();
				const pdfExtractor = createMockExtractor("pdf", [".pdf"]);
				const imageExtractor = createMockExtractor("image", [".png", ".jpg"]);

				registry.register(pdfExtractor);
				registry.register(imageExtractor);

				expect(registry.size).toBe(2);
				expect(registry.get("pdf")).toBe(pdfExtractor);
				expect(registry.get("image")).toBe(imageExtractor);
			});

			test("should throw error for duplicate ID", () => {
				const registry = new ExtractorRegistry();
				const extractor1 = createMockExtractor("pdf", [".pdf"]);
				const extractor2 = createMockExtractor("pdf", [".doc"]);

				registry.register(extractor1);

				expect(() => registry.register(extractor2)).toThrow(
					"Extractor with ID 'pdf' is already registered",
				);
			});

			test("should allow registering extractors with same extensions but different IDs", () => {
				const registry = new ExtractorRegistry();
				const extractor1 = createMockExtractor("pdf-basic", [".pdf"]);
				const extractor2 = createMockExtractor("pdf-advanced", [".pdf"]);

				registry.register(extractor1);
				registry.register(extractor2);

				expect(registry.size).toBe(2);
			});
		});

		describe("unregister", () => {
			test("should remove registered extractor", () => {
				const registry = new ExtractorRegistry();
				const extractor = createMockExtractor("pdf", [".pdf"]);
				registry.register(extractor);

				const result = registry.unregister("pdf");

				expect(result).toBe(true);
				expect(registry.size).toBe(0);
				expect(registry.get("pdf")).toBeUndefined();
			});

			test("should return false for non-existent ID", () => {
				const registry = new ExtractorRegistry();

				const result = registry.unregister("non-existent");

				expect(result).toBe(false);
			});

			test("should only remove specified extractor", () => {
				const registry = new ExtractorRegistry();
				registry.register(createMockExtractor("pdf", [".pdf"]));
				registry.register(createMockExtractor("image", [".png"]));

				registry.unregister("pdf");

				expect(registry.size).toBe(1);
				expect(registry.get("image")).toBeDefined();
			});
		});

		describe("get", () => {
			test("should return extractor by ID", () => {
				const registry = new ExtractorRegistry();
				const extractor = createMockExtractor("pdf", [".pdf"]);
				registry.register(extractor);

				expect(registry.get("pdf")).toBe(extractor);
			});

			test("should return undefined for non-existent ID", () => {
				const registry = new ExtractorRegistry();

				expect(registry.get("non-existent")).toBeUndefined();
			});
		});

		describe("findExtractor", () => {
			test("should find extractor for matching file", () => {
				const registry = new ExtractorRegistry();
				const pdfExtractor = createMockExtractor("pdf", [".pdf"]);
				registry.register(pdfExtractor);

				const file = createTestFile("invoice.pdf", ".pdf");
				const match = registry.findExtractor(file);

				expect(match).not.toBeNull();
				expect(match?.extractor).toBe(pdfExtractor);
				expect(match?.file).toBe(file);
			});

			test("should return null for no matching extractor", () => {
				const registry = new ExtractorRegistry();
				registry.register(createMockExtractor("pdf", [".pdf"]));

				const file = createTestFile("document.docx", ".docx");
				const match = registry.findExtractor(file);

				expect(match).toBeNull();
			});

			test("should return first matching extractor", () => {
				const registry = new ExtractorRegistry();
				const extractor1 = createMockExtractor("pdf-basic", [".pdf"]);
				const extractor2 = createMockExtractor("pdf-advanced", [".pdf"]);
				registry.register(extractor1);
				registry.register(extractor2);

				const file = createTestFile("invoice.pdf", ".pdf");
				const match = registry.findExtractor(file);

				// First registered extractor should be returned
				expect(match?.extractor).toBe(extractor1);
			});

			test("should use canHandle for matching", () => {
				const registry = new ExtractorRegistry();
				const extractor = createMockExtractor("custom", [".txt"], {
					canHandleFn: (file) => file.filename.startsWith("special-"),
				});
				registry.register(extractor);

				const regularFile = createTestFile("document.txt", ".txt");
				const specialFile = createTestFile("special-doc.txt", ".txt");

				expect(registry.findExtractor(regularFile)).toBeNull();
				expect(registry.findExtractor(specialFile)?.extractor).toBe(extractor);
			});

			test("should return null for empty registry", () => {
				const registry = new ExtractorRegistry();

				const file = createTestFile("invoice.pdf", ".pdf");
				const match = registry.findExtractor(file);

				expect(match).toBeNull();
			});
		});

		describe("canHandle", () => {
			test("should return true when extractor exists for file", () => {
				const registry = new ExtractorRegistry();
				registry.register(createMockExtractor("pdf", [".pdf"]));

				const file = createTestFile("invoice.pdf", ".pdf");

				expect(registry.canHandle(file)).toBe(true);
			});

			test("should return false when no extractor exists for file", () => {
				const registry = new ExtractorRegistry();
				registry.register(createMockExtractor("pdf", [".pdf"]));

				const file = createTestFile("document.docx", ".docx");

				expect(registry.canHandle(file)).toBe(false);
			});

			test("should return false for empty registry", () => {
				const registry = new ExtractorRegistry();

				const file = createTestFile("invoice.pdf", ".pdf");

				expect(registry.canHandle(file)).toBe(false);
			});
		});

		describe("getSupportedExtensions", () => {
			test("should return empty array for empty registry", () => {
				const registry = new ExtractorRegistry();

				expect(registry.getSupportedExtensions()).toEqual([]);
			});

			test("should return all extensions from single extractor", () => {
				const registry = new ExtractorRegistry();
				registry.register(
					createMockExtractor("image", [".png", ".jpg", ".jpeg"]),
				);

				const extensions = registry.getSupportedExtensions();

				expect(extensions).toHaveLength(3);
				expect(extensions).toContain(".png");
				expect(extensions).toContain(".jpg");
				expect(extensions).toContain(".jpeg");
			});

			test("should return unique extensions across extractors", () => {
				const registry = new ExtractorRegistry();
				registry.register(createMockExtractor("pdf", [".pdf"]));
				registry.register(createMockExtractor("image", [".png", ".jpg"]));

				const extensions = registry.getSupportedExtensions();

				expect(extensions).toHaveLength(3);
				expect(extensions).toContain(".pdf");
				expect(extensions).toContain(".png");
				expect(extensions).toContain(".jpg");
			});

			test("should deduplicate extensions", () => {
				const registry = new ExtractorRegistry();
				registry.register(createMockExtractor("basic", [".txt", ".md"]));
				registry.register(
					createMockExtractor("advanced", [".md", ".markdown"]),
				);

				const extensions = registry.getSupportedExtensions();

				// .md should only appear once
				expect(extensions.filter((e) => e === ".md")).toHaveLength(1);
			});

			test("should normalize extensions to lowercase", () => {
				const registry = new ExtractorRegistry();
				registry.register(
					createMockExtractor("mixed", [".PDF", ".Png", ".jpg"]),
				);

				const extensions = registry.getSupportedExtensions();

				expect(extensions).toContain(".pdf");
				expect(extensions).toContain(".png");
				expect(extensions).toContain(".jpg");
				expect(extensions).not.toContain(".PDF");
			});
		});

		describe("getAll", () => {
			test("should return empty array for empty registry", () => {
				const registry = new ExtractorRegistry();

				expect(registry.getAll()).toEqual([]);
			});

			test("should return all registered extractors", () => {
				const registry = new ExtractorRegistry();
				const extractor1 = createMockExtractor("pdf", [".pdf"]);
				const extractor2 = createMockExtractor("image", [".png"]);
				registry.register(extractor1);
				registry.register(extractor2);

				const all = registry.getAll();

				expect(all).toHaveLength(2);
				expect(all).toContain(extractor1);
				expect(all).toContain(extractor2);
			});

			test("should return new array on each call", () => {
				const registry = new ExtractorRegistry();
				registry.register(createMockExtractor("pdf", [".pdf"]));

				const all1 = registry.getAll();
				const all2 = registry.getAll();

				expect(all1).not.toBe(all2);
				expect(all1).toEqual(all2);
			});
		});

		describe("size", () => {
			test("should return 0 for empty registry", () => {
				const registry = new ExtractorRegistry();

				expect(registry.size).toBe(0);
			});

			test("should return correct count", () => {
				const registry = new ExtractorRegistry();
				registry.register(createMockExtractor("pdf", [".pdf"]));
				registry.register(createMockExtractor("image", [".png"]));
				registry.register(createMockExtractor("markdown", [".md"]));

				expect(registry.size).toBe(3);
			});

			test("should update after unregister", () => {
				const registry = new ExtractorRegistry();
				registry.register(createMockExtractor("pdf", [".pdf"]));
				registry.register(createMockExtractor("image", [".png"]));

				expect(registry.size).toBe(2);

				registry.unregister("pdf");

				expect(registry.size).toBe(1);
			});
		});

		describe("checkAllAvailability", () => {
			test("should return empty map for empty registry", async () => {
				const registry = new ExtractorRegistry();

				const results = await registry.checkAllAvailability();

				expect(results.size).toBe(0);
			});

			test("should check availability of all extractors", async () => {
				const registry = new ExtractorRegistry();
				registry.register(
					createMockExtractor("pdf", [".pdf"], {
						checkAvailability: async () => ({ available: true }),
					}),
				);
				registry.register(
					createMockExtractor("image", [".png"], {
						checkAvailability: async () => ({
							available: false,
							error: "Vision API not configured",
						}),
					}),
				);

				const results = await registry.checkAllAvailability();

				expect(results.size).toBe(2);
				expect(results.get("pdf")).toEqual({ available: true });
				expect(results.get("image")).toEqual({
					available: false,
					error: "Vision API not configured",
				});
			});

			test("should assume available if checkAvailability not defined", async () => {
				const registry = new ExtractorRegistry();
				registry.register(createMockExtractor("simple", [".txt"]));

				const results = await registry.checkAllAvailability();

				expect(results.get("simple")).toEqual({ available: true });
			});

			test("should handle mixed extractors with/without checkAvailability", async () => {
				const registry = new ExtractorRegistry();
				registry.register(createMockExtractor("simple", [".txt"])); // No checkAvailability
				registry.register(
					createMockExtractor("complex", [".pdf"], {
						checkAvailability: async () => ({ available: true }),
					}),
				);

				const results = await registry.checkAllAvailability();

				expect(results.get("simple")).toEqual({ available: true });
				expect(results.get("complex")).toEqual({ available: true });
			});
		});
	});

	describe("createDefaultRegistry", () => {
		test("should create registry with default extractors", () => {
			const registry = createDefaultRegistry();

			expect(registry.size).toBe(3);
			expect(registry.get("pdf")).toBeDefined();
			expect(registry.get("image")).toBeDefined();
			expect(registry.get("markdown")).toBeDefined();
		});

		test("should support PDF files", () => {
			const registry = createDefaultRegistry();
			const file = createTestFile("invoice.pdf", ".pdf");

			expect(registry.canHandle(file)).toBe(true);
		});

		test("should support image files", () => {
			const registry = createDefaultRegistry();

			expect(registry.canHandle(createTestFile("photo.png", ".png"))).toBe(
				true,
			);
			expect(registry.canHandle(createTestFile("photo.jpg", ".jpg"))).toBe(
				true,
			);
			expect(registry.canHandle(createTestFile("photo.jpeg", ".jpeg"))).toBe(
				true,
			);
		});

		test("should support markdown files", () => {
			const registry = createDefaultRegistry();

			expect(registry.canHandle(createTestFile("notes.md", ".md"))).toBe(true);
			expect(
				registry.canHandle(createTestFile("doc.markdown", ".markdown")),
			).toBe(true);
		});

		test("should create new registry each time", () => {
			const registry1 = createDefaultRegistry();
			const registry2 = createDefaultRegistry();

			expect(registry1).not.toBe(registry2);
		});
	});

	describe("getDefaultRegistry", () => {
		afterEach(() => {
			resetDefaultRegistry();
		});

		test("should return singleton registry", () => {
			const registry1 = getDefaultRegistry();
			const registry2 = getDefaultRegistry();

			expect(registry1).toBe(registry2);
		});

		test("should have default extractors", () => {
			const registry = getDefaultRegistry();

			expect(registry.size).toBe(3);
			expect(registry.get("pdf")).toBeDefined();
			expect(registry.get("image")).toBeDefined();
			expect(registry.get("markdown")).toBeDefined();
		});
	});

	describe("resetDefaultRegistry", () => {
		test("should reset singleton to null", () => {
			const registry1 = getDefaultRegistry();
			resetDefaultRegistry();
			const registry2 = getDefaultRegistry();

			expect(registry1).not.toBe(registry2);
		});
	});
});
