import { describe, expect, it } from "bun:test";

import { loadConfig } from "./config";

// Smoke test for config command wiring. The CLI itself prints to stdout/stderr,
// so we just ensure loadConfig is callable in this context.
describe("cli", () => {
	it("loads config without throwing when PARA_VAULT is set", () => {
		const vault = "/tmp"; // using tmp ensures directory exists
		const originalEnv = { ...process.env };
		process.env.PARA_VAULT = vault;

		expect(() => loadConfig()).not.toThrow();

		process.env = originalEnv;
	});
});
