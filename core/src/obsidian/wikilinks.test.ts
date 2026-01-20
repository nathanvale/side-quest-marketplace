import { describe, expect, test } from "bun:test";
import { stripWikilinks, stripWikilinksOrValue } from "./wikilinks";

describe("stripWikilinks", () => {
	test("strips wikilink brackets from value", () => {
		expect(stripWikilinks("[[Home]]")).toBe("Home");
		expect(stripWikilinks("[[My Project]]")).toBe("My Project");
		expect(stripWikilinks("[[Multi Word Title]]")).toBe("Multi Word Title");
	});

	test("preserves plain text without brackets", () => {
		expect(stripWikilinks("Home")).toBe("Home");
		expect(stripWikilinks("My Project")).toBe("My Project");
		expect(stripWikilinks("Some text")).toBe("Some text");
	});

	test("returns null for empty wikilinks", () => {
		expect(stripWikilinks("[[]]")).toBe(null);
	});

	test("returns null for null input", () => {
		expect(stripWikilinks(null)).toBe(null);
	});

	test("returns null for undefined input", () => {
		expect(stripWikilinks(undefined)).toBe(null);
	});

	test('returns null for "null" string', () => {
		expect(stripWikilinks("null")).toBe(null);
	});

	test("handles whitespace around wikilinks", () => {
		expect(stripWikilinks("  [[Home]]  ")).toBe("Home");
		expect(stripWikilinks("[[  Home  ]]")).toBe("Home");
	});

	test("handles whitespace in plain text", () => {
		expect(stripWikilinks("  Home  ")).toBe("Home");
	});

	test("returns null for empty strings after stripping", () => {
		expect(stripWikilinks("")).toBe(null);
		expect(stripWikilinks("   ")).toBe(null);
		expect(stripWikilinks("[[   ]]")).toBe(null);
	});

	test("preserves wikilinks with aliases", () => {
		// Note: Only strips outer brackets, preserves internal structure
		expect(stripWikilinks("[[Home|My Home]]")).toBe("Home|My Home");
	});

	test("preserves wikilinks with headings", () => {
		// Note: Only strips outer brackets, preserves internal structure
		expect(stripWikilinks("[[Home#Section]]")).toBe("Home#Section");
	});

	test("preserves wikilinks with block references", () => {
		// Note: Only strips outer brackets, preserves internal structure
		expect(stripWikilinks("[[Home^block]]")).toBe("Home^block");
	});

	test("handles partial brackets", () => {
		// Only complete wikilink brackets are stripped
		expect(stripWikilinks("[[Home")).toBe("[[Home");
		expect(stripWikilinks("Home]]")).toBe("Home]]");
		expect(stripWikilinks("[Home]")).toBe("[Home]");
	});

	test('handles "null" in wikilinks', () => {
		expect(stripWikilinks("[[null]]")).toBe(null);
	});
});

describe("stripWikilinksOrValue", () => {
	test("strips wikilink brackets from value", () => {
		expect(stripWikilinksOrValue("[[Home]]")).toBe("Home");
		expect(stripWikilinksOrValue("[[My Project]]")).toBe("My Project");
	});

	test("returns original value without brackets", () => {
		expect(stripWikilinksOrValue("Home")).toBe("Home");
		expect(stripWikilinksOrValue("My Project")).toBe("My Project");
	});

	test("returns original value for partial brackets", () => {
		expect(stripWikilinksOrValue("[[Home")).toBe("[[Home");
		expect(stripWikilinksOrValue("Home]]")).toBe("Home]]");
		expect(stripWikilinksOrValue("[Home]")).toBe("[Home]");
	});

	test("returns original value for empty wikilinks", () => {
		expect(stripWikilinksOrValue("[[]]")).toBe("[[]]");
	});

	test("preserves wikilinks with aliases", () => {
		expect(stripWikilinksOrValue("[[Home|My Home]]")).toBe("Home|My Home");
	});

	test("preserves wikilinks with headings", () => {
		expect(stripWikilinksOrValue("[[Home#Section]]")).toBe("Home#Section");
	});

	test("preserves wikilinks with block references", () => {
		expect(stripWikilinksOrValue("[[Home^block]]")).toBe("Home^block");
	});

	test("handles whitespace inside wikilinks", () => {
		expect(stripWikilinksOrValue("[[  Home  ]]")).toBe("  Home  ");
	});

	test("handles empty string", () => {
		expect(stripWikilinksOrValue("")).toBe("");
	});
});
