import { describe, expect, test } from "bun:test";
import { validatePriority, validateWeight } from "./numbers.ts";

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
});
