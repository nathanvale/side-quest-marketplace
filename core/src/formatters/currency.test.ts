import { describe, expect, test } from "bun:test";
import { formatCurrency, parsePrice } from "./currency.ts";

describe("formatCurrency", () => {
	test("formats zero", () => {
		expect(formatCurrency(0)).toBe("$0.00");
	});

	test("formats small decimals", () => {
		expect(formatCurrency(0.1)).toBe("$0.10");
		expect(formatCurrency(0.01)).toBe("$0.01");
		expect(formatCurrency(0.99)).toBe("$0.99");
	});

	test("formats whole numbers", () => {
		expect(formatCurrency(1)).toBe("$1.00");
		expect(formatCurrency(100)).toBe("$100.00");
		expect(formatCurrency(1000)).toBe("$1000.00");
	});

	test("formats decimal amounts", () => {
		expect(formatCurrency(42.5)).toBe("$42.50");
		expect(formatCurrency(99.99)).toBe("$99.99");
		expect(formatCurrency(27.0)).toBe("$27.00");
	});

	test("formats large numbers", () => {
		expect(formatCurrency(1000000)).toBe("$1000000.00");
		expect(formatCurrency(1000000.99)).toBe("$1000000.99");
	});

	test("formats negative numbers", () => {
		expect(formatCurrency(-50)).toBe("$-50.00");
		expect(formatCurrency(-0.5)).toBe("$-0.50");
		expect(formatCurrency(-1000)).toBe("$-1000.00");
	});

	test("always shows 2 decimal places", () => {
		expect(formatCurrency(42)).toBe("$42.00");
		expect(formatCurrency(42.5)).toBe("$42.50");
		expect(formatCurrency(42.567)).toBe("$42.57");
	});

	test("rounds to 2 decimal places", () => {
		expect(formatCurrency(42.567)).toBe("$42.57");
		expect(formatCurrency(42.564)).toBe("$42.56");
		expect(formatCurrency(42.565)).toBe("$42.56"); // Standard rounding
	});
});

describe("parsePrice", () => {
	test("parses basic dollar amounts", () => {
		expect(parsePrice("$27.00")).toBe(27);
		expect(parsePrice("$27")).toBe(27);
		expect(parsePrice("$42.50")).toBe(42.5);
	});

	test("parses amounts without dollar sign", () => {
		expect(parsePrice("27.00")).toBe(27);
		expect(parsePrice("27")).toBe(27);
		expect(parsePrice("42.50")).toBe(42.5);
	});

	test("parses amounts with commas", () => {
		expect(parsePrice("$1,000")).toBe(1000);
		expect(parsePrice("$1,000.00")).toBe(1000);
		expect(parsePrice("$1,000.50")).toBe(1000.5);
		expect(parsePrice("1,000.99")).toBe(1000.99);
	});

	test("parses amounts with whitespace", () => {
		expect(parsePrice("$ 27.00")).toBe(27);
		expect(parsePrice(" 27.00 ")).toBe(27);
		expect(parsePrice("$ 1,000.50 ")).toBe(1000.5);
	});

	test("parses zero", () => {
		expect(parsePrice("$0")).toBe(0);
		expect(parsePrice("$0.00")).toBe(0);
		expect(parsePrice("0")).toBe(0);
	});

	test("parses decimal amounts", () => {
		expect(parsePrice("$0.10")).toBe(0.1);
		expect(parsePrice("$0.99")).toBe(0.99);
		expect(parsePrice("$99.99")).toBe(99.99);
	});

	test("parses large amounts", () => {
		expect(parsePrice("$1,000,000.00")).toBe(1000000);
		expect(parsePrice("$999,999.99")).toBe(999999.99);
	});

	test("throws on empty string", () => {
		expect(() => parsePrice("")).toThrow('Invalid price format: ""');
	});

	test("throws on non-numeric string", () => {
		expect(() => parsePrice("abc")).toThrow('Invalid price format: "abc"');
		expect(() => parsePrice("$abc")).toThrow('Invalid price format: "$abc"');
	});

	test("throws on invalid formats", () => {
		expect(() => parsePrice("not a price")).toThrow(
			'Invalid price format: "not a price"',
		);
		expect(() => parsePrice("$")).toThrow('Invalid price format: "$"');
	});

	test("handles negative amounts", () => {
		expect(parsePrice("-$50.00")).toBe(-50);
		expect(parsePrice("-50")).toBe(-50);
		expect(parsePrice("$-50")).toBe(-50);
	});
});
