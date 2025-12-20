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
import { createSuggestionId } from "../../types";
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

describe("executeSuggestion - movedFrom field", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = createTempDir("test-execute-suggestion-");
		process.env.PARA_VAULT = tempDir;

		// Create necessary folders
		writeTestFile(tempDir, "00 Inbox/.gitkeep", "");
		writeTestFile(tempDir, "03 Resources/.gitkeep", "");
		writeTestFile(tempDir, "02 Areas/Health/.gitkeep", "");
		writeTestFile(tempDir, "Attachments/.gitkeep", "");
		writeTestFile(tempDir, "Templates/.gitkeep", "");
		writeTestFile(tempDir, ".inbox-staging/.gitkeep", "");
	});

	afterEach(() => {
		cleanupTestDir(tempDir);
		delete process.env.PARA_VAULT;
	});

	test("should return movedFrom when executing bookmark suggestion", async () => {
		// Setup: Create a bookmark file in inbox
		const bookmarkPath = "00 Inbox/test-bookmark.md";
		const bookmarkContent = `---
title: Test Bookmark
url: https://example.com
type: bookmark
---
# Test Bookmark Content
`;
		writeTestFile(tempDir, bookmarkPath, bookmarkContent);

		// Create suggestion for bookmark
		const suggestion = {
			id: createSuggestionId(),
			action: "create-note" as const,
			source: bookmarkPath,
			processor: "notes" as const,
			confidence: "high" as const,
			detectionSource: "frontmatter" as const,
			reason: "Pre-classified bookmark from Web Clipper",
			suggestedNoteType: "bookmark",
			suggestedTitle: "Test Bookmark",
			suggestedDestination: "03 Resources",
		};

		const config = {
			vaultPath: tempDir,
			inboxFolder: "00 Inbox",
			attachmentsFolder: "Attachments",
			templatesFolder: "Templates",
		};

		// Create registry
		const { createRegistry } = await import(
			"../../registry/processed-registry"
		);
		const registryPath = `${tempDir}/.para-obsidian-registry.json`;
		const registry = createRegistry(registryPath);
		await registry.load();

		// Execute suggestion
		const { executeSuggestion } = await import("./execute-suggestion");
		const result = await executeSuggestion(
			suggestion,
			config,
			registry,
			"test-cid",
		);

		// Verify result
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.movedFrom).toBe(bookmarkPath);
			expect(result.createdNote).toMatch(/03 Resources\/.+\.md$/);
			// Bookmark should not have movedAttachment
			expect(result.movedAttachment).toBeUndefined();
		}
	});

	test("should return movedFrom when executing pre-classified note suggestion", async () => {
		// Setup: Create a pre-classified markdown file in inbox
		const notePath = "00 Inbox/Medical Statement.md";
		const noteContent = `---
title: Medical Statement
type: medical-statement
---
# Medical Statement
Pre-classified content
`;
		writeTestFile(tempDir, notePath, noteContent);

		// Create a template for medical-statement
		const templateContent = `---
title: <%= title %>
type: medical-statement
---
# <%= title %>

## Attachments
`;
		writeTestFile(tempDir, "Templates/medical-statement.md", templateContent);

		// Create suggestion for pre-classified note
		const suggestion = {
			id: createSuggestionId(),
			action: "create-note" as const,
			source: notePath,
			processor: "notes" as const,
			confidence: "high" as const,
			detectionSource: "frontmatter" as const,
			reason: "Pre-classified medical statement from frontmatter",
			suggestedNoteType: "medical-statement",
			suggestedTitle: "Medical Statement",
			suggestedArea: "Health",
		};

		const config = {
			vaultPath: tempDir,
			inboxFolder: "00 Inbox",
			attachmentsFolder: "Attachments",
			templatesFolder: "Templates",
		};

		// Create registry
		const { createRegistry } = await import(
			"../../registry/processed-registry"
		);
		const registryPath = `${tempDir}/.para-obsidian-registry.json`;
		const registry = createRegistry(registryPath);
		await registry.load();

		// Create area path map to resolve "Health" to "02 Areas/Health"
		const areaPathMap = new Map([["health", "02 Areas/Health"]]);
		const projectPathMap = new Map();

		// Execute suggestion
		const { executeSuggestion } = await import("./execute-suggestion");
		const result = await executeSuggestion(
			suggestion,
			config,
			registry,
			"test-cid",
			{ areaPathMap, projectPathMap },
		);

		// Verify result
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.movedFrom).toBe(notePath);
			expect(result.createdNote).toMatch(/02 Areas\/Health\/.+\.md$/);
			// Pre-classified note should have movedAttachment
			expect(result.movedAttachment).toMatch(/Attachments\/.+\.md$/);
		}
	});

	test("should return movedFrom for PDF attachment with created note", async () => {
		// Setup: Create a PDF file in inbox
		const pdfPath = "00 Inbox/invoice.pdf";
		const pdfContent = "Mock PDF content for testing";
		writeTestFile(tempDir, pdfPath, pdfContent);

		// Create a template for invoice
		const templateContent = `---
title: <%= title %>
type: invoice
---
# <%= title %>

## Attachments
`;
		writeTestFile(tempDir, "Templates/invoice.md", templateContent);

		// Create suggestion for PDF with note creation
		const suggestion = {
			id: createSuggestionId(),
			action: "create-note" as const,
			source: pdfPath,
			processor: "attachments" as const,
			confidence: "high" as const,
			detectionSource: "llm+heuristic" as const,
			reason: "Detected invoice from PDF content and filename",
			suggestedNoteType: "invoice",
			suggestedTitle: "Invoice 2024-001",
			suggestedDestination: "02 Areas/Finance",
			extractedFields: {
				amount: "1234.56",
				provider: "Test Provider",
				date: "2024-01-15",
			},
			suggestedAttachmentName: "20240115-abcd-invoice.pdf",
		};

		const config = {
			vaultPath: tempDir,
			inboxFolder: "00 Inbox",
			attachmentsFolder: "Attachments",
			templatesFolder: "Templates",
		};

		// Create Finance area
		writeTestFile(tempDir, "02 Areas/Finance/.gitkeep", "");

		// Create registry
		const { createRegistry } = await import(
			"../../registry/processed-registry"
		);
		const registryPath = `${tempDir}/.para-obsidian-registry.json`;
		const registry = createRegistry(registryPath);
		await registry.load();

		// Execute suggestion
		const { executeSuggestion } = await import("./execute-suggestion");
		const result = await executeSuggestion(
			suggestion,
			config,
			registry,
			"test-cid",
		);

		// Verify result
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.movedFrom).toBe(pdfPath);
			expect(result.createdNote).toBeDefined();
			expect(result.movedAttachment).toMatch(/Attachments\/.+\.pdf$/);
		}
	});

	test("should return movedFrom even when note creation fails", async () => {
		// Setup: Create a file in inbox
		const filePath = "00 Inbox/test.pdf";
		writeTestFile(tempDir, filePath, "test content");

		// Create suggestion with invalid template (will fail note creation)
		const suggestion = {
			id: createSuggestionId(),
			action: "create-note" as const,
			source: filePath,
			processor: "attachments" as const,
			confidence: "high" as const,
			detectionSource: "llm" as const,
			reason: "Test suggestion with invalid template",
			suggestedNoteType: "nonexistent-template",
			suggestedTitle: "Test Note",
		};

		const config = {
			vaultPath: tempDir,
			inboxFolder: "00 Inbox",
			attachmentsFolder: "Attachments",
			templatesFolder: "Templates",
		};

		// Create registry
		const { createRegistry } = await import(
			"../../registry/processed-registry"
		);
		const registryPath = `${tempDir}/.para-obsidian-registry.json`;
		const registry = createRegistry(registryPath);
		await registry.load();

		// Execute suggestion (will fail due to missing template)
		const { executeSuggestion } = await import("./execute-suggestion");
		const result = await executeSuggestion(
			suggestion,
			config,
			registry,
			"test-cid",
		);

		// Verify that movedFrom is NOT returned when execution fails
		// (file should remain in inbox for retry)
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBeDefined();
			// movedFrom should not be present in failed results
			expect("movedFrom" in result).toBe(false);
		}
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

describe("resolveParaFolder - Security", () => {
	const vaultPath = "/test/vault";
	const paraFolders = {
		inbox: "00 Inbox",
		areas: "02 Areas",
		projects: "01 Projects",
		resources: "03 Resources",
		archives: "04 Archives",
	};

	test("rejects path traversal with ../", () => {
		expect(() =>
			resolveParaFolder("../../secrets", paraFolders, vaultPath),
		).toThrow("Unsafe path pattern");
	});

	test("rejects absolute paths", () => {
		expect(() =>
			resolveParaFolder("/etc/passwd", paraFolders, vaultPath),
		).toThrow("Unsafe path pattern");
	});

	test("rejects home directory expansion", () => {
		expect(() =>
			resolveParaFolder("~/secrets", paraFolders, vaultPath),
		).toThrow("Unsafe path pattern");
	});

	test("rejects paths that escape vault via resolve", () => {
		// This would resolve to /test/secrets, outside /test/vault
		expect(() =>
			resolveParaFolder("vault/../secrets", paraFolders, vaultPath),
		).toThrow("Unsafe path pattern");
	});

	test("allows safe paths within vault", () => {
		// Note: These won't validate folder existence (vaultPath doesn't exist in this test)
		// but they should pass path safety validation
		expect(() =>
			resolveParaFolder("02 Areas/Finance", paraFolders, vaultPath),
		).not.toThrow("Unsafe path pattern");

		expect(() =>
			resolveParaFolder("projects", paraFolders, vaultPath),
		).not.toThrow("Unsafe path pattern");
	});

	test("allows semantic PARA names with vaultPath", () => {
		// These should pass safety validation but fail on folder existence
		expect(() => resolveParaFolder("projects", paraFolders, vaultPath)).toThrow(
			"Destination folder does not exist",
		);

		expect(() => resolveParaFolder("areas", paraFolders, vaultPath)).toThrow(
			"Destination folder does not exist",
		);
	});

	test("skips validation when vaultPath not provided", () => {
		// Without vaultPath, should not validate path safety
		// (backward compatibility - only validates when explicitly enabled)
		expect(resolveParaFolder("../../secrets", paraFolders)).toBe(
			"../../secrets",
		);
		expect(resolveParaFolder("/etc/passwd", paraFolders)).toBe("/etc/passwd");
		expect(resolveParaFolder("~/secrets", paraFolders)).toBe("~/secrets");
	});
});

describe("resolveParaFolder - Area/Project Resolution", () => {
	let tempDir: string;
	const paraFolders = {
		inbox: "00 Inbox",
		areas: "02 Areas",
		projects: "01 Projects",
		resources: "03 Resources",
		archives: "04 Archives",
	};

	beforeEach(() => {
		tempDir = createTempDir("test-area-project-");
	});

	afterEach(() => {
		cleanupTestDir(tempDir);
	});

	test("resolves area names to full paths (case-insensitive)", () => {
		// Create vault structure
		writeTestFile(tempDir, "02 Areas/Health/.gitkeep", "");
		writeTestFile(tempDir, "02 Areas/Finance/.gitkeep", "");

		const areaPathMap = new Map([
			["health", "02 Areas/Health"],
			["finance", "02 Areas/Finance"],
		]);
		const projectPathMap = new Map();

		// Lowercase
		expect(
			resolveParaFolder("health", paraFolders, tempDir, {
				areaPathMap,
				projectPathMap,
			}),
		).toBe("02 Areas/Health");

		// Mixed case
		expect(
			resolveParaFolder("Health", paraFolders, tempDir, {
				areaPathMap,
				projectPathMap,
			}),
		).toBe("02 Areas/Health");

		// Uppercase
		expect(
			resolveParaFolder("FINANCE", paraFolders, tempDir, {
				areaPathMap,
				projectPathMap,
			}),
		).toBe("02 Areas/Finance");
	});

	test("resolves project names to full paths (case-insensitive)", () => {
		// Create vault structure
		writeTestFile(tempDir, "01 Projects/Tax 2024/.gitkeep", "");
		writeTestFile(tempDir, "01 Projects/Vacation Planning/.gitkeep", "");

		const areaPathMap = new Map();
		const projectPathMap = new Map([
			["tax 2024", "01 Projects/Tax 2024"],
			["vacation planning", "01 Projects/Vacation Planning"],
		]);

		// Lowercase
		expect(
			resolveParaFolder("tax 2024", paraFolders, tempDir, {
				areaPathMap,
				projectPathMap,
			}),
		).toBe("01 Projects/Tax 2024");

		// Mixed case
		expect(
			resolveParaFolder("Vacation Planning", paraFolders, tempDir, {
				areaPathMap,
				projectPathMap,
			}),
		).toBe("01 Projects/Vacation Planning");

		// Uppercase
		expect(
			resolveParaFolder("TAX 2024", paraFolders, tempDir, {
				areaPathMap,
				projectPathMap,
			}),
		).toBe("01 Projects/Tax 2024");
	});

	test("PARA folder names take precedence over area names", () => {
		// Create a folder structure where an area is named "areas"
		writeTestFile(tempDir, "02 Areas/.gitkeep", "");
		writeTestFile(tempDir, "02 Areas/Areas/.gitkeep", "");

		const areaPathMap = new Map([["areas", "02 Areas/Areas"]]);
		const projectPathMap = new Map();

		// "areas" should resolve to PARA folder (02 Areas), not the area path
		expect(
			resolveParaFolder("areas", paraFolders, tempDir, {
				areaPathMap,
				projectPathMap,
			}),
		).toBe("02 Areas");
	});

	test("PARA folder names take precedence over project names", () => {
		// Create a folder structure where a project is named "projects"
		writeTestFile(tempDir, "01 Projects/.gitkeep", "");
		writeTestFile(tempDir, "01 Projects/Projects/.gitkeep", "");

		const areaPathMap = new Map();
		const projectPathMap = new Map([["projects", "01 Projects/Projects"]]);

		// "projects" should resolve to PARA folder (01 Projects), not the project path
		expect(
			resolveParaFolder("projects", paraFolders, tempDir, {
				areaPathMap,
				projectPathMap,
			}),
		).toBe("01 Projects");
	});

	test("throws error for unknown destination with maps provided", () => {
		const areaPathMap = new Map([["health", "02 Areas/Health"]]);
		const projectPathMap = new Map([["tax", "01 Projects/Tax"]]);

		expect(() =>
			resolveParaFolder("unknown", paraFolders, tempDir, {
				areaPathMap,
				projectPathMap,
			}),
		).toThrow("Unknown destination");
	});

	test("helpful error message lists available areas and projects", () => {
		const areaPathMap = new Map([
			["health", "02 Areas/Health"],
			["finance", "02 Areas/Finance"],
		]);
		const projectPathMap = new Map([
			["tax", "01 Projects/Tax"],
			["vacation", "01 Projects/Vacation"],
		]);

		try {
			resolveParaFolder("unknown", paraFolders, tempDir, {
				areaPathMap,
				projectPathMap,
			});
			expect.unreachable("Should have thrown error");
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			expect(message).toContain("Unknown destination");
			expect(message).toContain("Available areas:");
			expect(message).toContain("02 Areas/Health");
			expect(message).toContain("02 Areas/Finance");
			expect(message).toContain("Available projects:");
			expect(message).toContain("01 Projects/Tax");
			expect(message).toContain("01 Projects/Vacation");
		}
	});

	test("error message shows 'none' for empty area list", () => {
		const areaPathMap = new Map(); // Empty
		const projectPathMap = new Map([["tax", "01 Projects/Tax"]]);

		try {
			resolveParaFolder("unknown", paraFolders, tempDir, {
				areaPathMap,
				projectPathMap,
			});
			expect.unreachable("Should have thrown error");
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			expect(message).toContain("Available areas: none");
		}
	});

	test("error message omits projects section when empty", () => {
		const areaPathMap = new Map([["health", "02 Areas/Health"]]);
		const projectPathMap = new Map(); // Empty

		try {
			resolveParaFolder("unknown", paraFolders, tempDir, {
				areaPathMap,
				projectPathMap,
			});
			expect.unreachable("Should have thrown error");
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			expect(message).toContain("Available areas:");
			expect(message).not.toContain("Available projects:");
		}
	});

	test("validates area folder exists when vaultPath provided", () => {
		// Create only one area
		writeTestFile(tempDir, "02 Areas/Health/.gitkeep", "");

		const areaPathMap = new Map([
			["health", "02 Areas/Health"],
			["finance", "02 Areas/Finance"], // Doesn't exist
		]);
		const projectPathMap = new Map();

		// Should succeed - folder exists
		expect(
			resolveParaFolder("health", paraFolders, tempDir, {
				areaPathMap,
				projectPathMap,
			}),
		).toBe("02 Areas/Health");

		// Should fail - folder doesn't exist
		expect(() =>
			resolveParaFolder("finance", paraFolders, tempDir, {
				areaPathMap,
				projectPathMap,
			}),
		).toThrow("Area folder does not exist: 02 Areas/Finance");
	});

	test("validates project folder exists when vaultPath provided", () => {
		// Create only one project
		writeTestFile(tempDir, "01 Projects/Tax/.gitkeep", "");

		const areaPathMap = new Map();
		const projectPathMap = new Map([
			["tax", "01 Projects/Tax"],
			["vacation", "01 Projects/Vacation"], // Doesn't exist
		]);

		// Should succeed - folder exists
		expect(
			resolveParaFolder("tax", paraFolders, tempDir, {
				areaPathMap,
				projectPathMap,
			}),
		).toBe("01 Projects/Tax");

		// Should fail - folder doesn't exist
		expect(() =>
			resolveParaFolder("vacation", paraFolders, tempDir, {
				areaPathMap,
				projectPathMap,
			}),
		).toThrow("Project folder does not exist: 01 Projects/Vacation");
	});

	test("backward compatibility: falls through when no maps provided", () => {
		// Create a custom folder
		writeTestFile(tempDir, "Custom Folder/.gitkeep", "");

		// Without maps, should fall through to custom folder validation
		expect(resolveParaFolder("Custom Folder", paraFolders, tempDir)).toBe(
			"Custom Folder",
		);

		// Without maps, unknown folder should fail on existence check
		expect(() =>
			resolveParaFolder("Unknown Folder", paraFolders, tempDir),
		).toThrow("Destination folder does not exist: Unknown Folder");
	});

	test("backward compatibility: no error for unknown destination without maps", () => {
		// Without maps, should just pass through and validate existence
		// (existing behavior - doesn't throw "Unknown destination" error)
		expect(() =>
			resolveParaFolder("Some Random Name", paraFolders, tempDir),
		).toThrow("Destination folder does not exist");

		expect(() =>
			resolveParaFolder("Some Random Name", paraFolders, tempDir),
		).not.toThrow("Unknown destination");
	});

	test("area names with special characters", () => {
		// Create area with special chars
		writeTestFile(tempDir, "02 Areas/Health & Fitness/.gitkeep", "");

		const areaPathMap = new Map([
			["health & fitness", "02 Areas/Health & Fitness"],
		]);
		const projectPathMap = new Map();

		expect(
			resolveParaFolder("health & fitness", paraFolders, tempDir, {
				areaPathMap,
				projectPathMap,
			}),
		).toBe("02 Areas/Health & Fitness");
	});

	test("project names with numbers", () => {
		// Create project with numbers
		writeTestFile(tempDir, "01 Projects/Q1 2024 Planning/.gitkeep", "");

		const areaPathMap = new Map();
		const projectPathMap = new Map([
			["q1 2024 planning", "01 Projects/Q1 2024 Planning"],
		]);

		expect(
			resolveParaFolder("q1 2024 planning", paraFolders, tempDir, {
				areaPathMap,
				projectPathMap,
			}),
		).toBe("01 Projects/Q1 2024 Planning");
	});

	test("both areaPathMap and projectPathMap can contain entries", () => {
		// Create both areas and projects
		writeTestFile(tempDir, "02 Areas/Health/.gitkeep", "");
		writeTestFile(tempDir, "01 Projects/Tax/.gitkeep", "");

		const areaPathMap = new Map([["health", "02 Areas/Health"]]);
		const projectPathMap = new Map([["tax", "01 Projects/Tax"]]);

		// Should resolve both correctly
		expect(
			resolveParaFolder("health", paraFolders, tempDir, {
				areaPathMap,
				projectPathMap,
			}),
		).toBe("02 Areas/Health");

		expect(
			resolveParaFolder("tax", paraFolders, tempDir, {
				areaPathMap,
				projectPathMap,
			}),
		).toBe("01 Projects/Tax");
	});

	test("only areaPathMap provided (no projectPathMap)", () => {
		// Create area
		writeTestFile(tempDir, "02 Areas/Health/.gitkeep", "");

		const areaPathMap = new Map([["health", "02 Areas/Health"]]);

		// Should resolve area correctly (no projectPathMap in options)
		expect(
			resolveParaFolder("health", paraFolders, tempDir, {
				areaPathMap,
			}),
		).toBe("02 Areas/Health");

		// Unknown should fall through to custom folder logic (no maps check requires BOTH maps)
		expect(() =>
			resolveParaFolder("unknown", paraFolders, tempDir, {
				areaPathMap,
			}),
		).toThrow("Destination folder does not exist");
	});

	test("only projectPathMap provided (no areaPathMap)", () => {
		// Create project
		writeTestFile(tempDir, "01 Projects/Tax/.gitkeep", "");

		const projectPathMap = new Map([["tax", "01 Projects/Tax"]]);

		// Should resolve project correctly (no areaPathMap in options)
		expect(
			resolveParaFolder("tax", paraFolders, tempDir, {
				projectPathMap,
			}),
		).toBe("01 Projects/Tax");

		// Unknown should fall through to custom folder logic (no maps check requires BOTH maps)
		expect(() =>
			resolveParaFolder("unknown", paraFolders, tempDir, {
				projectPathMap,
			}),
		).toThrow("Destination folder does not exist");
	});
});
