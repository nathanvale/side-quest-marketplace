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

	/**
	 * Helper function to set up a test vault with automatic cleanup tracking.
	 * Combines createTestVault() and trackVault() operations.
	 * @returns Path to the created test vault
	 */
	const setupTest = (): string => {
		const vault = createTestVault();
		trackVault(vault);
		return vault;
	};

	it("resolves vault-relative paths", () => {
		const vault = setupTest();

		writeVaultFile(vault, "01_Projects/dummy.md", "");
		const target = path.join(vault, "01_Projects");
		const result = resolveVaultPath(vault, "01_Projects");
		expect(result.absolute).toBe(target);
		expect(result.relative).toBe("01_Projects");
	});

	it("prevents escaping vault", () => {
		const vault = setupTest();

		expect(() => resolveVaultPath(vault, "../evil")).toThrow(
			/path.*escapes (vault|sandbox)/i,
		);
	});

	it("lists directories", () => {
		const vault = setupTest();

		writeVaultFile(vault, "a/dummy.md", "");
		writeVaultFile(vault, "b/dummy.md", "");
		const items = listDir(vault, ".");
		expect(items).toEqual(["a", "b"]);
	});

	it("reads files", () => {
		const vault = setupTest();

		writeVaultFile(vault, "note.md", "hello");
		const content = readFile(vault, "note.md");
		expect(content).toBe("hello");
	});
});
