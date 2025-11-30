/**
 * Tests for hooks-json validator
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { validateHooksJson } from "./hooks-json.js";

const TEST_DIR = join(import.meta.dir, "test-fixtures", "hooks-json");

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
 * Helper to write hooks.json
 */
function writeHooksJson(content: object) {
	const hooksDir = join(TEST_DIR, "hooks");
	if (!existsSync(hooksDir)) {
		mkdirSync(hooksDir);
	}
	writeFileSync(join(hooksDir, "hooks.json"), JSON.stringify(content, null, 2));
}

/**
 * Helper to create a command file
 */
function createCommandFile(path: string) {
	const fullPath = join(TEST_DIR, path);
	const dir = join(fullPath, "..");
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
	writeFileSync(fullPath, "#!/usr/bin/env bun\nconsole.log('test');\n");
}

describe("validateHooksJson", () => {
	describe("missing hooks.json", () => {
		test("returns no issues when hooks.json doesn't exist", async () => {
			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });
			expect(issues).toHaveLength(0);
		});
	});

	describe("invalid structure", () => {
		test("returns error when hooks.json is invalid JSON", async () => {
			const hooksDir = join(TEST_DIR, "hooks");
			mkdirSync(hooksDir);
			writeFileSync(join(hooksDir, "hooks.json"), "{ invalid json }");

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				ruleId: "hooks/parse-error",
				severity: "error",
				message: expect.stringContaining("Failed to parse"),
			});
		});

		test("returns error when hooks.json has no hooks array", async () => {
			writeHooksJson({ description: "Test hooks" });

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				ruleId: "hooks/invalid-structure",
				severity: "error",
				message: "hooks.json must contain a 'hooks' array",
			});
		});

		test("returns error when hooks is not an array", async () => {
			writeHooksJson({ hooks: "invalid" });

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				ruleId: "hooks/invalid-structure",
				severity: "error",
			});
		});
	});

	describe("hook validation", () => {
		test("returns error when hook is missing event", async () => {
			writeHooksJson({
				hooks: [{ command: "bun test" }],
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				ruleId: "hooks/missing-event",
				severity: "error",
				message: "Hook is missing 'event' property",
			});
		});

		test("returns error when hook is missing command", async () => {
			writeHooksJson({
				hooks: [{ event: "PostToolUse" }],
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				ruleId: "hooks/missing-command",
				severity: "error",
				message: expect.stringContaining("missing 'command' property"),
			});
		});

		test("returns warning for unknown event type", async () => {
			writeHooksJson({
				hooks: [{ event: "InvalidEvent", command: "bun test" }],
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				ruleId: "hooks/invalid-event",
				severity: "warning",
				message: "Unknown event type: InvalidEvent",
			});
		});
	});

	describe("command file validation", () => {
		test("returns error when command file doesn't exist", async () => {
			writeHooksJson({
				hooks: [{ event: "PostToolUse", command: "hooks/missing.ts" }],
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				ruleId: "hooks/command-file-not-found",
				severity: "error",
				message: expect.stringContaining("Command file not found"),
			});
		});

		test("passes when command file exists", async () => {
			createCommandFile("hooks/my-hook.ts");
			writeHooksJson({
				hooks: [{ event: "PostToolUse", command: "hooks/my-hook.ts" }],
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(0);
		});
	});

	describe("bun run commands", () => {
		test("validates file exists for 'bun run path/to/file.ts'", async () => {
			writeHooksJson({
				hooks: [{ event: "PostToolUse", command: "bun run hooks/my-hook.ts" }],
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				ruleId: "hooks/command-file-not-found",
				severity: "error",
				message: expect.stringContaining("hooks/my-hook.ts"),
			});
		});

		test("passes when 'bun run' file exists", async () => {
			createCommandFile("hooks/my-hook.ts");
			writeHooksJson({
				hooks: [{ event: "PostToolUse", command: "bun run hooks/my-hook.ts" }],
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(0);
		});

		test("skips validation for 'bun install'", async () => {
			writeHooksJson({
				hooks: [{ event: "SessionStart", command: "bun install" }],
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(0);
		});

		test("skips validation for 'bun test'", async () => {
			writeHooksJson({
				hooks: [{ event: "Stop", command: "bun test" }],
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(0);
		});

		test("skips validation for other bun commands", async () => {
			writeHooksJson({
				hooks: [
					{ event: "SessionStart", command: "bun install" },
					{ event: "Stop", command: "bun test" },
					{ event: "PreToolUse", command: "bun build" },
				],
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(0);
		});
	});

	describe("${CLAUDE_PLUGIN_ROOT} variable", () => {
		test("resolves ${CLAUDE_PLUGIN_ROOT} when validating file existence", async () => {
			writeHooksJson({
				hooks: [
					{
						event: "PostToolUse",
						command: "${CLAUDE_PLUGIN_ROOT}/hooks/my-hook.ts",
					},
				],
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				ruleId: "hooks/command-file-not-found",
				severity: "error",
				message: expect.stringContaining("/hooks/my-hook.ts"),
			});
		});

		test("passes when ${CLAUDE_PLUGIN_ROOT} file exists", async () => {
			createCommandFile("hooks/my-hook.ts");
			writeHooksJson({
				hooks: [
					{
						event: "PostToolUse",
						command: "${CLAUDE_PLUGIN_ROOT}/hooks/my-hook.ts",
					},
				],
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(0);
		});

		test("validates 'bun run ${CLAUDE_PLUGIN_ROOT}/path/to/file.ts'", async () => {
			writeHooksJson({
				hooks: [
					{
						event: "SessionStart",
						command: "bun run ${CLAUDE_PLUGIN_ROOT}/hooks/bootstrap.ts",
					},
				],
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				ruleId: "hooks/command-file-not-found",
				severity: "error",
			});
		});

		test("passes when 'bun run ${CLAUDE_PLUGIN_ROOT}' file exists", async () => {
			createCommandFile("hooks/bootstrap.ts");
			writeHooksJson({
				hooks: [
					{
						event: "SessionStart",
						command: "bun run ${CLAUDE_PLUGIN_ROOT}/hooks/bootstrap.ts",
					},
				],
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(0);
		});
	});

	describe("real-world examples", () => {
		test("validates git plugin hooks.json structure (old format)", async () => {
			createCommandFile("hooks/git-context-loader.ts");
			writeHooksJson({
				hooks: [
					{
						event: "PostToolUse",
						command: "bun run hooks/git-context-loader.ts",
					},
				],
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(0);
		});

		test("validates bun-runner plugin hooks.json structure", async () => {
			createCommandFile("hooks/post-tool-use.ts");
			createCommandFile("hooks/stop-hook.ts");
			writeHooksJson({
				hooks: [
					{
						event: "PostToolUse",
						command: "bun run ${CLAUDE_PLUGIN_ROOT}/hooks/post-tool-use.ts",
					},
					{
						event: "Stop",
						command: "bun run ${CLAUDE_PLUGIN_ROOT}/hooks/stop-hook.ts",
					},
				],
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(0);
		});

		test("validates multiple hooks with different command formats", async () => {
			createCommandFile("hooks/my-hook.ts");
			createCommandFile("scripts/other.sh");
			writeHooksJson({
				hooks: [
					{
						event: "SessionStart",
						command: "bun install",
					},
					{
						event: "PostToolUse",
						command: "bun run hooks/my-hook.ts",
					},
					{
						event: "Stop",
						command: "${CLAUDE_PLUGIN_ROOT}/scripts/other.sh",
					},
				],
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(0);
		});
	});

	describe("mixed valid and invalid hooks", () => {
		test("reports errors for missing files while passing valid ones", async () => {
			createCommandFile("hooks/valid.ts");
			writeHooksJson({
				hooks: [
					{
						event: "SessionStart",
						command: "bun run hooks/valid.ts",
					},
					{
						event: "PostToolUse",
						command: "bun run hooks/missing.ts",
					},
					{
						event: "Stop",
						command: "bun test",
					},
				],
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				ruleId: "hooks/command-file-not-found",
				severity: "error",
				message: expect.stringContaining("hooks/missing.ts"),
			});
		});

		test("reports multiple errors", async () => {
			writeHooksJson({
				hooks: [
					{
						event: "InvalidEvent",
						command: "bun run hooks/missing1.ts",
					},
					{
						event: "PostToolUse",
						command: "bun run hooks/missing2.ts",
					},
				],
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues.length).toBeGreaterThan(1);
			expect(issues.some((i) => i.ruleId === "hooks/invalid-event")).toBe(true);
			expect(
				issues.some((i) => i.ruleId === "hooks/command-file-not-found"),
			).toBe(true);
		});
	});
});
