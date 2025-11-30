import { describe, expect, it } from "bun:test";
import { findWithFallback, parsePrice } from "./price-scraper.ts";
import type { SelectorConfig } from "./selectors.ts";

describe("findWithFallback", () => {
	it("should find text using pattern with capture group", () => {
		const snapshot = `
[uid=1] Ticket Selection
[uid=2] Adult $27.00
[uid=3] Child $21.00
[uid=4] Booking Fee $1.95 per ticket
`;

		const config: SelectorConfig = {
			primary: ".adult-price",
			fallbacks: [".price-adult"],
			textPattern: /Adult.*?\$(\d+\.\d{2})/i,
			description: "Adult ticket price",
		};

		const result = findWithFallback(snapshot, config);
		expect(result).toBe("27.00");
	});

	it("should return full match when no capture group exists", () => {
		const snapshot = `
[uid=10] Payment Summary
[uid=11] Booking Fee: $1.95 per ticket
[uid=12] Total: $56.95
`;

		const config: SelectorConfig = {
			primary: ".booking-fee",
			textPattern: /\$\d+\.\d{2}/,
			description: "Booking fee",
		};

		const result = findWithFallback(snapshot, config);
		expect(result).toBe("$1.95");
	});

	it("should return null when pattern doesn't match", () => {
		const snapshot = `
[uid=1] No prices here
[uid=2] Just text content
`;

		const config: SelectorConfig = {
			primary: ".price",
			textPattern: /Adult.*?\$(\d+\.\d{2})/i,
			description: "Adult price",
		};

		const result = findWithFallback(snapshot, config);
		expect(result).toBeNull();
	});

	it("should return null when no textPattern is defined", () => {
		const snapshot = `
[uid=1] Adult $27.00
`;

		const config: SelectorConfig = {
			primary: ".price",
			description: "Price",
		};

		const result = findWithFallback(snapshot, config);
		expect(result).toBeNull();
	});

	it("should handle complex multi-line snapshots", () => {
		const snapshot = `
[uid=100] Classic Cinemas
[uid=101] Ticket Selection
[uid=102] Select your tickets below
[uid=103] Adult Ticket
[uid=104] General Admission: $27.00
[uid=105] Concession Ticket
[uid=106] Child/Student/Senior: $21.00
[uid=107] Booking Fee
[uid=108] Per ticket service fee: $1.95
`;

		const adultConfig: SelectorConfig = {
			primary: ".adult-price",
			textPattern: /Adult.*?Admission:\s*\$(\d+\.\d{2})/is,
			description: "Adult price",
		};

		const childConfig: SelectorConfig = {
			primary: ".child-price",
			textPattern: /Child\/Student\/Senior:\s*\$(\d+\.\d{2})/i,
			description: "Child price",
		};

		const feeConfig: SelectorConfig = {
			primary: ".booking-fee",
			textPattern: /service fee:\s*\$(\d+\.\d{2})/i,
			description: "Booking fee",
		};

		expect(findWithFallback(snapshot, adultConfig)).toBe("27.00");
		expect(findWithFallback(snapshot, childConfig)).toBe("21.00");
		expect(findWithFallback(snapshot, feeConfig)).toBe("1.95");
	});

	it("should be case-insensitive when regex has 'i' flag", () => {
		const snapshot = `
[uid=1] ADULT TICKET $27.00
[uid=2] adult ticket $27.00
[uid=3] Adult Ticket $27.00
`;

		const config: SelectorConfig = {
			primary: ".price",
			textPattern: /adult.*?\$(\d+\.\d{2})/i,
			description: "Adult price",
		};

		const result = findWithFallback(snapshot, config);
		expect(result).toBe("27.00");
	});
});

describe("parsePrice", () => {
	it("should parse standard price format", () => {
		expect(parsePrice("$27.00")).toBe(27.0);
		expect(parsePrice("$21.00")).toBe(21.0);
		expect(parsePrice("$1.95")).toBe(1.95);
	});

	it("should handle prices without dollar sign", () => {
		expect(parsePrice("27.00")).toBe(27.0);
		expect(parsePrice("21")).toBe(21.0);
	});

	it("should handle prices with commas", () => {
		expect(parsePrice("$1,234.56")).toBe(1234.56);
	});

	it("should throw on invalid formats", () => {
		expect(() => parsePrice("abc")).toThrow("Invalid price format");
		expect(() => parsePrice("")).toThrow("Invalid price format");
	});
});
