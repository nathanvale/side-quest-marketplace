import { describe, expect, test } from "bun:test";
import type { PostToolUseHookInput } from "@anthropic-ai/claude-agent-sdk";
import { createLogEntry } from "./command-logger";

describe("createLogEntry", () => {
	const baseInput = {
		tool_name: "Bash",
		tool_input: { command: "git status" },
		tool_response: "",
		tool_use_id: "test-tool-use-123",
		hook_event_name: "PostToolUse",
		session_id: "test-session-123",
		transcript_path: "/tmp/transcript.jsonl",
		cwd: "/home/user/project",
	} as unknown as PostToolUseHookInput;

	test("creates entry for Bash tool", () => {
		const entry = createLogEntry(baseInput);
		expect(entry).not.toBeNull();
		expect(entry?.command).toBe("git status");
		expect(entry?.session_id).toBe("test-session-123");
		expect(entry?.cwd).toBe("/home/user/project");
		expect(entry?.timestamp).toBeTruthy();
	});

	test("returns null for non-Bash tool", () => {
		const entry = createLogEntry({
			...baseInput,
			tool_name: "Read",
		});
		expect(entry).toBeNull();
	});

	test("returns null when command is missing", () => {
		const entry = createLogEntry({
			...baseInput,
			tool_input: {},
		} as PostToolUseHookInput);
		expect(entry).toBeNull();
	});

	test("returns null when command is not a string", () => {
		const entry = createLogEntry({
			...baseInput,
			tool_input: { command: 123 },
		} as unknown as PostToolUseHookInput);
		expect(entry).toBeNull();
	});

	test("handles missing session_id gracefully", () => {
		const entry = createLogEntry({
			...baseInput,
			session_id: undefined,
		} as unknown as PostToolUseHookInput);
		expect(entry?.session_id).toBe("unknown");
	});
});
