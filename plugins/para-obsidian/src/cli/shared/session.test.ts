/**
 * Tests for session management utilities.
 */

import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { startSession } from "./session";

describe("startSession", () => {
	let consoleLogSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		// Spy on console.log to capture output
		consoleLogSpy = spyOn(console, "log").mockImplementation(() => {});
	});

	afterEach(() => {
		// Restore console.log after each test
		consoleLogSpy.mockRestore();
	});

	test("prints dim start line with command name and correlation ID", () => {
		startSession("para scan");

		expect(consoleLogSpy).toHaveBeenCalledTimes(1);
		const call = consoleLogSpy.mock.calls[0];
		const output = call[0] as string;

		// Check output contains command name and session ID pattern (8-char UUID)
		expect(output).toContain("▸ para scan");
		expect(output).toMatch(/\[[a-f0-9]{8}\]/);
	});

	test("returns session object with sessionCid and startTime", () => {
		const beforeTime = Date.now();
		const session = startSession("para test");
		const afterTime = Date.now();

		expect(session).toHaveProperty("sessionCid");
		expect(session).toHaveProperty("startTime");
		expect(session).toHaveProperty("end");

		// CID should match pattern (8-char UUID)
		expect(session.sessionCid).toMatch(/^[a-f0-9]{8}$/);

		// Start time should be reasonable
		expect(session.startTime).toBeGreaterThanOrEqual(beforeTime);
		expect(session.startTime).toBeLessThanOrEqual(afterTime);
	});

	test("end() prints success message with duration", () => {
		const session = startSession("para test");
		consoleLogSpy.mockClear();

		// Wait a bit to get measurable duration
		const start = Date.now();
		while (Date.now() - start < 10); // Wait ~10ms

		session.end({ success: true });

		expect(consoleLogSpy).toHaveBeenCalledTimes(1);
		const call = consoleLogSpy.mock.calls[0];
		const output = call[0] as string;

		expect(output).toContain("Session:");
		expect(output).toContain(session.sessionCid);
		expect(output).toMatch(/\(\d+\.\d+s\)/); // Duration in seconds
	});

	test("end() prints success message when called without options", () => {
		const session = startSession("para test");
		consoleLogSpy.mockClear();

		session.end();

		expect(consoleLogSpy).toHaveBeenCalledTimes(1);
		const call = consoleLogSpy.mock.calls[0];
		const output = call[0] as string;

		expect(output).toContain("Session:");
		expect(output).toContain(session.sessionCid);
	});

	test("end() prints error message when error provided", () => {
		const session = startSession("para test");
		consoleLogSpy.mockClear();

		session.end({ error: "Connection timeout" });

		expect(consoleLogSpy).toHaveBeenCalledTimes(1);
		const call = consoleLogSpy.mock.calls[0];
		const output = call[0] as string;

		expect(output).toContain("Failed");
		expect(output).toContain(session.sessionCid);
		expect(output).toContain("Connection timeout");
		expect(output).toMatch(/\(\d+\.\d+s\)/);
	});

	test("end() prints error message when success is false", () => {
		const session = startSession("para test");
		consoleLogSpy.mockClear();

		session.end({ success: false });

		expect(consoleLogSpy).toHaveBeenCalledTimes(1);
		const call = consoleLogSpy.mock.calls[0];
		const output = call[0] as string;

		expect(output).toContain("Failed");
		expect(output).toContain(session.sessionCid);
		expect(output).toContain("Unknown error");
	});

	test("end() prefers error message over success flag", () => {
		const session = startSession("para test");
		consoleLogSpy.mockClear();

		session.end({ success: true, error: "Something went wrong" });

		expect(consoleLogSpy).toHaveBeenCalledTimes(1);
		const call = consoleLogSpy.mock.calls[0];
		const output = call[0] as string;

		expect(output).toContain("Failed");
		expect(output).toContain("Something went wrong");
	});

	test("calculates duration correctly", () => {
		const session = startSession("para test");
		consoleLogSpy.mockClear();

		// Mock time passage
		const originalNow = Date.now;
		const startTime = session.startTime;
		Date.now = () => startTime + 3240; // 3.24 seconds later

		try {
			session.end({ success: true });

			const call = consoleLogSpy.mock.calls[0];
			const output = call[0] as string;

			// Should show 3.2s (rounded to 1 decimal)
			expect(output).toContain("(3.2s)");
		} finally {
			Date.now = originalNow;
		}
	});

	test("different sessions get unique correlation IDs", () => {
		const session1 = startSession("para scan");
		const session2 = startSession("para scan");

		expect(session1.sessionCid).not.toBe(session2.sessionCid);
	});

	test("session can be used multiple times in try/catch pattern", () => {
		const session = startSession("para test");
		consoleLogSpy.mockClear();

		try {
			// Simulate some work
			throw new Error("Test error");
		} catch (error) {
			session.end({ error: (error as Error).message });
		}

		expect(consoleLogSpy).toHaveBeenCalledTimes(1);
		const output = consoleLogSpy.mock.calls[0][0] as string;
		expect(output).toContain("Test error");
	});
});

describe("Session type", () => {
	test("Session interface matches return type", () => {
		const session = startSession("para test");

		// Type checks - these will fail at compile time if types don't match
		expect(session.sessionCid).toBeTypeOf("string");
		expect(session.startTime).toBeTypeOf("number");
		expect(session.end).toBeTypeOf("function");
	});
});

describe("startSession silent mode", () => {
	let consoleLogSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		consoleLogSpy = spyOn(console, "log").mockImplementation(() => {});
	});

	afterEach(() => {
		consoleLogSpy.mockRestore();
	});

	test("silent mode suppresses start line", () => {
		startSession("para scan", { silent: true });

		expect(consoleLogSpy).not.toHaveBeenCalled();
	});

	test("silent mode suppresses end line", () => {
		const session = startSession("para scan", { silent: true });
		session.end({ success: true });

		expect(consoleLogSpy).not.toHaveBeenCalled();
	});

	test("silent mode suppresses error line", () => {
		const session = startSession("para scan", { silent: true });
		session.end({ error: "Test error" });

		expect(consoleLogSpy).not.toHaveBeenCalled();
	});

	test("silent mode still returns valid session object", () => {
		const session = startSession("para scan", { silent: true });

		expect(session.sessionCid).toMatch(/^[a-f0-9]{8}$/);
		expect(session.startTime).toBeTypeOf("number");
		expect(session.end).toBeTypeOf("function");
	});

	test("non-silent mode (default) still prints output", () => {
		const session = startSession("para scan");

		expect(consoleLogSpy).toHaveBeenCalledTimes(1);

		consoleLogSpy.mockClear();
		session.end({ success: true });

		expect(consoleLogSpy).toHaveBeenCalledTimes(1);
	});
});
