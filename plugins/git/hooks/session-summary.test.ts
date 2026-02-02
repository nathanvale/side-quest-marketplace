import { describe, expect, test } from "bun:test";
import { type CortexEntry, extractFromTranscript } from "./session-summary";

describe("extractFromTranscript", () => {
	function makeTranscript(
		messages: { type: string; content: string }[],
	): string {
		return messages
			.map((m) =>
				JSON.stringify({
					type: m.type,
					message: { role: m.type, content: m.content },
				}),
			)
			.join("\n");
	}

	test("extracts decision patterns", () => {
		const transcript = makeTranscript([
			{ type: "user", content: "How should we handle auth?" },
			{
				type: "assistant",
				content: "We decided to use JWT tokens for stateless auth.",
			},
		]);

		const entries = extractFromTranscript(transcript);
		expect(entries.length).toBeGreaterThan(0);

		const decision = entries.find((e) => e.type === "decision");
		expect(decision).toBeDefined();
		expect(decision?.salience).toBe(0.9);
		expect(decision?.content).toContain("use JWT tokens");
	});

	test("extracts error fix patterns", () => {
		const transcript = makeTranscript([
			{
				type: "assistant",
				content: "The error was caused by a missing import statement.",
			},
		]);

		const entries = extractFromTranscript(transcript);
		const fix = entries.find((e) => e.type === "error_fix");
		expect(fix).toBeDefined();
		expect(fix?.salience).toBe(0.8);
	});

	test("extracts learning patterns", () => {
		const transcript = makeTranscript([
			{
				type: "assistant",
				content: "Turns out the API requires a Bearer token in the header.",
			},
		]);

		const entries = extractFromTranscript(transcript);
		const learning = entries.find((e) => e.type === "learning");
		expect(learning).toBeDefined();
		expect(learning?.salience).toBe(0.7);
	});

	test("extracts preference patterns", () => {
		const transcript = makeTranscript([
			{
				type: "user",
				content: "I always want tests written before implementation.",
			},
		]);

		const entries = extractFromTranscript(transcript);
		const pref = entries.find((e) => e.type === "preference");
		expect(pref).toBeDefined();
		expect(pref?.salience).toBe(0.7);
	});

	test("deduplicates identical content", () => {
		const transcript = makeTranscript([
			{ type: "assistant", content: "We decided to use React." },
			{ type: "assistant", content: "We decided to use React." },
		]);

		const entries = extractFromTranscript(transcript);
		const decisions = entries.filter((e) => e.type === "decision");
		expect(decisions.length).toBe(1);
	});

	test("handles empty transcript", () => {
		const entries = extractFromTranscript("");
		expect(entries).toEqual([]);
	});

	test("handles malformed JSONL lines", () => {
		const transcript = `invalid json line
${JSON.stringify({ type: "assistant", message: { role: "assistant", content: "Turns out the bug was in the parser." } })}`;

		const entries = extractFromTranscript(transcript);
		expect(entries.length).toBeGreaterThan(0);
	});

	test("truncates long content to 200 chars", () => {
		const longContent = `We decided to ${"a".repeat(300)} end`;
		const transcript = makeTranscript([
			{ type: "assistant", content: longContent },
		]);

		const entries = extractFromTranscript(transcript);
		if (entries.length > 0) {
			expect(entries[0]?.content.length).toBeLessThanOrEqual(200);
		}
	});

	test("handles content array format for assistant messages", () => {
		const transcript = JSON.stringify({
			type: "assistant",
			message: {
				role: "assistant",
				content: [
					{ type: "text", text: "The root cause was a race condition." },
				],
			},
		});

		const entries = extractFromTranscript(transcript);
		const fix = entries.find((e) => e.type === "error_fix");
		expect(fix).toBeDefined();
	});

	test("import.meta.main guard prevents hanging on import", async () => {
		// Verify the module can be imported without hanging
		// If import.meta.main guard is missing, this test would time out
		const mod = await import("./session-summary");
		expect(mod.extractFromTranscript).toBeDefined();
	});
});
