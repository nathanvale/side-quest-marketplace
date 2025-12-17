import { beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { createTempDir } from "@sidequest/core/testing";
import {
	capitalizeFirst,
	formatDateWithSpaces,
	generateAttachmentName,
	generateFilename,
	generateTitle,
	generateUniqueNotePath,
	generateUniquePath,
	getHashPrefix,
} from "./engine-utils";

// Sample hash for testing (64-char SHA256)
const TEST_HASH =
	"a7b3c4d5e6f7890123456789abcdef0123456789abcdef0123456789abcdef01";

describe("inbox/engine-utils", () => {
	describe("getHashPrefix", () => {
		test("should extract first 4 characters of hash", () => {
			expect(getHashPrefix(TEST_HASH)).toBe("a7b3");
		});

		test("should handle short hashes", () => {
			expect(getHashPrefix("ab")).toBe("ab");
		});
	});

	describe("formatDateWithSpaces", () => {
		test("should replace hyphens with spaces", () => {
			expect(formatDateWithSpaces("2024-12-10")).toBe("2024 12 10");
		});

		test("should handle date without hyphens", () => {
			expect(formatDateWithSpaces("20241210")).toBe("20241210");
		});
	});

	describe("generateFilename", () => {
		test("should generate filename with date, type, provider, and hash at end", () => {
			const result = generateFilename(
				"/path/to/doc.pdf",
				TEST_HASH,
				"invoice",
				{
					date: "2024-12-10",
					provider: "Amazon",
				},
			);

			// Format: date-type-provider-hash.ext (lowercase, hyphens, hash at end)
			expect(result).toBe("2024-12-10-invoice-amazon-a7b3.pdf");
		});

		test("should mirror note title format (lowercase with hyphens)", () => {
			// Note title:  "2024 12 10 Medical Statement PV Foulkes Medical a7b3" (title case, hash at end)
			// Attachment:  "2024-12-10-medical-statement-pv-foulkes-medical-a7b3.pdf" (lowercase, hash at end)
			const result = generateFilename(
				"/path/to/statement.pdf",
				TEST_HASH,
				"medical-statement",
				{
					date: "2024-12-10",
					provider: "PV Foulkes Medical",
				},
			);

			expect(result).toBe(
				"2024-12-10-medical-statement-pv-foulkes-medical-a7b3.pdf",
			);
		});

		test("should handle missing date", () => {
			const result = generateFilename(
				"/path/to/doc.pdf",
				TEST_HASH,
				"invoice",
				{
					provider: "Amazon",
				},
			);

			// No date: type-provider-hash.ext
			expect(result).toBe("invoice-amazon-a7b3.pdf");
		});

		test("should handle missing provider", () => {
			const result = generateFilename(
				"/path/to/doc.pdf",
				TEST_HASH,
				"invoice",
				{
					date: "2024-12-10",
				},
			);

			// No provider: date-type-hash.ext
			expect(result).toBe("2024-12-10-invoice-a7b3.pdf");
		});

		test("should handle missing type (defaults to document)", () => {
			const result = generateFilename(
				"/path/to/doc.pdf",
				TEST_HASH,
				undefined,
				{
					date: "2024-12-10",
					provider: "Amazon",
				},
			);

			expect(result).toBe("2024-12-10-document-amazon-a7b3.pdf");
		});

		test("should handle only hash (no date, type, or provider)", () => {
			const result = generateFilename("/path/to/doc.pdf", TEST_HASH);

			// Minimum: document-hash.ext
			expect(result).toBe("document-a7b3.pdf");
		});

		test("should use statementDate when date is not available", () => {
			const result = generateFilename(
				"/path/to/statement.pdf",
				TEST_HASH,
				"medical-statement",
				{
					statementDate: "2024-12-01",
					provider: "Medibank",
				},
			);

			expect(result).toBe("2024-12-01-medical-statement-medibank-a7b3.pdf");
		});

		test("should use invoice_date when date is not available", () => {
			const result = generateFilename(
				"/path/to/doc.pdf",
				TEST_HASH,
				"invoice",
				{
					invoice_date: "2024-11-15",
					provider: "Acme Corp",
				},
			);

			expect(result).toBe("2024-11-15-invoice-acme-corp-a7b3.pdf");
		});

		test("should sanitize special characters in provider", () => {
			const result = generateFilename(
				"/path/to/doc.pdf",
				TEST_HASH,
				"invoice",
				{
					date: "2024-12-10",
					provider: "Acme & Sons (Pty) Ltd.",
				},
			);

			expect(result).toBe("2024-12-10-invoice-acme-sons-pty-ltd-a7b3.pdf");
		});

		test("should preserve file extension", () => {
			const result = generateFilename(
				"/path/to/doc.PNG",
				TEST_HASH,
				"receipt",
				{
					date: "2024-12-10",
					provider: "Shop",
				},
			);

			expect(result).toBe("2024-12-10-receipt-shop-a7b3.PNG");
		});

		test("should use different hash prefix for different hashes", () => {
			const hash2 =
				"f1e2d3c4b5a6978800000000000000000000000000000000000000000000000";
			const result = generateFilename("/path/to/doc.pdf", hash2, "invoice", {
				date: "2024-12-10",
			});

			expect(result).toBe("2024-12-10-invoice-f1e2.pdf");
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
		describe("without hash (manual notes)", () => {
			test("should generate title with date first, then type, then provider", () => {
				const result = generateTitle("invoice.pdf", "invoice", {
					provider: "Amazon",
					date: "2024-12-10",
				});

				expect(result).toBe("2024-12-10 - Invoice - Amazon");
			});

			test("should generate title with provider only (no date)", () => {
				const result = generateTitle("invoice.pdf", "invoice", {
					provider: "Amazon",
				});

				expect(result).toBe("Invoice - Amazon");
			});

			test("should generate title with date only (no provider)", () => {
				const result = generateTitle("invoice.pdf", "invoice", {
					date: "2024-12-10",
				});

				expect(result).toBe("2024-12-10 - Invoice");
			});

			test("should capitalize note type", () => {
				const result = generateTitle("booking.pdf", "booking", {
					provider: "Qantas",
					date: "2024-12-10",
				});

				expect(result).toBe("2024-12-10 - Booking - Qantas");
			});

			test("should use 'Document' when no note type provided", () => {
				const result = generateTitle("file.pdf", undefined, {
					provider: "Amazon",
					date: "2024-12-10",
				});

				expect(result).toBe("2024-12-10 - Document - Amazon");
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

			test("should use statementDate when date is not available", () => {
				const result = generateTitle("statement.pdf", "medical-statement", {
					provider: "PV Foulkes Medical",
					statementDate: "2025-12-12",
				});

				expect(result).toBe(
					"2025-12-12 - Medical Statement - PV Foulkes Medical",
				);
			});

			test("should use invoice_date when date is not available", () => {
				const result = generateTitle("invoice.pdf", "invoice", {
					provider: "Amazon",
					invoice_date: "2024-11-15",
				});

				expect(result).toBe("2024-11-15 - Invoice - Amazon");
			});

			test("should prefer date over statementDate", () => {
				const result = generateTitle("file.pdf", "invoice", {
					provider: "Provider",
					date: "2024-01-01",
					statementDate: "2024-02-02",
				});

				// date takes precedence
				expect(result).toBe("2024-01-01 - Invoice - Provider");
			});
		});

		describe("with hash (from source attachment)", () => {
			test("should generate space-separated title with hash", () => {
				const result = generateTitle(
					"invoice.pdf",
					"invoice",
					{
						provider: "Amazon",
						date: "2024-12-10",
					},
					TEST_HASH,
				);

				// Format: YYYY MM DD Type Provider hash4 (hash at end)
				expect(result).toBe("2024 12 10 Invoice Amazon a7b3");
			});

			test("should handle missing date with hash", () => {
				const result = generateTitle(
					"invoice.pdf",
					"invoice",
					{
						provider: "Amazon",
					},
					TEST_HASH,
				);

				// No date, so just: Type Provider hash4
				expect(result).toBe("Invoice Amazon a7b3");
			});

			test("should handle missing provider with hash", () => {
				const result = generateTitle(
					"invoice.pdf",
					"invoice",
					{
						date: "2024-12-10",
					},
					TEST_HASH,
				);

				// No provider: YYYY MM DD Type hash4
				expect(result).toBe("2024 12 10 Invoice a7b3");
			});

			test("should handle only hash (no date, no provider)", () => {
				const result = generateTitle("invoice.pdf", "invoice", {}, TEST_HASH);

				// Just: Type hash4
				expect(result).toBe("Invoice a7b3");
			});

			test("should use statementDate with hash", () => {
				const result = generateTitle(
					"statement.pdf",
					"medical-statement",
					{
						provider: "Medibank",
						statementDate: "2024-12-01",
					},
					TEST_HASH,
				);

				expect(result).toBe("2024 12 01 Medical Statement Medibank a7b3");
			});
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

			// Should be: existing-2.pdf (starts at 2)
			expect(result).toBe(`${tempDir}/existing-2.pdf`);
		});

		test("should increment counter when multiple files exist", () => {
			const basePath = `${tempDir}/existing.pdf`;
			writeFileSync(basePath, "content");
			writeFileSync(`${tempDir}/existing-2.pdf`, "content");
			writeFileSync(`${tempDir}/existing-3.pdf`, "content");

			const result = generateUniquePath(basePath);

			// Should find -4 as first available
			expect(result).toBe(`${tempDir}/existing-4.pdf`);
		});

		test("should handle files without extension", () => {
			const path = `${tempDir}/README`;
			writeFileSync(path, "content");

			const result = generateUniquePath(path);

			expect(result).toBe(`${tempDir}/README-2`);
		});

		test("should preserve extension correctly", () => {
			const path = `${tempDir}/file.tar.gz`;
			writeFileSync(path, "content");

			const result = generateUniquePath(path);

			// Extension is only .gz (last segment)
			expect(result).toBe(`${tempDir}/file.tar-2.gz`);
		});

		test("should handle directory paths", () => {
			const dirPath = `${tempDir}/subdir`;
			mkdirSync(dirPath);

			const result = generateUniquePath(dirPath);

			expect(result).toBe(`${tempDir}/subdir-2`);
		});
	});

	describe("generateUniqueNotePath", () => {
		let tempDir: string;

		beforeEach(() => {
			tempDir = createTempDir("engine-utils-note-test-");
		});

		test("should return original path if file does not exist", () => {
			const path = `${tempDir}/My Note.md`;

			const result = generateUniqueNotePath(path);

			expect(result).toBe(path);
		});

		test("should add parenthetical counter when file exists", () => {
			const path = `${tempDir}/My Note.md`;
			writeFileSync(path, "content");

			const result = generateUniqueNotePath(path);

			// Obsidian pattern: "My Note.md", "My Note (2).md"
			expect(result).toBe(`${tempDir}/My Note (2).md`);
		});

		test("should increment counter when multiple notes exist", () => {
			const basePath = `${tempDir}/Invoice - Amazon - 2024-12-10.md`;
			writeFileSync(basePath, "content");
			writeFileSync(
				`${tempDir}/Invoice - Amazon - 2024-12-10 (2).md`,
				"content",
			);
			writeFileSync(
				`${tempDir}/Invoice - Amazon - 2024-12-10 (3).md`,
				"content",
			);

			const result = generateUniqueNotePath(basePath);

			// Should find (4) as first available
			expect(result).toBe(`${tempDir}/Invoice - Amazon - 2024-12-10 (4).md`);
		});

		test("should handle files without extension", () => {
			const path = `${tempDir}/README`;
			writeFileSync(path, "content");

			const result = generateUniqueNotePath(path);

			expect(result).toBe(`${tempDir}/README (2)`);
		});
	});

	describe("generateAttachmentName", () => {
		test("should generate name from date, type, and provider", () => {
			const result = generateAttachmentName(
				"/inbox/statement.pdf",
				"medical-statement",
				{
					date: "2025-10-21",
					provider: "PV Foulkes Medical Services",
				},
			);

			expect(result).toBe(
				"2025-10-21-medical-statement-pv-foulkes-medical-services.pdf",
			);
		});

		test("should handle statementDate field", () => {
			const result = generateAttachmentName("/inbox/doc.pdf", "invoice", {
				statementDate: "2025-01-15",
				provider: "Acme Corp",
			});

			expect(result).toBe("2025-01-15-invoice-acme-corp.pdf");
		});

		test("should handle invoice_date field", () => {
			const result = generateAttachmentName("/inbox/doc.pdf", "invoice", {
				invoice_date: "2025-01-15",
				provider: "Acme",
			});

			expect(result).toBe("2025-01-15-invoice-acme.pdf");
		});

		test("should handle invoiceDate field", () => {
			const result = generateAttachmentName("/inbox/doc.pdf", "invoice", {
				invoiceDate: "2025-01-15",
				provider: "Test Co",
			});

			expect(result).toBe("2025-01-15-invoice-test-co.pdf");
		});

		test("should return undefined when date is missing", () => {
			const result = generateAttachmentName("/inbox/doc.pdf", "invoice", {
				provider: "Acme",
			});

			expect(result).toBeUndefined();
		});

		test("should return undefined when noteType is missing", () => {
			const result = generateAttachmentName("/inbox/doc.pdf", undefined, {
				date: "2025-01-15",
				provider: "Acme",
			});

			expect(result).toBeUndefined();
		});

		test("should work without provider", () => {
			const result = generateAttachmentName("/inbox/doc.pdf", "booking", {
				date: "2025-03-20",
			});

			expect(result).toBe("2025-03-20-booking.pdf");
		});

		test("should truncate long provider names", () => {
			const result = generateAttachmentName("/inbox/doc.pdf", "invoice", {
				date: "2025-01-15",
				provider:
					"This Is An Extremely Long Provider Name That Should Be Truncated To Avoid Filename Issues",
			});

			// Provider slug should be max 40 chars
			expect(result).toContain("2025-01-15-invoice-");
			expect(result?.length).toBeLessThan(70);
		});

		test("should sanitize special characters", () => {
			const result = generateAttachmentName("/inbox/doc.pdf", "invoice", {
				date: "2025-01-15",
				provider: "Acme & Sons (Pty) Ltd.",
			});

			expect(result).toBe("2025-01-15-invoice-acme-sons-pty-ltd.pdf");
		});

		test("should preserve file extension", () => {
			const result = generateAttachmentName("/inbox/doc.PNG", "receipt", {
				date: "2025-01-15",
				provider: "Shop",
			});

			expect(result).toBe("2025-01-15-receipt-shop.PNG");
		});
	});
});
