import { describe, expect, test } from "bun:test";
import type {
	PreCompactHookInput,
	SessionStartHookInput,
} from "@anthropic-ai/claude-agent-sdk";

// Test the hook input types and basic functionality

describe("SessionStartHookInput type", () => {
	test("has correct shape", () => {
		const input: SessionStartHookInput = {
			session_id: "test-session-123",
			transcript_path: "/tmp/transcript",
			cwd: "/Users/test/code",
			hook_event_name: "SessionStart",
			source: "startup",
		};

		expect(input.session_id).toBe("test-session-123");
		expect(input.cwd).toBe("/Users/test/code");
		expect(input.hook_event_name).toBe("SessionStart");
		expect(input.source).toBe("startup");
	});

	test("source can be startup, resume, clear, or compact", () => {
		const sources: SessionStartHookInput["source"][] = [
			"startup",
			"resume",
			"clear",
			"compact",
		];

		sources.forEach((source) => {
			const input: SessionStartHookInput = {
				session_id: "test",
				transcript_path: "/tmp",
				cwd: "/tmp",
				hook_event_name: "SessionStart",
				source,
			};
			expect(input.source).toBe(source);
		});
	});
});

describe("PreCompactHookInput type", () => {
	test("has correct shape", () => {
		const input: PreCompactHookInput = {
			session_id: "test-session-123",
			transcript_path: "/tmp/transcript",
			cwd: "/Users/test/code",
			hook_event_name: "PreCompact",
			trigger: "auto",
			custom_instructions: null,
		};

		expect(input.session_id).toBe("test-session-123");
		expect(input.hook_event_name).toBe("PreCompact");
		expect(input.trigger).toBe("auto");
		expect(input.custom_instructions).toBeNull();
	});

	test("trigger can be manual or auto", () => {
		const triggers: PreCompactHookInput["trigger"][] = ["manual", "auto"];

		triggers.forEach((trigger) => {
			const input: PreCompactHookInput = {
				session_id: "test",
				transcript_path: "/tmp",
				cwd: "/tmp",
				hook_event_name: "PreCompact",
				trigger,
				custom_instructions: null,
			};
			expect(input.trigger).toBe(trigger);
		});
	});

	test("custom_instructions can be string or null", () => {
		const withInstructions: PreCompactHookInput = {
			session_id: "test",
			transcript_path: "/tmp",
			cwd: "/tmp",
			hook_event_name: "PreCompact",
			trigger: "manual",
			custom_instructions: "Focus on the auth changes",
		};

		const withoutInstructions: PreCompactHookInput = {
			session_id: "test",
			transcript_path: "/tmp",
			cwd: "/tmp",
			hook_event_name: "PreCompact",
			trigger: "auto",
			custom_instructions: null,
		};

		expect(withInstructions.custom_instructions).toBe(
			"Focus on the auth changes",
		);
		expect(withoutInstructions.custom_instructions).toBeNull();
	});
});

describe("git-context-loader", () => {
	test("can be run with valid input", async () => {
		const input: SessionStartHookInput = {
			session_id: "test-123",
			transcript_path: "/tmp/transcript",
			cwd: import.meta.dir, // Use the hooks directory (which is in a git repo)
			hook_event_name: "SessionStart",
			source: "startup",
		};

		// Run the actual hook script using echo to pipe input
		const proc = Bun.spawn(
			[
				"sh",
				"-c",
				`echo '${JSON.stringify(input)}' | bun run git-context-loader.ts`,
			],
			{
				cwd: import.meta.dir,
				stdout: "pipe",
				stderr: "pipe",
			},
		);

		// Wait for process to complete
		const exitCode = await proc.exited;
		const stdout = await new Response(proc.stdout).text();

		expect(exitCode).toBe(0);
		// Should output git context
		expect(stdout).toContain("Git Context:");
		expect(stdout).toContain("Branch:");
	});

	test("skips non-startup sources", async () => {
		const input: SessionStartHookInput = {
			session_id: "test-123",
			transcript_path: "/tmp/transcript",
			cwd: import.meta.dir,
			hook_event_name: "SessionStart",
			source: "resume", // Not startup
		};

		const proc = Bun.spawn(
			[
				"sh",
				"-c",
				`echo '${JSON.stringify(input)}' | bun run git-context-loader.ts`,
			],
			{
				cwd: import.meta.dir,
				stdout: "pipe",
				stderr: "pipe",
			},
		);

		const exitCode = await proc.exited;
		const stdout = await new Response(proc.stdout).text();

		expect(exitCode).toBe(0);
		// Should NOT output git context for resume
		expect(stdout).not.toContain("Git Context:");
	});
});

describe("session-summary", () => {
	test("can be run with valid input", async () => {
		const input: PreCompactHookInput = {
			session_id: "test-123",
			transcript_path: "/tmp/transcript",
			cwd: import.meta.dir,
			hook_event_name: "PreCompact",
			trigger: "manual",
			custom_instructions: null,
		};

		const proc = Bun.spawn(
			[
				"sh",
				"-c",
				`echo '${JSON.stringify(input)}' | bun run session-summary.ts`,
			],
			{
				cwd: import.meta.dir,
				stdout: "pipe",
				stderr: "pipe",
			},
		);

		const exitCode = await proc.exited;
		const stdout = await new Response(proc.stdout).text();

		expect(exitCode).toBe(0);
		expect(stdout).toContain("Session summary saved");
	});
});
