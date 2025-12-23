import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { withTempVault } from "../../testing/utils";
import { listDir, readFile, resolveVaultPath } from "../fs";

describe("fs helpers", () => {
	it("resolves vault-relative paths", async () => {
		await withTempVault(async (vault) => {
			const target = path.join(vault, "01_Projects");
			fs.mkdirSync(target);
			const result = resolveVaultPath(vault, "01_Projects");
			expect(result.absolute).toBe(target);
			expect(result.relative).toBe("01_Projects");
		});
	});

	it("prevents escaping vault", async () => {
		await withTempVault(async (vault) => {
			expect(() => resolveVaultPath(vault, "../evil")).toThrow("escapes");
		});
	});

	it("lists directories", async () => {
		await withTempVault(async (vault) => {
			fs.mkdirSync(path.join(vault, "a"));
			fs.mkdirSync(path.join(vault, "b"));
			const items = listDir(vault, ".");
			expect(items).toEqual(["a", "b"]);
		});
	});

	it("reads files", async () => {
		await withTempVault(async (vault) => {
			const file = path.join(vault, "note.md");
			fs.writeFileSync(file, "hello");
			const content = readFile(vault, "note.md");
			expect(content).toBe("hello");
		});
	});
});
