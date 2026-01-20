import { describe, expect, test } from "bun:test";
import {
	validateInteger,
	validatePriority,
	validateWeight,
} from "./numbers.ts";

describe("validation/numbers", () => {
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

	describe("validateInteger", () => {
		test("accepts valid integers", () => {
			const result = validateInteger(42, { name: "count" });
			expect(result.valid).toBe(true);
			expect(result.value).toBe(42);
		});

		test("accepts zero", () => {
			const result = validateInteger(0, { name: "count" });
			expect(result.valid).toBe(true);
			expect(result.value).toBe(0);
		});

		test("accepts negative integers", () => {
			const result = validateInteger(-5, { name: "offset" });
			expect(result.valid).toBe(true);
			expect(result.value).toBe(-5);
		});

		test("parses string input by default", () => {
			const result = validateInteger("42", { name: "count" });
			expect(result.valid).toBe(true);
			expect(result.value).toBe(42);
		});

		test("rejects string input when disabled", () => {
			const result = validateInteger("42", {
				name: "count",
				allowStringInput: false,
			});
			expect(result.valid).toBe(false);
			expect(result.error).toContain("must be a number");
		});

		test("uses default value when undefined", () => {
			const result = validateInteger(undefined, {
				name: "count",
				defaultValue: 10,
			});
			expect(result.valid).toBe(true);
			expect(result.value).toBe(10);
		});

		test("uses default value when null", () => {
			const result = validateInteger(null, {
				name: "count",
				defaultValue: 10,
			});
			expect(result.valid).toBe(true);
			expect(result.value).toBe(10);
		});

		test("rejects undefined without default", () => {
			const result = validateInteger(undefined, { name: "count" });
			expect(result.valid).toBe(false);
			expect(result.error).toBe("count is required");
		});

		test("rejects null without default", () => {
			const result = validateInteger(null, { name: "count" });
			expect(result.valid).toBe(false);
			expect(result.error).toBe("count is required");
		});

		test("rejects non-integers", () => {
			const result = validateInteger(3.14, { name: "count" });
			expect(result.valid).toBe(false);
			expect(result.error).toBe("count must be an integer");
		});

		test("rejects NaN", () => {
			const result = validateInteger(Number.NaN, { name: "count" });
			expect(result.valid).toBe(false);
			expect(result.error).toContain("must be a number");
		});

		test("rejects invalid string", () => {
			const result = validateInteger("not a number", { name: "count" });
			expect(result.valid).toBe(false);
			expect(result.error).toContain("must be a number");
		});

		test("enforces minimum bound", () => {
			const result = validateInteger(0, { name: "count", min: 1 });
			expect(result.valid).toBe(false);
			expect(result.error).toContain("must be between 1 and");
		});

		test("enforces maximum bound", () => {
			const result = validateInteger(2000, { name: "count", max: 1000 });
			expect(result.valid).toBe(false);
			expect(result.error).toContain("must be between");
			expect(result.error).toContain("and 1000");
		});

		test("accepts value at minimum bound", () => {
			const result = validateInteger(1, { name: "count", min: 1, max: 100 });
			expect(result.valid).toBe(true);
			expect(result.value).toBe(1);
		});

		test("accepts value at maximum bound", () => {
			const result = validateInteger(100, { name: "count", min: 1, max: 100 });
			expect(result.valid).toBe(true);
			expect(result.value).toBe(100);
		});

		test("works with custom min/max range", () => {
			const result = validateInteger(50, { name: "count", min: 10, max: 90 });
			expect(result.valid).toBe(true);
			expect(result.value).toBe(50);
		});

		test("handles large positive integers", () => {
			const result = validateInteger(1000000, { name: "count" });
			expect(result.valid).toBe(true);
			expect(result.value).toBe(1000000);
		});

		test("handles large negative integers", () => {
			const result = validateInteger(-1000000, { name: "offset" });
			expect(result.valid).toBe(true);
			expect(result.value).toBe(-1000000);
		});
	});
});
