import { afterEach, describe, expect, it } from "bun:test";

import { loadConfig } from "../config/index";
import {
	createTestVault,
	useTestVaultCleanup,
	vaultFileExists,
	writeVaultFile,
} from "../testing/utils";
import { deleteFile } from "./delete";

describe("deleteFile", () => {
	const { trackVault, getAfterEachHook } = useTestVaultCleanup();
	afterEach(getAfterEachHook());

	/**
	 * Helper to create and track a test vault
	 */
	const setupTest = () => {
		const vault = createTestVault();
		trackVault(vault);
		return vault;
	};

	it("deletes a file when confirmed", () => {
		const vault = setupTest();
		writeVaultFile(vault, "note.md", "hi");
		const cfg = loadConfig({ cwd: vault });
		const result = deleteFile(cfg, { file: "note.md", confirm: true });
		expect(result.deleted).toBe(true);
		expect(vaultFileExists(vault, "note.md")).toBe(false);
	});

	it("throws without confirm", () => {
		const vault = setupTest();
		writeVaultFile(vault, "note.md", "hi");
		const cfg = loadConfig({ cwd: vault });
		expect(() => deleteFile(cfg, { file: "note.md", confirm: false })).toThrow(
			"delete requires --confirm",
		);
	});

	it("throws when file doesn't exist", () => {
		const vault = setupTest();
		const cfg = loadConfig({ cwd: vault });
		expect(() =>
			deleteFile(cfg, { file: "nonexistent.md", confirm: true }),
		).toThrow("File not found: nonexistent.md");
	});

	it("reports deletion without deleting in dry-run mode", () => {
		const vault = setupTest();
		writeVaultFile(vault, "note.md", "hi");
		const cfg = loadConfig({ cwd: vault });
		const result = deleteFile(cfg, {
			file: "note.md",
			confirm: true,
			dryRun: true,
		});
		expect(result.deleted).toBe(false);
		expect(result.relative).toBe("note.md");
		// File should still exist
		expect(vaultFileExists(vault, "note.md")).toBe(true);
	});

	it("removes empty parent directories", () => {
		const vault = setupTest();
		writeVaultFile(vault, "Projects/Subdir/note.md", "hi");
		const cfg = loadConfig({ cwd: vault });
		deleteFile(cfg, { file: "Projects/Subdir/note.md", confirm: true });
		// File should be deleted
		expect(vaultFileExists(vault, "Projects/Subdir/note.md")).toBe(false);
		// Empty parent directories should be removed
		expect(vaultFileExists(vault, "Projects/Subdir")).toBe(false);
		expect(vaultFileExists(vault, "Projects")).toBe(false);
	});

	it("stops removing directories when non-empty", () => {
		const vault = setupTest();
		writeVaultFile(vault, "Projects/keep.md", "keep this");
		writeVaultFile(vault, "Projects/Subdir/delete.md", "delete this");
		const cfg = loadConfig({ cwd: vault });
		deleteFile(cfg, { file: "Projects/Subdir/delete.md", confirm: true });
		// File should be deleted
		expect(vaultFileExists(vault, "Projects/Subdir/delete.md")).toBe(false);
		// Empty subdir should be removed
		expect(vaultFileExists(vault, "Projects/Subdir")).toBe(false);
		// Non-empty parent should remain
		expect(vaultFileExists(vault, "Projects")).toBe(true);
		expect(vaultFileExists(vault, "Projects/keep.md")).toBe(true);
	});

	it("returns correct result structure", () => {
		const vault = setupTest();
		writeVaultFile(vault, "Projects/note.md", "hi");
		const cfg = loadConfig({ cwd: vault });
		const result = deleteFile(cfg, { file: "Projects/note.md", confirm: true });
		expect(result).toEqual({
			deleted: true,
			relative: "Projects/note.md",
		});
	});
});
