import { describe, expect, test } from "bun:test";
import { capitalize } from "./string.js";

describe("capitalize", () => {
	test("capitalizes first letter of lowercase string", () => {
		expect(capitalize("hello")).toBe("Hello");
	});

	test("preserves already capitalized string", () => {
		expect(capitalize("Hello")).toBe("Hello");
	});

	test("only capitalizes first letter, leaves rest unchanged", () => {
		expect(capitalize("hELLO")).toBe("HELLO");
	});

	test("handles single character", () => {
		expect(capitalize("h")).toBe("H");
	});

	test("returns empty string as-is", () => {
		expect(capitalize("")).toBe("");
	});

	test("handles string starting with number", () => {
		expect(capitalize("123abc")).toBe("123abc");
	});

	test("handles string starting with special character", () => {
		expect(capitalize("@hello")).toBe("@hello");
	});

	test("handles multi-word string (only first word capitalized)", () => {
		expect(capitalize("hello world")).toBe("Hello world");
	});

	test("handles uppercase string", () => {
		expect(capitalize("HELLO")).toBe("HELLO");
	});
});
