/**
 * Tests for destination resolver
 *
 * Tests path resolution logic for routing notes from inbox to PARA destinations.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
	createTestVault,
	useTestVaultCleanup,
	writeVaultFile,
} from "../../testing/utils";
import { resolveDestination } from "./resolver";

describe("inbox/routing/resolver", () => {
	const { trackVault, getAfterEachHook } = useTestVaultCleanup();
	afterEach(getAfterEachHook());

	// Test helpers
	const createProject = (vaultPath: string, name: string) => {
		mkdirSync(join(vaultPath, `01 Projects/${name}`), { recursive: true });
	};

	const createArea = (vaultPath: string, name: string) => {
		mkdirSync(join(vaultPath, `02 Areas/${name}`), { recursive: true });
	};

	const createProjectWithNote = (
		vaultPath: string,
		name: string,
		content: string,
	) => {
		mkdirSync(join(vaultPath, "01 Projects"), { recursive: true });
		writeVaultFile(vaultPath, `01 Projects/${name}.md`, content);
	};

	const createAreaWithNote = (
		vaultPath: string,
		name: string,
		content: string,
	) => {
		mkdirSync(join(vaultPath, "02 Areas"), { recursive: true });
		writeVaultFile(vaultPath, `02 Areas/${name}.md`, content);
	};

	const expectDestination = (
		result: ReturnType<typeof resolveDestination>,
		expected: string,
	) => {
		expect(result).not.toBeNull();
		expect(result?.destination).toBe(expected);
	};

	const expectNull = (result: ReturnType<typeof resolveDestination>) => {
		expect(result).toBeNull();
	};

	describe("resolveDestination", () => {
		describe("project resolution", () => {
			test("resolves to existing project folder", () => {
				const vaultPath = createTestVault();
				trackVault(vaultPath);
				createProject(vaultPath, "Alpha");

				const result = resolveDestination({ project: "Alpha" }, vaultPath);

				expectDestination(result, "01 Projects/Alpha");
				expect(result?.colocate).toBeUndefined();
			});

			test("resolves to existing project folder with wikilink format", () => {
				const vaultPath = createTestVault();
				trackVault(vaultPath);
				createProject(vaultPath, "Alpha");

				const result = resolveDestination({ project: "[[Alpha]]" }, vaultPath);

				expectDestination(result, "01 Projects/Alpha");
				expect(result?.colocate).toBeUndefined();
			});

			test("handles case-insensitive project folder match", () => {
				const vaultPath = createTestVault();
				trackVault(vaultPath);
				createProject(vaultPath, "MyProject");

				const result = resolveDestination({ project: "myproject" }, vaultPath);

				expectDestination(result, "01 Projects/MyProject");
			});

			test("resolves project file and returns colocate info", () => {
				const vaultPath = createTestVault();
				trackVault(vaultPath);
				createProjectWithNote(vaultPath, "Alpha", "---\ntitle: Alpha\n---\n");

				const result = resolveDestination({ project: "Alpha" }, vaultPath);

				expectDestination(result, "01 Projects/Alpha");
				expect(result?.colocate).toEqual({
					sourceNotePath: "01 Projects/Alpha.md",
					folderPath: "01 Projects/Alpha",
				});
			});

			test("returns null when project does not exist", () => {
				const vaultPath = createTestVault();
				trackVault(vaultPath);
				mkdirSync(join(vaultPath, "01 Projects"), { recursive: true });

				const result = resolveDestination(
					{ project: "Nonexistent" },
					vaultPath,
				);

				expectNull(result);
			});

			test("returns null when projects folder does not exist", () => {
				const vaultPath = createTestVault();
				trackVault(vaultPath);
				const result = resolveDestination({ project: "Alpha" }, vaultPath);

				expectNull(result);
			});

			test("prioritizes project over area when both present", () => {
				const vaultPath = createTestVault();
				trackVault(vaultPath);
				createProject(vaultPath, "Alpha");
				createArea(vaultPath, "Health");

				const result = resolveDestination(
					{ project: "Alpha", area: "Health" },
					vaultPath,
				);

				expectDestination(result, "01 Projects/Alpha");
			});
		});

		describe("area resolution", () => {
			test("resolves to existing area folder", () => {
				const vaultPath = createTestVault();
				trackVault(vaultPath);
				createArea(vaultPath, "Health");

				const result = resolveDestination({ area: "Health" }, vaultPath);

				expectDestination(result, "02 Areas/Health");
				expect(result?.colocate).toBeUndefined();
			});

			test("resolves to existing area folder with wikilink format", () => {
				const vaultPath = createTestVault();
				trackVault(vaultPath);
				createArea(vaultPath, "Health");

				const result = resolveDestination({ area: "[[Health]]" }, vaultPath);

				expectDestination(result, "02 Areas/Health");
			});

			test("handles case-insensitive area folder match", () => {
				const vaultPath = createTestVault();
				trackVault(vaultPath);
				createArea(vaultPath, "MyArea");

				const result = resolveDestination({ area: "myarea" }, vaultPath);

				expectDestination(result, "02 Areas/MyArea");
			});

			test("resolves area file and returns colocate info", () => {
				const vaultPath = createTestVault();
				trackVault(vaultPath);
				createAreaWithNote(
					vaultPath,
					"Career & Contracting",
					"---\ntitle: Career\n---\n",
				);

				const result = resolveDestination(
					{ area: "Career & Contracting" },
					vaultPath,
				);

				expectDestination(result, "02 Areas/Career & Contracting");
				expect(result?.colocate).toEqual({
					sourceNotePath: "02 Areas/Career & Contracting.md",
					folderPath: "02 Areas/Career & Contracting",
				});
			});

			test("returns null when area does not exist", () => {
				const vaultPath = createTestVault();
				trackVault(vaultPath);
				mkdirSync(join(vaultPath, "02 Areas"), { recursive: true });

				const result = resolveDestination({ area: "Nonexistent" }, vaultPath);

				expectNull(result);
			});

			test("returns null when areas folder does not exist", () => {
				const vaultPath = createTestVault();
				trackVault(vaultPath);
				const result = resolveDestination({ area: "Health" }, vaultPath);

				expectNull(result);
			});
		});

		describe("security and validation", () => {
			test.each([
				{
					testName: "rejects path traversal in project name",
					input: { project: "../etc/passwd" },
				},
				{
					testName: "rejects path traversal in area name",
					input: { area: "../etc/passwd" },
				},
				{
					testName: "rejects path separators in project name",
					input: { project: "folder/subfolder" },
				},
				{
					testName: "rejects path separators in area name",
					input: { area: "folder\\subfolder" },
				},
				{
					testName: "rejects absolute paths in project name",
					input: { project: "/etc/passwd" },
				},
				{
					testName: "rejects Windows absolute paths in area name",
					input: { area: "C:\\Windows" },
				},
				{
					testName: "rejects control characters in project name",
					input: { project: "test\x00null" },
				},
			])("$testName", ({ input }) => {
				const vaultPath = createTestVault();
				trackVault(vaultPath);
				mkdirSync(join(vaultPath, "01 Projects"), { recursive: true });
				mkdirSync(join(vaultPath, "02 Areas"), { recursive: true });

				const result = resolveDestination(input, vaultPath);

				expectNull(result);
			});

			test("rejects empty or whitespace-only names", () => {
				const vaultPath = createTestVault();
				trackVault(vaultPath);
				mkdirSync(join(vaultPath, "01 Projects"), { recursive: true });
				mkdirSync(join(vaultPath, "02 Areas"), { recursive: true });

				expectNull(resolveDestination({ project: "" }, vaultPath));
				expectNull(resolveDestination({ project: "   " }, vaultPath));
				expectNull(resolveDestination({ area: "" }, vaultPath));
				expectNull(resolveDestination({ area: "   " }, vaultPath));
			});
		});

		describe("edge cases", () => {
			test("returns null when both area and project are missing", () => {
				const vaultPath = createTestVault();
				trackVault(vaultPath);
				const result = resolveDestination({}, vaultPath);

				expectNull(result);
			});

			test("returns null when both area and project are undefined", () => {
				const vaultPath = createTestVault();
				trackVault(vaultPath);
				const result = resolveDestination(
					{ area: undefined, project: undefined },
					vaultPath,
				);

				expectNull(result);
			});

			test("handles special characters in folder names", () => {
				const vaultPath = createTestVault();
				trackVault(vaultPath);
				createArea(vaultPath, "Health & Fitness");

				const result = resolveDestination(
					{ area: "Health & Fitness" },
					vaultPath,
				);

				expectDestination(result, "02 Areas/Health & Fitness");
			});

			test("handles spaces in folder names", () => {
				const vaultPath = createTestVault();
				trackVault(vaultPath);
				createProject(vaultPath, "My Big Project");

				const result = resolveDestination(
					{ project: "My Big Project" },
					vaultPath,
				);

				expectDestination(result, "01 Projects/My Big Project");
			});

			test("strips wikilink brackets with trailing spaces", () => {
				const vaultPath = createTestVault();
				trackVault(vaultPath);
				createArea(vaultPath, "Health");

				const result = resolveDestination({ area: "[[ Health ]]" }, vaultPath);

				expectDestination(result, "02 Areas/Health");
			});
		});
	});
});
