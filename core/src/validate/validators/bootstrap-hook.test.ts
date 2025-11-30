/**
 * Tests for bootstrap-hook validator
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { validateBootstrapHook } from "./bootstrap-hook.js";

const TEST_DIR = join(import.meta.dir, "test-fixtures", "bootstrap-hook");

beforeEach(() => {
	if (!existsSync(TEST_DIR)) {
		mkdirSync(TEST_DIR, { recursive: true });
	}
});

afterEach(() => {
	if (existsSync(TEST_DIR)) {
		rmSync(TEST_DIR, { recursive: true, force: true });
	}
});

/**
 * Helper to write plugin.json
 */
function writePluginJson(content: object = { name: "test-plugin" }) {
	const pluginDir = join(TEST_DIR, ".claude-plugin");
	if (!existsSync(pluginDir)) {
		mkdirSync(pluginDir);
	}
	writeFileSync(
		join(pluginDir, "plugin.json"),
		JSON.stringify(content, null, 2),
	);
}

/**
 * Helper to write package.json
 */
function writePackageJson(content: object) {
	writeFileSync(
		join(TEST_DIR, "package.json"),
		JSON.stringify(content, null, 2),
	);
}

/**
 * Helper to write hooks.json
 */
function writeHooksJson(content: object) {
	const hooksDir = join(TEST_DIR, "hooks");
	if (!existsSync(hooksDir)) {
		mkdirSync(hooksDir);
	}
	writeFileSync(join(hooksDir, "hooks.json"), JSON.stringify(content, null, 2));
}

describe("validateBootstrapHook", () => {
	describe("plugins without dependencies", () => {
		test("skips validation when plugin.json doesn't exist (e.g., marketplace root)", async () => {
			writePackageJson({
				name: "marketplace-root",
				version: "1.0.0",
				devDependencies: {
					"some-package": "^1.0.0",
				},
			});
			// No plugin.json means this is not a plugin (e.g., marketplace root)

			const issues = await validateBootstrapHook({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(0);
		});

		test("passes validation when package.json has no dependencies", async () => {
			// Create plugin.json to indicate this is a plugin
			const pluginDir = join(TEST_DIR, ".claude-plugin");
			mkdirSync(pluginDir, { recursive: true });
			writeFileSync(
				join(pluginDir, "plugin.json"),
				JSON.stringify({ name: "test-plugin" }),
			);

			writePackageJson({
				name: "test-plugin",
				version: "1.0.0",
			});

			const issues = await validateBootstrapHook({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(0);
		});

		test("passes validation when package.json has empty dependencies", async () => {
			writePackageJson({
				name: "test-plugin",
				version: "1.0.0",
				dependencies: {},
				devDependencies: {},
			});

			const issues = await validateBootstrapHook({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(0);
		});

		test("passes validation when package.json doesn't exist", async () => {
			const issues = await validateBootstrapHook({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(0);
		});
	});

	describe("plugins with dependencies but no hooks.json", () => {
		test("returns error when plugin has dependencies but no hooks.json", async () => {
			writePluginJson();
			writePackageJson({
				name: "test-plugin",
				version: "1.0.0",
				dependencies: {
					"some-package": "^1.0.0",
				},
			});

			const issues = await validateBootstrapHook({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				severity: "error",
				message: expect.stringContaining("MUST have hooks/hooks.json"),
			});
		});

		test("returns error when plugin has devDependencies but no hooks.json", async () => {
			writePluginJson();
			writePackageJson({
				name: "test-plugin",
				version: "1.0.0",
				devDependencies: {
					"some-dev-package": "^1.0.0",
				},
			});

			const issues = await validateBootstrapHook({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				severity: "error",
			});
		});
	});

	describe("plugins with dependencies but missing SessionStart", () => {
		test("returns error when hooks.json has no hooks object", async () => {
			writePluginJson();
			writePackageJson({
				name: "test-plugin",
				dependencies: { pkg: "^1.0.0" },
			});

			writeHooksJson({
				description: "Test hooks",
			});

			const issues = await validateBootstrapHook({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				severity: "error",
				message: expect.stringContaining('must contain a "hooks" object'),
			});
		});

		test("returns error when hooks.json has no SessionStart", async () => {
			writePluginJson();
			writePackageJson({
				name: "test-plugin",
				dependencies: { pkg: "^1.0.0" },
			});

			writeHooksJson({
				hooks: {
					PostToolUse: [
						{
							matcher: "*",
							hooks: [{ type: "command", command: "echo test" }],
						},
					],
				},
			});

			const issues = await validateBootstrapHook({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				severity: "error",
				message: expect.stringContaining("MUST have SessionStart hook"),
			});
		});

		test("returns error when SessionStart is not an array", async () => {
			writePluginJson();
			writePackageJson({
				name: "test-plugin",
				dependencies: { pkg: "^1.0.0" },
			});

			writeHooksJson({
				hooks: {
					SessionStart: "invalid",
				},
			});

			const issues = await validateBootstrapHook({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				severity: "error",
			});
		});

		test("returns error when SessionStart is empty", async () => {
			writePluginJson();
			writePackageJson({
				name: "test-plugin",
				dependencies: { pkg: "^1.0.0" },
			});

			writeHooksJson({
				hooks: {
					SessionStart: [],
				},
			});

			const issues = await validateBootstrapHook({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				severity: "error",
				message: expect.stringContaining("at least one matcher"),
			});
		});
	});

	describe("plugins with dependencies but missing bootstrap hook", () => {
		test("returns error when SessionStart has no bootstrap hook", async () => {
			writePluginJson();
			writePackageJson({
				name: "test-plugin",
				dependencies: { pkg: "^1.0.0" },
			});

			writeHooksJson({
				hooks: {
					SessionStart: [
						{
							matcher: "*",
							hooks: [
								{
									type: "command",
									command: "bun run some-other-hook.ts",
									timeout: 10,
								},
							],
						},
					],
				},
			});

			const issues = await validateBootstrapHook({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				severity: "error",
				message: expect.stringContaining("must include bootstrap hook"),
			});
		});

		test("returns error when bootstrap hook has wrong command", async () => {
			writePluginJson();
			writePackageJson({
				name: "test-plugin",
				dependencies: { pkg: "^1.0.0" },
			});

			writeHooksJson({
				hooks: {
					SessionStart: [
						{
							matcher: "*",
							hooks: [
								{
									type: "command",
									command: "${CLAUDE_PLUGIN_ROOT}/wrong-path.sh",
									timeout: 60,
								},
							],
						},
					],
				},
			});

			const issues = await validateBootstrapHook({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				severity: "error",
				message: expect.stringContaining("bootstrap.sh"),
			});
		});
	});

	describe("plugins with bootstrap hook but wrong position", () => {
		test("returns error when bootstrap is not the first hook", async () => {
			writePluginJson();
			writePackageJson({
				name: "test-plugin",
				dependencies: { pkg: "^1.0.0" },
			});

			writeHooksJson({
				hooks: {
					SessionStart: [
						{
							matcher: "*",
							hooks: [
								{
									type: "command",
									command: "bun run other-hook.ts",
									timeout: 10,
								},
								{
									type: "command",
									command: "${CLAUDE_PLUGIN_ROOT}/../../core/bootstrap.sh",
									timeout: 60,
								},
							],
						},
					],
				},
			});

			const issues = await validateBootstrapHook({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				severity: "error",
				message: expect.stringContaining("MUST be the first hook"),
			});
		});

		test("returns error when bootstrap is in second matcher", async () => {
			writePluginJson();
			writePackageJson({
				name: "test-plugin",
				dependencies: { pkg: "^1.0.0" },
			});

			writeHooksJson({
				hooks: {
					SessionStart: [
						{
							matcher: "Read",
							hooks: [
								{
									type: "command",
									command: "bun run other-hook.ts",
									timeout: 10,
								},
							],
						},
						{
							matcher: "*",
							hooks: [
								{
									type: "command",
									command: "${CLAUDE_PLUGIN_ROOT}/../../core/bootstrap.sh",
									timeout: 60,
								},
							],
						},
					],
				},
			});

			const issues = await validateBootstrapHook({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				severity: "error",
				message: expect.stringContaining("first hook in the first"),
			});
		});
	});

	describe("plugins with correct bootstrap hook but warnings", () => {
		test("returns warning when matcher is not '*'", async () => {
			writePluginJson();
			writePackageJson({
				name: "test-plugin",
				dependencies: { pkg: "^1.0.0" },
			});

			writeHooksJson({
				hooks: {
					SessionStart: [
						{
							matcher: "Read|Write",
							hooks: [
								{
									type: "command",
									command: "${CLAUDE_PLUGIN_ROOT}/../../core/bootstrap.sh",
									timeout: 60,
								},
							],
						},
					],
				},
			});

			const issues = await validateBootstrapHook({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				severity: "warning",
				message: expect.stringContaining('matcher should be "*"'),
			});
		});

		test("returns warning when timeout is not 60", async () => {
			writePluginJson();
			writePackageJson({
				name: "test-plugin",
				dependencies: { pkg: "^1.0.0" },
			});

			writeHooksJson({
				hooks: {
					SessionStart: [
						{
							matcher: "*",
							hooks: [
								{
									type: "command",
									command: "${CLAUDE_PLUGIN_ROOT}/../../core/bootstrap.sh",
									timeout: 30,
								},
							],
						},
					],
				},
			});

			const issues = await validateBootstrapHook({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				severity: "warning",
				message: expect.stringContaining("timeout should be 60"),
			});
		});

		test("returns warning when timeout is missing", async () => {
			writePluginJson();
			writePackageJson({
				name: "test-plugin",
				dependencies: { pkg: "^1.0.0" },
			});

			writeHooksJson({
				hooks: {
					SessionStart: [
						{
							matcher: "*",
							hooks: [
								{
									type: "command",
									command: "${CLAUDE_PLUGIN_ROOT}/../../core/bootstrap.sh",
								},
							],
						},
					],
				},
			});

			const issues = await validateBootstrapHook({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				severity: "warning",
				message: expect.stringContaining("timeout should be 60"),
			});
		});

		test("returns multiple warnings for matcher and timeout", async () => {
			writePluginJson();
			writePackageJson({
				name: "test-plugin",
				dependencies: { pkg: "^1.0.0" },
			});

			writeHooksJson({
				hooks: {
					SessionStart: [
						{
							matcher: "Read",
							hooks: [
								{
									type: "command",
									command: "${CLAUDE_PLUGIN_ROOT}/../../core/bootstrap.sh",
									timeout: 30,
								},
							],
						},
					],
				},
			});

			const issues = await validateBootstrapHook({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(2);
			expect(issues.some((i) => i.message.includes("matcher"))).toBe(true);
			expect(issues.some((i) => i.message.includes("timeout"))).toBe(true);
		});
	});

	describe("plugins with correct bootstrap hook configuration", () => {
		test("passes validation with perfect configuration", async () => {
			writePackageJson({
				name: "test-plugin",
				dependencies: { pkg: "^1.0.0" },
			});

			writeHooksJson({
				hooks: {
					SessionStart: [
						{
							matcher: "*",
							hooks: [
								{
									type: "command",
									command: "${CLAUDE_PLUGIN_ROOT}/../../core/bootstrap.sh",
									timeout: 60,
								},
							],
						},
					],
				},
			});

			const issues = await validateBootstrapHook({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(0);
		});

		test("passes validation with additional hooks after bootstrap", async () => {
			writePackageJson({
				name: "test-plugin",
				dependencies: { pkg: "^1.0.0" },
			});

			writeHooksJson({
				hooks: {
					SessionStart: [
						{
							matcher: "*",
							hooks: [
								{
									type: "command",
									command: "${CLAUDE_PLUGIN_ROOT}/../../core/bootstrap.sh",
									timeout: 60,
								},
								{
									type: "command",
									command: "bun run ${CLAUDE_PLUGIN_ROOT}/hooks/my-hook.ts",
									timeout: 10,
								},
							],
						},
					],
					PostToolUse: [
						{
							matcher: "Write|Edit",
							hooks: [
								{
									type: "command",
									command: "bun run ${CLAUDE_PLUGIN_ROOT}/hooks/post-tool.ts",
									timeout: 5,
								},
							],
						},
					],
				},
			});

			const issues = await validateBootstrapHook({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(0);
		});

		test("passes validation with real-world git plugin structure", async () => {
			writePackageJson({
				name: "@sidequest/git",
				version: "1.0.0",
				dependencies: {
					"@modelcontextprotocol/sdk": "^0.1.0",
				},
			});

			writeHooksJson({
				description: "Git intelligence hooks",
				hooks: {
					SessionStart: [
						{
							matcher: "*",
							hooks: [
								{
									type: "command",
									command: "${CLAUDE_PLUGIN_ROOT}/../../core/bootstrap.sh",
									timeout: 60,
								},
								{
									type: "command",
									command:
										"bun run ${CLAUDE_PLUGIN_ROOT}/hooks/git-context-loader.ts",
									timeout: 10,
								},
							],
						},
					],
					PreCompact: [
						{
							hooks: [
								{
									type: "command",
									command:
										"bun run ${CLAUDE_PLUGIN_ROOT}/hooks/session-summary.ts",
									timeout: 5,
								},
							],
						},
					],
				},
			});

			const issues = await validateBootstrapHook({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(0);
		});
	});

	describe("edge cases", () => {
		test("returns error when package.json is invalid JSON", async () => {
			writePluginJson();
			writeFileSync(join(TEST_DIR, "package.json"), "{ invalid json }");

			const issues = await validateBootstrapHook({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				ruleId: "bootstrap/invalid-package-json",
				severity: "error",
				message: expect.stringContaining("Failed to parse package.json"),
				file: join(TEST_DIR, "package.json"),
				suggestion: "Ensure package.json contains valid JSON",
			});
		});

		test("returns error when hooks.json is invalid JSON", async () => {
			writePluginJson();
			writePackageJson({
				name: "test-plugin",
				dependencies: { pkg: "^1.0.0" },
			});

			const hooksDir = join(TEST_DIR, "hooks");
			mkdirSync(hooksDir);
			writeFileSync(join(hooksDir, "hooks.json"), "{ invalid json }");

			const issues = await validateBootstrapHook({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				ruleId: "bootstrap/invalid-hooks-json",
				severity: "error",
				message: expect.stringContaining("Failed to parse hooks.json"),
				file: join(hooksDir, "hooks.json"),
				suggestion: "Ensure hooks.json contains valid JSON",
			});
		});

		test("handles matcher without matcher field (undefined)", async () => {
			writePluginJson();
			writePackageJson({
				name: "test-plugin",
				dependencies: { pkg: "^1.0.0" },
			});

			writeHooksJson({
				hooks: {
					SessionStart: [
						{
							hooks: [
								{
									type: "command",
									command: "${CLAUDE_PLUGIN_ROOT}/../../core/bootstrap.sh",
									timeout: 60,
								},
							],
						},
					],
				},
			});

			const issues = await validateBootstrapHook({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				severity: "warning",
				message: expect.stringContaining('matcher should be "*"'),
			});
		});
	});
});
