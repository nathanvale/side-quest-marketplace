import { describe, expect, test } from "bun:test";
import {
	sanitizePattern,
	validateAreaName,
	validateClassifierId,
	validateDisplayName,
	validateFieldName,
	validateFilePath,
	validatePriority,
	validateTemplateName,
	validateWeight,
} from "./validation";

// Note: This test file does not require vault setup utilities as it tests
// pure validation functions with no filesystem dependencies.

describe("validation", () => {
	describe("validateClassifierId", () => {
		test("accepts valid kebab-case IDs", () => {
			expect(validateClassifierId("medical-bill")).toBe("medical-bill");
			expect(validateClassifierId("invoice")).toBe("invoice");
			expect(validateClassifierId("travel-booking")).toBe("travel-booking");
			expect(validateClassifierId("medical-statement-2024")).toBe(
				"medical-statement-2024",
			);
		});

		test("rejects non-kebab-case", () => {
			expect(() => validateClassifierId("MedicalBill")).toThrow("kebab-case");
			expect(() => validateClassifierId("medical_bill")).toThrow("kebab-case");
			expect(() => validateClassifierId("medical bill")).toThrow("kebab-case");
			expect(() => validateClassifierId("Medical-Bill")).toThrow("kebab-case");
		});

		test("prevents path traversal", () => {
			expect(() => validateClassifierId("../secrets")).toThrow();
			expect(() => validateClassifierId("../../etc/passwd")).toThrow();
			expect(() => validateClassifierId("/etc/passwd")).toThrow();
		});

		test("rejects reserved names", () => {
			expect(() => validateClassifierId("index")).toThrow("Reserved");
			expect(() => validateClassifierId("types")).toThrow("Reserved");
			expect(() => validateClassifierId("defaults")).toThrow("Reserved");
			expect(() => validateClassifierId("_template")).toThrow("Reserved");
		});

		test("rejects IDs starting with number", () => {
			expect(() => validateClassifierId("123-invoice")).toThrow("kebab-case");
		});

		test("rejects empty string", () => {
			expect(() => validateClassifierId("")).toThrow("kebab-case");
		});
	});

	describe("validatePriority", () => {
		test("accepts valid priorities", () => {
			expect(validatePriority(0)).toBe(0);
			expect(validatePriority(50)).toBe(50);
			expect(validatePriority(100)).toBe(100);
		});

		test("rejects out-of-range values", () => {
			expect(() => validatePriority(-1)).toThrow("0-100");
			expect(() => validatePriority(101)).toThrow("0-100");
			expect(() => validatePriority(1000)).toThrow("0-100");
		});

		test("rejects non-integers", () => {
			expect(() => validatePriority(50.5)).toThrow("0-100");
			expect(() => validatePriority(99.9)).toThrow("0-100");
		});

		test("rejects NaN", () => {
			expect(() => validatePriority(Number.NaN)).toThrow("0-100");
		});
	});

	describe("validateFieldName", () => {
		test("accepts valid camelCase names", () => {
			expect(validateFieldName("title")).toBe("title");
			expect(validateFieldName("dateOfService")).toBe("dateOfService");
			expect(validateFieldName("totalAmount")).toBe("totalAmount");
			expect(validateFieldName("providerName123")).toBe("providerName123");
		});

		test("rejects non-camelCase", () => {
			expect(() => validateFieldName("date-of-service")).toThrow("camelCase");
			expect(() => validateFieldName("date_of_service")).toThrow("camelCase");
			expect(() => validateFieldName("date of service")).toThrow("camelCase");
			expect(() => validateFieldName("DateOfService")).toThrow("camelCase");
		});

		test("rejects names starting with number", () => {
			expect(() => validateFieldName("123field")).toThrow("camelCase");
		});

		test("rejects special characters", () => {
			expect(() => validateFieldName("field$name")).toThrow("camelCase");
			expect(() => validateFieldName("field@name")).toThrow("camelCase");
			expect(() => validateFieldName("field.name")).toThrow("camelCase");
		});

		test("rejects empty string", () => {
			expect(() => validateFieldName("")).toThrow("camelCase");
		});
	});

	describe("validateTemplateName", () => {
		test("accepts valid kebab-case names", () => {
			expect(validateTemplateName("medical-bill")).toBe("medical-bill");
			expect(validateTemplateName("invoice")).toBe("invoice");
			expect(validateTemplateName("travel-booking-v2")).toBe(
				"travel-booking-v2",
			);
		});

		test("prevents path traversal", () => {
			expect(() => validateTemplateName("../secrets")).toThrow();
			expect(() => validateTemplateName("../../etc/passwd")).toThrow();
		});

		test("rejects non-kebab-case", () => {
			expect(() => validateTemplateName("MedicalBill")).toThrow("kebab-case");
			expect(() => validateTemplateName("medical_bill")).toThrow("kebab-case");
		});
	});

	describe("sanitizePattern", () => {
		test("preserves safe patterns", () => {
			expect(sanitizePattern("medical")).toBe("medical");
			expect(sanitizePattern("bill.*invoice")).toBe("bill.*invoice");
			expect(sanitizePattern("^[a-z]+$")).toBe("^[a-z]+$");
		});

		test("removes nested quantifiers (ReDoS prevention)", () => {
			const dangerous = "(a+)+";
			const sanitized = sanitizePattern(dangerous);
			// Nested quantifiers should be removed
			expect(sanitized).not.toContain("(a+)+");
		});

		test("limits pattern length", () => {
			const longPattern = "a".repeat(1000);
			const sanitized = sanitizePattern(longPattern);
			expect(sanitized.length).toBeLessThanOrEqual(500);
		});

		test("handles complex patterns", () => {
			const pattern = "medical.*bill|invoice";
			expect(sanitizePattern(pattern)).toBe(pattern);
		});
	});

	describe("validateFilePath", () => {
		test("accepts valid relative paths", () => {
			expect(validateFilePath("Templates/invoice.md")).toBe(
				"Templates/invoice.md",
			);
			expect(validateFilePath("Projects/MyProject.md")).toBe(
				"Projects/MyProject.md",
			);
			expect(validateFilePath("file.md")).toBe("file.md");
		});

		test("prevents path traversal", () => {
			expect(() => validateFilePath("../../../etc/passwd")).toThrow(
				"Path traversal not allowed",
			);
			expect(() => validateFilePath("Templates/../../../secrets")).toThrow(
				"Path traversal not allowed",
			);
		});

		test("prevents absolute paths", () => {
			expect(() => validateFilePath("/etc/passwd")).toThrow("relative");
			expect(() => validateFilePath("/home/user/file.md")).toThrow("relative");
		});

		test("prevents hidden files", () => {
			expect(() => validateFilePath(".hidden")).toThrow("Hidden files");
			expect(() => validateFilePath("Templates/.hidden")).toThrow(
				"Hidden files",
			);
			expect(() => validateFilePath(".git/config")).toThrow("Hidden files");
		});

		test("normalizes paths", () => {
			expect(validateFilePath("Templates//invoice.md")).toBe(
				"Templates/invoice.md",
			);
			expect(validateFilePath("Templates/./invoice.md")).toBe(
				"Templates/invoice.md",
			);
		});
	});

	describe("validateAreaName", () => {
		test("accepts valid area names", () => {
			expect(validateAreaName("Health")).toBe("Health");
			expect(validateAreaName("Personal Finance")).toBe("Personal Finance");
			expect(validateAreaName("Work-Life")).toBe("Work-Life");
			expect(validateAreaName("Area_Name")).toBe("Area_Name");
		});

		test("trims whitespace", () => {
			expect(validateAreaName("  Health  ")).toBe("Health");
			expect(validateAreaName("\tFinance\n")).toBe("Finance");
		});

		test("rejects empty names", () => {
			expect(() => validateAreaName("")).toThrow("cannot be empty");
			expect(() => validateAreaName("   ")).toThrow("cannot be empty");
		});

		test("rejects too-long names", () => {
			const longName = "a".repeat(101);
			expect(() => validateAreaName(longName)).toThrow("too long");
		});

		test("rejects special characters", () => {
			expect(() => validateAreaName("Health@#$")).toThrow("Invalid area");
			expect(() => validateAreaName("Health/Finance")).toThrow("Invalid area");
		});
	});

	describe("validateDisplayName", () => {
		test("accepts valid display names", () => {
			expect(validateDisplayName("Medical Bill")).toBe("Medical Bill");
			expect(validateDisplayName("Invoice & Receipt")).toBe(
				"Invoice & Receipt",
			);
		});

		test("trims whitespace", () => {
			expect(validateDisplayName("  Medical Bill  ")).toBe("Medical Bill");
		});

		test("rejects empty names", () => {
			expect(() => validateDisplayName("")).toThrow("cannot be empty");
			expect(() => validateDisplayName("   ")).toThrow("cannot be empty");
		});

		test("rejects too-long names", () => {
			const longName = "a".repeat(101);
			expect(() => validateDisplayName(longName)).toThrow("too long");
		});
	});

	describe("validateWeight", () => {
		test("accepts valid weights", () => {
			expect(validateWeight(0)).toBe(0);
			expect(validateWeight(0.5)).toBe(0.5);
			expect(validateWeight(1)).toBe(1);
			expect(validateWeight(0.75)).toBe(0.75);
		});

		test("rejects out-of-range values", () => {
			expect(() => validateWeight(-0.1)).toThrow("0.0 to 1.0");
			expect(() => validateWeight(1.1)).toThrow("0.0 to 1.0");
			expect(() => validateWeight(2)).toThrow("0.0 to 1.0");
		});

		test("rejects NaN", () => {
			expect(() => validateWeight(Number.NaN)).toThrow("0.0 to 1.0");
		});
	});

	describe("security scenarios", () => {
		test("prevents path traversal in classifier creation", () => {
			// Attacker tries to create classifier outside definitions/
			expect(() => validateClassifierId("../../../malicious")).toThrow();
		});

		test("prevents template injection", () => {
			// Attacker tries to reference system files
			expect(() => validateTemplateName("../../etc/passwd")).toThrow();
		});

		test("prevents ReDoS attacks", () => {
			// Nested quantifiers can cause exponential backtracking
			const malicious = "(a+)+(b+)+(c+)+";
			const safe = sanitizePattern(malicious);
			// Should be sanitized
			expect(safe).not.toBe(malicious);
		});

		test("prevents file access outside vault", () => {
			expect(() =>
				validateFilePath("../../../home/user/.ssh/id_rsa"),
			).toThrow();
		});
	});
});
