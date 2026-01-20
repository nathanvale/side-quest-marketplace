import { describe, expect, test } from "bun:test";
import { validateAreaName, validateDisplayName } from "./names.ts";

describe("validation/names", () => {
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
});
