/**
 * Tests for execute-suggestion module.
 *
 * Focuses on the resolveParaFolder helper function.
 */

import { describe, expect, test } from "bun:test";
import { resolveParaFolder } from "./execute-suggestion";

describe("resolveParaFolder", () => {
	test("maps semantic PARA names to numbered folders (lowercase)", () => {
		expect(resolveParaFolder("projects")).toBe("01 Projects");
		expect(resolveParaFolder("areas")).toBe("02 Areas");
		expect(resolveParaFolder("resources")).toBe("03 Resources");
		expect(resolveParaFolder("archives")).toBe("04 Archives");
		expect(resolveParaFolder("inbox")).toBe("00 Inbox");
	});

	test("maps semantic PARA names to numbered folders (capitalized)", () => {
		expect(resolveParaFolder("Projects")).toBe("01 Projects");
		expect(resolveParaFolder("Areas")).toBe("02 Areas");
		expect(resolveParaFolder("Resources")).toBe("03 Resources");
		expect(resolveParaFolder("Archives")).toBe("04 Archives");
		expect(resolveParaFolder("Inbox")).toBe("00 Inbox");
	});

	test("passes through full paths unchanged (with /)", () => {
		expect(resolveParaFolder("02 Areas/Finance")).toBe("02 Areas/Finance");
		expect(resolveParaFolder("01 Projects/Vacation")).toBe(
			"01 Projects/Vacation",
		);
		expect(resolveParaFolder("03 Resources/Books")).toBe("03 Resources/Books");
	});

	test("passes through numbered folders unchanged (starts with digits)", () => {
		expect(resolveParaFolder("01 Projects")).toBe("01 Projects");
		expect(resolveParaFolder("02 Areas")).toBe("02 Areas");
		expect(resolveParaFolder("03 Resources")).toBe("03 Resources");
	});

	test("uses custom paraFolders when provided", () => {
		const custom = {
			projects: "Projects",
			areas: "Areas",
			resources: "Resources",
			archives: "Archives",
			inbox: "Inbox",
		};
		expect(resolveParaFolder("projects", custom)).toBe("Projects");
		expect(resolveParaFolder("areas", custom)).toBe("Areas");
	});

	test("falls back to DEFAULT_PARA_FOLDERS when custom mapping missing", () => {
		const partial = {
			projects: "Custom Projects",
		};
		// projects uses custom
		expect(resolveParaFolder("projects", partial)).toBe("Custom Projects");
		// areas falls back to default (02 Areas)
		expect(resolveParaFolder("areas", partial)).toBe("02 Areas");
	});

	test("handles case-insensitive PARA names", () => {
		// The function lowercases input before checking mapping
		expect(resolveParaFolder("PROJECTS")).toBe("01 Projects");
		expect(resolveParaFolder("ArEaS")).toBe("02 Areas");
		expect(resolveParaFolder("RESOURCES")).toBe("03 Resources");
	});

	test("passes through custom folder names unchanged", () => {
		// These don't match PARA patterns, so they're custom folders
		expect(resolveParaFolder("Custom Folder")).toBe("Custom Folder");
		expect(resolveParaFolder("Archive Old")).toBe("Archive Old");
		expect(resolveParaFolder("MyProjects")).toBe("MyProjects");
	});

	test("handles edge cases", () => {
		// Empty string - not a PARA name, pass through
		expect(resolveParaFolder("")).toBe("");

		// Single slash - considered a path
		expect(resolveParaFolder("Foo/Bar")).toBe("Foo/Bar");

		// Starts with number but not PARA format
		expect(resolveParaFolder("2024 Journal")).toBe("2024 Journal");
	});
});
