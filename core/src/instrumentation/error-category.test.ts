import { describe, expect, test } from "bun:test";
import { categorizeError, getErrorCategory } from "./error-category.js";

describe("categorizeError", () => {
	test("categorizes network errors as transient", () => {
		const testCases = [
			new Error("ECONNREFUSED: Connection refused"),
			new Error("ENOTFOUND: DNS lookup failed"),
			new Error("Network error occurred"),
			new Error("Fetch failed"),
		];

		for (const error of testCases) {
			const result = categorizeError(error);
			expect(result).toEqual({
				category: "transient",
				code: "NETWORK_ERROR",
			});
		}
	});

	test("categorizes timeout errors as transient", () => {
		const testCases = [
			new Error("Operation timeout"),
			new Error("Request timed out"),
			new Error("Connection timed out after 5s"),
		];

		for (const error of testCases) {
			const result = categorizeError(error);
			expect(result).toEqual({
				category: "transient",
				code: "TIMEOUT",
			});
		}
	});

	test("categorizes not found errors as permanent", () => {
		const testCases = [
			new Error("File not found"),
			new Error("ENOENT: no such file or directory"),
			new Error("No such file: config.json"),
		];

		for (const error of testCases) {
			const result = categorizeError(error);
			expect(result).toEqual({
				category: "permanent",
				code: "NOT_FOUND",
			});
		}
	});

	test("categorizes validation errors as permanent", () => {
		const testCases = [
			new Error("Invalid input"),
			new Error("Validation failed: required field missing"),
			new Error("Value must be positive"),
			new Error("Required field is missing"),
		];

		for (const error of testCases) {
			const result = categorizeError(error);
			expect(result).toEqual({
				category: "permanent",
				code: "VALIDATION",
			});
		}
	});

	test("categorizes permission errors as configuration", () => {
		const testCases = [
			new Error("Permission denied"),
			new Error("EACCES: access denied"),
			new Error("EPERM: operation not permitted"),
			new Error("Unauthorized access"),
		];

		for (const error of testCases) {
			const result = categorizeError(error);
			expect(result).toEqual({
				category: "configuration",
				code: "PERMISSION",
			});
		}
	});

	test("categorizes unknown errors", () => {
		const testCases = [
			new Error("Something went wrong"),
			new Error("Unexpected error"),
			new Error("Internal server error"),
		];

		for (const error of testCases) {
			const result = categorizeError(error);
			expect(result).toEqual({
				category: "unknown",
				code: "UNKNOWN_ERROR",
			});
		}
	});

	test("handles non-Error objects", () => {
		const testCases = [
			"string error",
			42,
			null,
			undefined,
			{ message: "object error" },
		];

		for (const error of testCases) {
			const result = categorizeError(error);
			expect(result).toEqual({
				category: "unknown",
				code: "UNKNOWN_ERROR",
			});
		}
	});

	test("pattern matching is case-insensitive", () => {
		const testCases = [
			new Error("ECONNREFUSED"),
			new Error("econnrefused"),
			new Error("EConnRefused"),
		];

		for (const error of testCases) {
			const result = categorizeError(error);
			expect(result.code).toBe("NETWORK_ERROR");
		}
	});
});

describe("getErrorCategory", () => {
	test("returns just the category for transient errors", () => {
		const error = new Error("ECONNREFUSED");
		expect(getErrorCategory(error)).toBe("transient");
	});

	test("returns just the category for permanent errors", () => {
		const error = new Error("File not found");
		expect(getErrorCategory(error)).toBe("permanent");
	});

	test("returns just the category for configuration errors", () => {
		const error = new Error("Permission denied");
		expect(getErrorCategory(error)).toBe("configuration");
	});

	test("returns just the category for unknown errors", () => {
		const error = new Error("Something went wrong");
		expect(getErrorCategory(error)).toBe("unknown");
	});

	test("handles non-Error objects", () => {
		expect(getErrorCategory("string error")).toBe("unknown");
		expect(getErrorCategory(null)).toBe("unknown");
	});
});
