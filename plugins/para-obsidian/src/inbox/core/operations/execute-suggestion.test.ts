/**
 * Tests for execute-suggestion module.
 *
 * Focuses on the resolveParaFolder helper function.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	cleanupTestDir,
	createTempDir,
	writeTestFile,
} from "@sidequest/core/testing";
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

	test("falls back to defaults when paraFolders has undefined values", () => {
		const emptyConfig = {
			projects: undefined as unknown as string,
			areas: undefined as unknown as string,
			resources: undefined as unknown as string,
			archives: undefined as unknown as string,
			inbox: undefined as unknown as string,
		};

		// Should fall back to DEFAULT_PARA_FOLDERS when config values are undefined
		expect(resolveParaFolder("projects", emptyConfig)).toBe("01 Projects");
		expect(resolveParaFolder("areas", emptyConfig)).toBe("02 Areas");
		expect(resolveParaFolder("resources", emptyConfig)).toBe("03 Resources");
		expect(resolveParaFolder("archives", emptyConfig)).toBe("04 Archives");
		expect(resolveParaFolder("inbox", emptyConfig)).toBe("00 Inbox");
	});

	test("PARA names always resolve (cannot be unmapped)", () => {
		// All PARA names (inbox, projects, areas, resources, archives) are always mapped
		// due to the fallback chain in the implementation.
		// Even with empty config, they fall back to defaults.
		const partial = {
			projects: "Custom Projects",
			// other PARA names not defined - will use defaults
		};

		expect(resolveParaFolder("projects", partial)).toBe("Custom Projects");
		expect(resolveParaFolder("areas", partial)).toBe("02 Areas"); // Falls back
		expect(resolveParaFolder("Resources", partial)).toBe("03 Resources"); // Falls back
		expect(resolveParaFolder("INBOX", partial)).toBe("00 Inbox"); // Falls back
	});

	test("works with custom folder names", () => {
		const custom = {
			projects: "My Projects",
			areas: "Life Areas",
			resources: "Reference Materials",
			archives: "Old Stuff",
			inbox: "Drop Zone",
		};

		expect(resolveParaFolder("projects", custom)).toBe("My Projects");
		expect(resolveParaFolder("Areas", custom)).toBe("Life Areas");
		expect(resolveParaFolder("RESOURCES", custom)).toBe("Reference Materials");
		expect(resolveParaFolder("archives", custom)).toBe("Old Stuff");
		expect(resolveParaFolder("inbox", custom)).toBe("Drop Zone");
	});

	test("handles partial custom config with fallback to defaults", () => {
		const partial = {
			projects: "Custom Projects",
			resources: "My Resources",
			// areas, archives, inbox not defined - should use defaults
		};

		expect(resolveParaFolder("projects", partial)).toBe("Custom Projects");
		expect(resolveParaFolder("resources", partial)).toBe("My Resources");
		expect(resolveParaFolder("areas", partial)).toBe("02 Areas");
		expect(resolveParaFolder("archives", partial)).toBe("04 Archives");
		expect(resolveParaFolder("inbox", partial)).toBe("00 Inbox");
	});

	test("handles whitespace-only input", () => {
		// Whitespace-only strings are not PARA names, pass through
		expect(resolveParaFolder("   ")).toBe("   ");
		expect(resolveParaFolder("\t")).toBe("\t");
		expect(resolveParaFolder(" \n ")).toBe(" \n ");
	});

	test("handles very long path strings", () => {
		const longPath =
			"01 Projects/Very Long Project Name That Exceeds Normal Limits/Subdirectory/Another/Yet Another/File.md";
		expect(resolveParaFolder(longPath)).toBe(longPath);
	});

	test("handles paths with unicode characters", () => {
		// Unicode in paths should be preserved
		expect(resolveParaFolder("02 Areas/财务")).toBe("02 Areas/财务");
		expect(resolveParaFolder("03 Resources/日本語")).toBe(
			"03 Resources/日本語",
		);
		expect(resolveParaFolder("Здоровье")).toBe("Здоровье"); // Custom folder with Cyrillic
		expect(resolveParaFolder("🎯 Goals")).toBe("🎯 Goals"); // Emoji in folder name
	});

	test("handles special characters in custom folder names", () => {
		// Folders with special chars should pass through unchanged
		expect(resolveParaFolder("02 Areas & Projects")).toBe(
			"02 Areas & Projects",
		);
		expect(resolveParaFolder("Custom-Folder_123")).toBe("Custom-Folder_123");
		expect(resolveParaFolder("Folder (2024)")).toBe("Folder (2024)");
	});

	test("handles numbered folders with varying formats", () => {
		// Formats that start with 2 digits + space → pass through
		expect(resolveParaFolder("01 Custom")).toBe("01 Custom");
		expect(resolveParaFolder("99 Test")).toBe("99 Test");
		expect(resolveParaFolder("00 Zero")).toBe("00 Zero");

		// Other number formats → not PARA, pass through
		expect(resolveParaFolder("1 Single Digit")).toBe("1 Single Digit");
		expect(resolveParaFolder("123 Triple Digit")).toBe("123 Triple Digit");
		expect(resolveParaFolder("01-Hyphen")).toBe("01-Hyphen");
	});
});

describe("resolveParaFolder - vault validation", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = createTempDir("test-resolve-para-");
	});

	afterEach(() => {
		cleanupTestDir(tempDir);
	});

	test("validates semantic PARA names exist when vaultPath provided", () => {
		// Create vault structure
		writeTestFile(tempDir, "01 Projects/.gitkeep", "");
		writeTestFile(tempDir, "02 Areas/.gitkeep", "");
		writeTestFile(tempDir, "03 Resources/.gitkeep", "");

		// Should succeed - folders exist
		expect(resolveParaFolder("projects", undefined, tempDir)).toBe(
			"01 Projects",
		);
		expect(resolveParaFolder("areas", undefined, tempDir)).toBe("02 Areas");
		expect(resolveParaFolder("resources", undefined, tempDir)).toBe(
			"03 Resources",
		);

		// Should fail - folder doesn't exist
		expect(() => resolveParaFolder("archives", undefined, tempDir)).toThrow(
			"Destination folder does not exist: 04 Archives",
		);
	});

	test("validates full paths exist when vaultPath provided", () => {
		// Create nested structure
		writeTestFile(tempDir, "02 Areas/Finance/.gitkeep", "");
		writeTestFile(tempDir, "01 Projects/Vacation/.gitkeep", "");

		// Should succeed - paths exist
		expect(resolveParaFolder("02 Areas/Finance", undefined, tempDir)).toBe(
			"02 Areas/Finance",
		);
		expect(resolveParaFolder("01 Projects/Vacation", undefined, tempDir)).toBe(
			"01 Projects/Vacation",
		);

		// Should fail - path doesn't exist
		expect(() =>
			resolveParaFolder("02 Areas/Health", undefined, tempDir),
		).toThrow("Destination folder does not exist: 02 Areas/Health");
	});

	test("validates custom folder paths exist when vaultPath provided", () => {
		// Create custom folders
		writeTestFile(tempDir, "Custom Folder/.gitkeep", "");

		// Should succeed - folder exists
		expect(resolveParaFolder("Custom Folder", undefined, tempDir)).toBe(
			"Custom Folder",
		);

		// Should fail - folder doesn't exist
		expect(() => resolveParaFolder("Non Existent", undefined, tempDir)).toThrow(
			"Destination folder does not exist: Non Existent",
		);
	});

	test("validates numbered folders exist when vaultPath provided", () => {
		// Create numbered folders
		writeTestFile(tempDir, "01 Projects/.gitkeep", "");

		// Should succeed - folder exists
		expect(resolveParaFolder("01 Projects", undefined, tempDir)).toBe(
			"01 Projects",
		);

		// Should fail - folder doesn't exist
		expect(() => resolveParaFolder("99 Unknown", undefined, tempDir)).toThrow(
			"Destination folder does not exist: 99 Unknown",
		);
	});

	test("skips validation when vaultPath not provided (backward compatibility)", () => {
		// No vaultPath provided - should not validate, just resolve
		expect(resolveParaFolder("projects")).toBe("01 Projects");
		expect(resolveParaFolder("02 Areas/Finance")).toBe("02 Areas/Finance");
		expect(resolveParaFolder("Custom Folder")).toBe("Custom Folder");

		// These would fail if validation was enabled, but should succeed without vaultPath
		expect(resolveParaFolder("archives")).toBe("04 Archives");
		expect(resolveParaFolder("Non Existent")).toBe("Non Existent");
	});

	test("validates with custom paraFolders mapping", () => {
		// Create custom folder structure
		writeTestFile(tempDir, "Projects/.gitkeep", "");
		writeTestFile(tempDir, "Areas/.gitkeep", "");

		const custom = {
			projects: "Projects",
			areas: "Areas",
			resources: "Resources",
			archives: "Archives",
			inbox: "Inbox",
		};

		// Should succeed - custom folder exists
		expect(resolveParaFolder("projects", custom, tempDir)).toBe("Projects");
		expect(resolveParaFolder("areas", custom, tempDir)).toBe("Areas");

		// Should fail - custom folder doesn't exist
		expect(() => resolveParaFolder("resources", custom, tempDir)).toThrow(
			"Destination folder does not exist: Resources",
		);
	});
});
