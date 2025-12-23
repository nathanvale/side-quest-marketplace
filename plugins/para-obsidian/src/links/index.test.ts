import { afterEach, describe, expect, it } from "bun:test";

import { loadConfig } from "../config/index";
import {
	createTestVault,
	readVaultFile,
	useTestVaultCleanup,
	vaultFileExists,
	writeVaultFile,
} from "../testing/utils";
import { renameWithLinkRewrite } from "./index";

describe("renameWithLinkRewrite", () => {
	const { trackVault, getAfterEachHook } = useTestVaultCleanup();
	afterEach(getAfterEachHook());

	/**
	 * Helper function to set up test vault with automatic cleanup tracking
	 */
	function setupTest(): string {
		const vault = createTestVault();
		trackVault(vault);
		return vault;
	}

	/**
	 * Helper function to set up rename test with source and target files
	 */
	function setupRenameTest(): {
		vault: string;
		cfg: ReturnType<typeof loadConfig>;
	} {
		const vault = setupTest();
		writeVaultFile(vault, "old.md", "# Old");
		writeVaultFile(vault, "other.md", "See [[old]]");
		const cfg = loadConfig({ cwd: vault });
		return { vault, cfg };
	}

	it("renames file and rewrites wikilinks", () => {
		const { vault, cfg } = setupRenameTest();

		const result = renameWithLinkRewrite(cfg, {
			from: "old.md",
			to: "new.md",
		});

		expect(result.moved).toBe(true);
		expect(result.rewrites).toHaveLength(1);
		expect(result.rewrites[0]?.changes).toBe(1);
		const updated = readVaultFile(vault, "other.md");
		expect(updated.includes("[[new]]")).toBe(true);
		expect(vaultFileExists(vault, "new.md")).toBe(true);
	});

	it("supports dry-run", () => {
		const { vault, cfg } = setupRenameTest();

		const result = renameWithLinkRewrite(cfg, {
			from: "old.md",
			to: "new.md",
			dryRun: true,
		});

		expect(result.moved).toBe(false);
		expect(vaultFileExists(vault, "old.md")).toBe(true);
	});

	it("throws when source does not exist", () => {
		const vault = setupTest();
		const cfg = loadConfig({ cwd: vault });

		expect(() => {
			renameWithLinkRewrite(cfg, {
				from: "nonexistent.md",
				to: "new.md",
			});
		}).toThrow("Source does not exist: nonexistent.md");
	});

	it("throws when destination already exists", () => {
		const vault = setupTest();
		writeVaultFile(vault, "old.md", "# Old");
		writeVaultFile(vault, "new.md", "# Already exists");
		const cfg = loadConfig({ cwd: vault });

		expect(() => {
			renameWithLinkRewrite(cfg, {
				from: "old.md",
				to: "new.md",
			});
		}).toThrow("Destination already exists: new.md");
	});
});
