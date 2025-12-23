import { afterEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";

import { loadConfig } from "../config/index";
import {
	createTestVault,
	useTestVaultCleanup,
	writeVaultFile,
} from "../testing/utils";
import { deleteFile } from "./delete";

describe("deleteFile", () => {
	const { trackVault, getAfterEachHook } = useTestVaultCleanup();
	afterEach(getAfterEachHook());

	it("deletes a file when confirmed", () => {
		const vault = createTestVault();
		trackVault(vault);
		writeVaultFile(vault, "note.md", "hi");
		const cfg = loadConfig({ cwd: vault });
		const result = deleteFile(cfg, { file: "note.md", confirm: true });
		expect(result.deleted).toBe(true);
		expect(fs.existsSync(path.join(vault, "note.md"))).toBe(false);
	});

	it("throws without confirm", () => {
		const vault = createTestVault();
		trackVault(vault);
		writeVaultFile(vault, "note.md", "hi");
		const cfg = loadConfig({ cwd: vault });
		expect(() =>
			deleteFile(cfg, { file: "note.md", confirm: false }),
		).toThrow();
	});
});
