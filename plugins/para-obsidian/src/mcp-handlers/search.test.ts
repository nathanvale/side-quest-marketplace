/**
 * Tests for search MCP tools pattern validation
 *
 * Verifies that regex patterns are validated before execution
 * to prevent ReDoS attacks.
 */

import { describe, expect, test } from "bun:test";

describe("Search Tool Regex Validation", () => {
	test("should reject dangerous regex patterns", () => {
		// These patterns would be caught by validateRegex if we import it
		const { validateRegex } = require("../shared/validation");

		// ReDoS pattern: nested quantifiers
		const dangerous1 = validateRegex("(a+)+");
		expect(dangerous1.valid).toBe(false);
		expect(dangerous1.error).toContain("performance");

		// ReDoS pattern: alternation with repetition
		const dangerous2 = validateRegex("(a|a)+");
		expect(dangerous2.valid).toBe(false);
		expect(dangerous2.error).toContain("performance");

		// Pattern too long (also caught by nested quantifier check)
		const dangerous3 = validateRegex("a".repeat(600));
		expect(dangerous3.valid).toBe(false);
		expect(dangerous3.error).toBeDefined();
	});

	test("should accept safe regex patterns", () => {
		const { validateRegex } = require("../shared/validation");

		// Simple pattern
		const safe1 = validateRegex("function\\s+\\w+");
		expect(safe1.valid).toBe(true);
		expect(safe1.value).toBeInstanceOf(RegExp);

		// Character class
		const safe2 = validateRegex("[a-zA-Z0-9]+");
		expect(safe2.valid).toBe(true);

		// Anchors
		const safe3 = validateRegex("^start.*end$");
		expect(safe3.valid).toBe(true);
	});

	test("should reject malformed patterns", () => {
		const { validateRegex } = require("../shared/validation");

		// Unclosed bracket
		const malformed1 = validateRegex("[unclosed");
		expect(malformed1.valid).toBe(false);
		expect(malformed1.error).toContain("Invalid regex");

		// Unclosed paren
		const malformed2 = validateRegex("(unclosed");
		expect(malformed2.valid).toBe(false);
		expect(malformed2.error).toContain("Invalid regex");

		// Empty pattern
		const malformed3 = validateRegex("");
		expect(malformed3.valid).toBe(false);
		expect(malformed3.error).toContain("empty");
	});
});
