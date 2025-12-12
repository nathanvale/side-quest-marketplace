import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";

import { listDir, readFile, resolveVaultPath } from "./fs";
import { createTestVault } from "./test-utils";

describe("fs helpers", () => {
	it("resolves vault-relative paths", () => {
		const vault = createTestVault();
		const target = path.join(vault, "01_Projects");
		fs.mkdirSync(target);
		const result = resolveVaultPath(vault, "01_Projects");
		expect(result.absolute).toBe(target);
		expect(result.relative).toBe("01_Projects");
	});

	it("prevents escaping vault", () => {
		const vault = createTestVault();
		expect(() => resolveVaultPath(vault, "../evil")).toThrow("escapes");
	});

	it("lists directories", () => {
		const vault = createTestVault();
		fs.mkdirSync(path.join(vault, "a"));
		fs.mkdirSync(path.join(vault, "b"));
		const items = listDir(vault, ".");
		expect(items).toEqual(["a", "b"]);
	});

	it("reads files", () => {
		const vault = createTestVault();
		const file = path.join(vault, "note.md");
		fs.writeFileSync(file, "hello");
		const content = readFile(vault, "note.md");
		expect(content).toBe("hello");
	});
});
