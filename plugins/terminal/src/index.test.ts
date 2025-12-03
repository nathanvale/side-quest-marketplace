import { describe, expect, test } from "bun:test";
import { binScriptExists, getBinScriptPath } from "./bin-runner";

describe("bin-runner", () => {
	test("getBinScriptPath returns correct path", () => {
		const path = getBinScriptPath("downloads");
		expect(path).toContain("code/dotfiles/bin/downloads");
	});

	test("binScriptExists returns true for existing script", () => {
		// downloads script exists in dotfiles
		const exists = binScriptExists("downloads");
		expect(exists).toBe(true);
	});

	test("binScriptExists returns false for non-existent script", () => {
		const exists = binScriptExists("nonexistent-script-xyz");
		expect(exists).toBe(false);
	});
});
