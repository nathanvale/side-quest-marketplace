/**
 * Tests for hooks-json validator
 *
 * Tests the official Claude Code hooks.json schema:
 * {
 *   "hooks": {
 *     "EventType": [
 *       { "matcher": "*", "hooks": [{ "type": "command", "command": "..." }] }
 *     ]
 *   }
 * }
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
 * Helper to write hooks.json with the official schema
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

/**
 * Helper to create a valid hook structure
 */
function createValidHook(command: string, timeout?: number) {
	return {
		type: "command",
		command,
		...(timeout !== undefined && { timeout }),
	};
}

/**
 * Helper to create a valid matcher structure
 */
function createValidMatcher(
	matcher: string,
	hooks: Array<{
		type: string;
		command?: string;
		prompt?: string;
		timeout?: number;
	}>,
) {
	return { matcher, hooks };
}

describe("validateHooksJson", () => {
	describe("missing hooks.json", () => {
		test("returns no issues when hooks.json doesn't exist", async () => {
			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });
			expect(issues).toHaveLength(0);
		});
	});

	describe("invalid JSON", () => {
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
	});

	describe("top-level structure validation", () => {
		test("returns error when hooks.json has no hooks object", async () => {
			writeHooksJson({ description: "Test hooks" });

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				ruleId: "hooks/missing-hooks-object",
				severity: "error",
				message: "hooks.json must contain a 'hooks' object",
			});
		});

		test("returns error when hooks is an array (old incorrect format)", async () => {
			writeHooksJson({
				hooks: [{ event: "PostToolUse", command: "bun test" }],
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				ruleId: "hooks/invalid-structure",
				severity: "error",
				message: expect.stringContaining("not an array"),
			});
		});

		test("returns error when hooks is a string", async () => {
			writeHooksJson({ hooks: "invalid" });

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				ruleId: "hooks/invalid-structure",
				severity: "error",
			});
		});
	});

	describe("event type validation", () => {
		test("accepts all valid event types", async () => {
			const validEvents = [
				"PreToolUse",
				"PermissionRequest",
				"PostToolUse",
				"UserPromptSubmit",
				"Notification",
				"Stop",
				"SubagentStop",
				"PreCompact",
				"SessionStart",
				"SessionEnd",
			];

			for (const eventType of validEvents) {
				createCommandFile("hooks/test.ts");
				writeHooksJson({
					hooks: {
						[eventType]: [
							createValidMatcher("*", [createValidHook("bun test")]),
						],
					},
				});

				const issues = await validateHooksJson({ pluginRoot: TEST_DIR });
				const eventIssues = issues.filter(
					(i) => i.ruleId === "hooks/invalid-event",
				);
				expect(eventIssues).toHaveLength(0);
			}
		});

		test("returns warning for unknown event type", async () => {
			writeHooksJson({
				hooks: {
					InvalidEvent: [
						createValidMatcher("*", [createValidHook("bun test")]),
					],
				},
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues.some((i) => i.ruleId === "hooks/invalid-event")).toBe(true);
			const eventIssue = issues.find((i) => i.ruleId === "hooks/invalid-event");
			expect(eventIssue).toMatchObject({
				severity: "warning",
				message: expect.stringContaining("InvalidEvent"),
			});
		});
	});

	describe("matchers array validation", () => {
		test("returns error when event value is not an array", async () => {
			writeHooksJson({
				hooks: {
					PostToolUse: { matcher: "*", hooks: [] },
				},
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				ruleId: "hooks/invalid-matchers",
				severity: "error",
				message: expect.stringContaining("array of matchers"),
			});
		});

		test("returns error when matcher is not an object", async () => {
			writeHooksJson({
				hooks: {
					PostToolUse: ["invalid"],
				},
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				ruleId: "hooks/invalid-matcher",
				severity: "error",
			});
		});

		test("returns error when matcher is missing hooks array", async () => {
			writeHooksJson({
				hooks: {
					PostToolUse: [{ matcher: "*" }],
				},
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				ruleId: "hooks/missing-hooks-array",
				severity: "error",
			});
		});

		test("returns error when hooks is not an array", async () => {
			writeHooksJson({
				hooks: {
					PostToolUse: [{ matcher: "*", hooks: "invalid" }],
				},
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				ruleId: "hooks/invalid-hooks-array",
				severity: "error",
			});
		});
	});

	describe("hook type validation", () => {
		test("returns error when hook is missing type", async () => {
			writeHooksJson({
				hooks: {
					PostToolUse: [
						{
							matcher: "*",
							hooks: [{ command: "bun test" }],
						},
					],
				},
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues.some((i) => i.ruleId === "hooks/missing-type")).toBe(true);
		});

		test("returns error for invalid hook type", async () => {
			writeHooksJson({
				hooks: {
					PostToolUse: [
						{
							matcher: "*",
							hooks: [{ type: "invalid", command: "bun test" }],
						},
					],
				},
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues.some((i) => i.ruleId === "hooks/invalid-type")).toBe(true);
		});

		test("accepts 'command' type", async () => {
			writeHooksJson({
				hooks: {
					PostToolUse: [createValidMatcher("*", [createValidHook("bun test")])],
				},
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(
				issues.filter((i) => i.ruleId === "hooks/invalid-type"),
			).toHaveLength(0);
		});

		test("accepts 'prompt' type with prompt property", async () => {
			writeHooksJson({
				hooks: {
					PostToolUse: [
						{
							matcher: "*",
							hooks: [{ type: "prompt", prompt: "Do something" }],
						},
					],
				},
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(
				issues.filter((i) => i.ruleId === "hooks/invalid-type"),
			).toHaveLength(0);
			expect(
				issues.filter((i) => i.ruleId === "hooks/missing-prompt"),
			).toHaveLength(0);
		});

		test("returns error when prompt type is missing prompt property", async () => {
			writeHooksJson({
				hooks: {
					PostToolUse: [
						{
							matcher: "*",
							hooks: [{ type: "prompt" }],
						},
					],
				},
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues.some((i) => i.ruleId === "hooks/missing-prompt")).toBe(
				true,
			);
		});
	});

	describe("command validation", () => {
		test("returns error when command type is missing command", async () => {
			writeHooksJson({
				hooks: {
					PostToolUse: [
						{
							matcher: "*",
							hooks: [{ type: "command" }],
						},
					],
				},
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues.some((i) => i.ruleId === "hooks/missing-command")).toBe(
				true,
			);
		});

		test("returns error when command file doesn't exist", async () => {
			writeHooksJson({
				hooks: {
					PostToolUse: [
						createValidMatcher("*", [createValidHook("hooks/missing.ts")]),
					],
				},
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(
				issues.some((i) => i.ruleId === "hooks/command-file-not-found"),
			).toBe(true);
		});

		test("passes when command file exists", async () => {
			createCommandFile("hooks/my-hook.ts");
			writeHooksJson({
				hooks: {
					PostToolUse: [
						createValidMatcher("*", [createValidHook("hooks/my-hook.ts")]),
					],
				},
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(0);
		});
	});

	describe("timeout validation", () => {
		test("accepts valid timeout", async () => {
			writeHooksJson({
				hooks: {
					PostToolUse: [
						createValidMatcher("*", [createValidHook("bun test", 30)]),
					],
				},
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues.filter((i) => i.ruleId.includes("timeout"))).toHaveLength(
				0,
			);
		});

		test("returns error for non-numeric timeout", async () => {
			writeHooksJson({
				hooks: {
					PostToolUse: [
						{
							matcher: "*",
							hooks: [{ type: "command", command: "bun test", timeout: "30" }],
						},
					],
				},
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(
				issues.some((i) => i.ruleId === "hooks/invalid-timeout-type"),
			).toBe(true);
		});

		test("returns warning for timeout exceeding max (600s)", async () => {
			writeHooksJson({
				hooks: {
					PostToolUse: [
						createValidMatcher("*", [createValidHook("bun test", 700)]),
					],
				},
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(
				issues.some((i) => i.ruleId === "hooks/timeout-out-of-range"),
			).toBe(true);
		});

		test("returns warning for negative timeout", async () => {
			writeHooksJson({
				hooks: {
					PostToolUse: [
						createValidMatcher("*", [createValidHook("bun test", -5)]),
					],
				},
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(
				issues.some((i) => i.ruleId === "hooks/timeout-out-of-range"),
			).toBe(true);
		});
	});

	describe("bun run commands", () => {
		test("validates file exists for 'bun run path/to/file.ts'", async () => {
			writeHooksJson({
				hooks: {
					PostToolUse: [
						createValidMatcher("*", [
							createValidHook("bun run hooks/my-hook.ts"),
						]),
					],
				},
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(
				issues.some((i) => i.ruleId === "hooks/command-file-not-found"),
			).toBe(true);
		});

		test("passes when 'bun run' file exists", async () => {
			createCommandFile("hooks/my-hook.ts");
			writeHooksJson({
				hooks: {
					PostToolUse: [
						createValidMatcher("*", [
							createValidHook("bun run hooks/my-hook.ts"),
						]),
					],
				},
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(0);
		});

		test("skips validation for 'bun install'", async () => {
			writeHooksJson({
				hooks: {
					SessionStart: [
						createValidMatcher("*", [createValidHook("bun install")]),
					],
				},
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(0);
		});

		test("skips validation for 'bun test'", async () => {
			writeHooksJson({
				hooks: {
					Stop: [createValidMatcher("*", [createValidHook("bun test")])],
				},
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(0);
		});
	});

	describe("${CLAUDE_PLUGIN_ROOT} variable", () => {
		test("resolves ${CLAUDE_PLUGIN_ROOT} when validating file existence", async () => {
			writeHooksJson({
				hooks: {
					PostToolUse: [
						createValidMatcher("*", [
							createValidHook("${CLAUDE_PLUGIN_ROOT}/hooks/my-hook.ts"),
						]),
					],
				},
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(
				issues.some((i) => i.ruleId === "hooks/command-file-not-found"),
			).toBe(true);
		});

		test("passes when ${CLAUDE_PLUGIN_ROOT} file exists", async () => {
			createCommandFile("hooks/my-hook.ts");
			writeHooksJson({
				hooks: {
					PostToolUse: [
						createValidMatcher("*", [
							createValidHook("${CLAUDE_PLUGIN_ROOT}/hooks/my-hook.ts"),
						]),
					],
				},
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(0);
		});

		test("validates 'bun run ${CLAUDE_PLUGIN_ROOT}/path/to/file.ts'", async () => {
			writeHooksJson({
				hooks: {
					SessionStart: [
						createValidMatcher("*", [
							createValidHook(
								"bun run ${CLAUDE_PLUGIN_ROOT}/hooks/bootstrap.ts",
							),
						]),
					],
				},
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(
				issues.some((i) => i.ruleId === "hooks/command-file-not-found"),
			).toBe(true);
		});

		test("passes when 'bun run ${CLAUDE_PLUGIN_ROOT}' file exists", async () => {
			createCommandFile("hooks/bootstrap.ts");
			writeHooksJson({
				hooks: {
					SessionStart: [
						createValidMatcher("*", [
							createValidHook(
								"bun run ${CLAUDE_PLUGIN_ROOT}/hooks/bootstrap.ts",
							),
						]),
					],
				},
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(0);
		});
	});

	describe("real-world examples (official schema)", () => {
		test("validates scraper-toolkit hooks.json structure", async () => {
			// This matches the actual scraper-toolkit/hooks/hooks.json
			writeHooksJson({
				description: "Scraper toolkit hooks for dependency bootstrapping",
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

			// Create the bootstrap script (simulated)
			createCommandFile("../../core/bootstrap.sh");

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			// Only issue should be the missing bootstrap.sh (which is outside plugin root)
			// That's expected - the actual file is at marketplace root level
			expect(
				issues.filter((i) => i.ruleId !== "hooks/command-file-not-found"),
			).toHaveLength(0);
		});

		test("validates git plugin hooks.json structure", async () => {
			createCommandFile("hooks/git-context-loader.ts");
			createCommandFile("hooks/session-summary.ts");

			writeHooksJson({
				description: "Git intelligence hooks for session context and summaries",
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

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			// Only issue should be the missing bootstrap.sh (which is outside plugin root)
			const nonBootstrapIssues = issues.filter(
				(i) => !i.message.includes("bootstrap.sh"),
			);
			expect(nonBootstrapIssues).toHaveLength(0);
		});

		test("validates bun-runner plugin hooks.json structure", async () => {
			createCommandFile("hooks/biome-check.ts");
			createCommandFile("hooks/biome-ci.ts");
			createCommandFile("hooks/tsc-ci.ts");

			writeHooksJson({
				description:
					"Auto-format, lint, and type-check files using Biome and TypeScript",
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
					PostToolUse: [
						{
							matcher: "Write|Edit|MultiEdit",
							hooks: [
								{
									type: "command",
									command: "bun run ${CLAUDE_PLUGIN_ROOT}/hooks/biome-check.ts",
									timeout: 30,
								},
							],
						},
					],
					Stop: [
						{
							matcher: "*",
							hooks: [
								{
									type: "command",
									command: "bun run ${CLAUDE_PLUGIN_ROOT}/hooks/biome-ci.ts",
									timeout: 60,
								},
							],
						},
						{
							matcher: "*",
							hooks: [
								{
									type: "command",
									command: "bun run ${CLAUDE_PLUGIN_ROOT}/hooks/tsc-ci.ts",
									timeout: 120,
								},
							],
						},
					],
				},
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			// Only issue should be the missing bootstrap.sh
			const nonBootstrapIssues = issues.filter(
				(i) => !i.message.includes("bootstrap.sh"),
			);
			expect(nonBootstrapIssues).toHaveLength(0);
		});
	});

	describe("multiple hooks and events", () => {
		test("validates multiple events with multiple matchers", async () => {
			createCommandFile("hooks/pre.ts");
			createCommandFile("hooks/post.ts");
			createCommandFile("hooks/stop.ts");

			writeHooksJson({
				hooks: {
					PreToolUse: [
						createValidMatcher("Bash", [
							createValidHook("bun run ${CLAUDE_PLUGIN_ROOT}/hooks/pre.ts"),
						]),
					],
					PostToolUse: [
						createValidMatcher("Write|Edit", [
							createValidHook("bun run ${CLAUDE_PLUGIN_ROOT}/hooks/post.ts"),
						]),
					],
					Stop: [
						createValidMatcher("*", [
							createValidHook("bun run ${CLAUDE_PLUGIN_ROOT}/hooks/stop.ts"),
						]),
					],
				},
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(0);
		});

		test("reports errors with correct location paths", async () => {
			writeHooksJson({
				hooks: {
					SessionStart: [
						createValidMatcher("*", [createValidHook("bun test")]),
					],
					PostToolUse: [
						{
							matcher: "*",
							hooks: [
								{ type: "command", command: "bun test" },
								{ type: "command" }, // missing command
							],
						},
					],
				},
			});

			const issues = await validateHooksJson({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				ruleId: "hooks/missing-command",
				message: expect.stringContaining("PostToolUse[0].hooks[1]"),
			});
		});
	});
});
