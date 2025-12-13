import { beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { createTempDir } from "@sidequest/core/testing";
import {
	capitalizeFirst,
	generateFilename,
	generateTitle,
	generateUniquePath,
} from "./engine-utils";

describe("inbox/engine-utils", () => {
	describe("generateFilename", () => {
		test("should generate filename with timestamp prefix", () => {
			const timestamp = new Date("2024-12-10T14:30:00");
			const result = generateFilename("/path/to/Invoice ABC.pdf", timestamp);

			expect(result).toBe("20241210-1430-invoice-abc.pdf");
		});

		test("should use current time when no timestamp provided", () => {
			const result = generateFilename("/path/to/Invoice.pdf");

			// Should match format: YYYYMMDD-HHMM-description.ext
			expect(result).toMatch(/^\d{8}-\d{4}-invoice\.pdf$/);
		});

		test("should normalize filename with lowercase and hyphens", () => {
			const timestamp = new Date("2024-12-10T14:30:00");
			const result = generateFilename(
				"/path/to/My Invoice_123 Copy.pdf",
				timestamp,
			);

			expect(result).toBe("20241210-1430-my-invoice-123-copy.pdf");
		});

		test("should handle special characters in filename", () => {
			const timestamp = new Date("2024-12-10T14:30:00");
			const result = generateFilename(
				"/path/to/Invoice#123@Test!.pdf",
				timestamp,
			);

			expect(result).toBe("20241210-1430-invoice-123-test.pdf");
		});

		test("should strip leading and trailing hyphens", () => {
			const timestamp = new Date("2024-12-10T14:30:00");
			const result = generateFilename("/path/to/---Invoice---.pdf", timestamp);

			expect(result).toBe("20241210-1430-invoice.pdf");
		});

		test("should preserve file extension", () => {
			const timestamp = new Date("2024-12-10T14:30:00");
			const result = generateFilename("/path/to/document.txt", timestamp);

			expect(result).toBe("20241210-1430-document.txt");
		});

		test("should handle files without extension", () => {
			const timestamp = new Date("2024-12-10T14:30:00");
			const result = generateFilename("/path/to/README", timestamp);

			expect(result).toBe("20241210-1430-readme");
		});

		test("should pad single-digit month and day", () => {
			const timestamp = new Date("2024-01-05T09:05:00");
			const result = generateFilename("/path/to/file.pdf", timestamp);

			expect(result).toBe("20240105-0905-file.pdf");
		});
	});

	describe("capitalizeFirst", () => {
		test("should capitalize first letter", () => {
			expect(capitalizeFirst("invoice")).toBe("Invoice");
		});

		test("should capitalize first letter only", () => {
			expect(capitalizeFirst("booking confirmation")).toBe(
				"Booking confirmation",
			);
		});

		test("should handle already capitalized strings", () => {
			expect(capitalizeFirst("Invoice")).toBe("Invoice");
		});

		test("should handle single character", () => {
			expect(capitalizeFirst("a")).toBe("A");
		});

		test("should handle empty string", () => {
			expect(capitalizeFirst("")).toBe("");
		});

		test("should handle strings with leading spaces", () => {
			expect(capitalizeFirst(" invoice")).toBe(" invoice");
		});
	});

	describe("generateTitle", () => {
		test("should generate title with provider and date", () => {
			const result = generateTitle("invoice.pdf", "invoice", {
				provider: "Amazon",
				date: "2024-12-10",
			});

			expect(result).toBe("Invoice - Amazon - 2024-12-10");
		});

		test("should generate title with provider only", () => {
			const result = generateTitle("invoice.pdf", "invoice", {
				provider: "Amazon",
			});

			expect(result).toBe("Invoice - Amazon");
		});

		test("should capitalize note type", () => {
			const result = generateTitle("booking.pdf", "booking", {
				provider: "Qantas",
				date: "2024-12-10",
			});

			expect(result).toBe("Booking - Qantas - 2024-12-10");
		});

		test("should use 'Document' when no note type provided", () => {
			const result = generateTitle("file.pdf", undefined, {
				provider: "Amazon",
				date: "2024-12-10",
			});

			expect(result).toBe("Document - Amazon - 2024-12-10");
		});

		test("should fall back to cleaned filename when no fields", () => {
			const result = generateTitle("my-invoice-001.pdf", undefined);

			expect(result).toBe("my invoice 001");
		});

		test("should replace hyphens and underscores with spaces in filename", () => {
			const result = generateTitle("my_invoice-123.pdf", undefined);

			expect(result).toBe("my invoice 123");
		});

		test("should collapse multiple spaces in filename", () => {
			const result = generateTitle("my   invoice.pdf", undefined);

			expect(result).toBe("my invoice");
		});

		test("should trim whitespace from filename", () => {
			const result = generateTitle("  my-invoice  .pdf", undefined);

			expect(result).toBe("my invoice");
		});

		test("should handle filename without extension", () => {
			const result = generateTitle("my-invoice", undefined);

			expect(result).toBe("my invoice");
		});

		test("should handle fields with non-string provider", () => {
			const result = generateTitle("file.pdf", "invoice", {
				provider: 123, // Gets cast to string
			});

			// TypeScript cast: 123 becomes "123"
			expect(result).toBe("Invoice - 123");
		});

		test("should handle fields with non-string date", () => {
			const result = generateTitle("file.pdf", "invoice", {
				provider: "Amazon",
				date: null, // Invalid type
			});

			// Should use provider only
			expect(result).toBe("Invoice - Amazon");
		});
	});

	describe("generateUniquePath", () => {
		let tempDir: string;

		beforeEach(() => {
			tempDir = createTempDir("engine-utils-test-");
		});

		test("should return original path when file does not exist", () => {
			const path = `${tempDir}/new-file.pdf`;
			const result = generateUniquePath(path);

			expect(result).toBe(path);
		});

		test("should add counter suffix when file exists", () => {
			const path = `${tempDir}/existing.pdf`;
			writeFileSync(path, "content");

			const result = generateUniquePath(path);

			// Should be: existing-1-<random>.pdf
			expect(result).toMatch(
				new RegExp(`^${tempDir}/existing-1-[a-f0-9]{6}\\.pdf$`),
			);
		});

		test("should generate unique paths even with same counter", () => {
			const basePath = `${tempDir}/existing.pdf`;
			writeFileSync(basePath, "content");

			// Generate two unique paths (both will be -1- with different random suffixes)
			const path1 = generateUniquePath(basePath);
			const path2 = generateUniquePath(basePath);

			// Both should have counter 1 but different random suffixes
			expect(path1).toMatch(
				new RegExp(`^${tempDir}/existing-1-[a-f0-9]{6}\\.pdf$`),
			);
			expect(path2).toMatch(
				new RegExp(`^${tempDir}/existing-1-[a-f0-9]{6}\\.pdf$`),
			);
			expect(path1).not.toBe(path2); // Different random suffixes
		});

		test("should handle files without extension", () => {
			const path = `${tempDir}/README`;
			writeFileSync(path, "content");

			const result = generateUniquePath(path);

			expect(result).toMatch(new RegExp(`^${tempDir}/README-1-[a-f0-9]{6}$`));
		});

		test("should preserve extension correctly", () => {
			const path = `${tempDir}/file.tar.gz`;
			writeFileSync(path, "content");

			const result = generateUniquePath(path);

			// Extension is only .gz (last segment)
			expect(result).toMatch(
				new RegExp(`^${tempDir}/file\\.tar-1-[a-f0-9]{6}\\.gz$`),
			);
		});

		test("should handle directory paths", () => {
			const dirPath = `${tempDir}/subdir`;
			mkdirSync(dirPath);

			const result = generateUniquePath(dirPath);

			expect(result).toMatch(new RegExp(`^${tempDir}/subdir-1-[a-f0-9]{6}$`));
		});

		test("should generate unique IDs for concurrent calls", () => {
			const path = `${tempDir}/concurrent.pdf`;
			writeFileSync(path, "content");

			const result1 = generateUniquePath(path);
			const result2 = generateUniquePath(path);

			// Different random suffixes
			expect(result1).not.toBe(result2);
			expect(result1).toMatch(/-1-[a-f0-9]{6}\.pdf$/);
			expect(result2).toMatch(/-1-[a-f0-9]{6}\.pdf$/);
		});

		test("should use 6-character random suffix", () => {
			const path = `${tempDir}/file.pdf`;
			writeFileSync(path, "content");

			const result = generateUniquePath(path);

			// Extract random suffix
			const match = result.match(/-([a-f0-9]{6})\.pdf$/);
			expect(match).not.toBeNull();
			expect(match?.[1]).toHaveLength(6);
		});
	});
});
