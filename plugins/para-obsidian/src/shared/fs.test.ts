import { afterEach, describe, expect, it } from "bun:test";
import path from "node:path";
import {
	createTestVault,
	useTestVaultCleanup,
	writeVaultFile,
} from "../testing/utils";
import { listDir, readFile, resolveVaultPath } from "./fs";

describe("fs helpers", () => {
	const { trackVault, getAfterEachHook } = useTestVaultCleanup();
	afterEach(getAfterEachHook());

	it("resolves vault-relative paths", () => {
		const vault = createTestVault();
		trackVault(vault);

		writeVaultFile(vault, "01_Projects/.gitkeep", "");
		const target = path.join(vault, "01_Projects");
		const result = resolveVaultPath(vault, "01_Projects");
		expect(result.absolute).toBe(target);
		expect(result.relative).toBe("01_Projects");
	});

	it("prevents escaping vault", () => {
		const vault = createTestVault();
		trackVault(vault);

		expect(() => resolveVaultPath(vault, "../evil")).toThrow("escapes");
	});

	it("lists directories", () => {
		const vault = createTestVault();
		trackVault(vault);

		writeVaultFile(vault, "a/.gitkeep", "");
		writeVaultFile(vault, "b/.gitkeep", "");
		const items = listDir(vault, ".");
		expect(items).toEqual(["a", "b"]);
	});

	it("reads files", () => {
		const vault = createTestVault();
		trackVault(vault);

		writeVaultFile(vault, "note.md", "hello");
		const content = readFile(vault, "note.md");
		expect(content).toBe("hello");
	});
});
