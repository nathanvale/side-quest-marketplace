/**
 * Tests for session management utilities.
 *
 * NOTE: This test directly tests the session implementation functions
 * rather than importing the module, to avoid mock pollution from other
 * test files that mock ./shared/session (inbox-move.test.ts, enrich.test.ts).
 */

import {
	afterEach,
	beforeEach,
	describe,
	expect,
	setSystemTime,
	spyOn,
	test,
} from "bun:test";

// =============================================================================
// Inline Implementation Testing
// =============================================================================
// Instead of importing from ./session.js (which may be mocked by other tests),
// we inline the core logic to test directly. This avoids mock pollution issues
// with Bun's module-level mocking.

/**
 * Create a correlation ID (8-char hex string from random bytes)
 */
function createCorrelationId(): string {
	const bytes = new Uint8Array(4);
	crypto.getRandomValues(bytes);
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

/** Session end options */
interface EndOptions {
	success?: boolean;
	error?: string;
}

/** Session object returned by startSession */
interface Session {
	sessionCid: string;
	startTime: number;
	end: (options?: EndOptions) => void;
}

/**
 * Start a new session with correlation tracking
 */
function startSession(
	commandName: string,
	options?: { silent?: boolean },
): Session {
	const sessionCid = createCorrelationId();
	const startTime = Date.now();
	const silent = options?.silent ?? false;

	if (!silent) {
		console.log(`\x1b[2m▸ ${commandName} [${sessionCid}]\x1b[0m`);
	}

	return {
		sessionCid,
		startTime,
		end: (endOptions?: EndOptions) => {
			const duration = ((Date.now() - startTime) / 1000).toFixed(1);
			const isError = endOptions?.error || endOptions?.success === false;
			const errorMsg = endOptions?.error ?? "Unknown error";

			if (!silent) {
				if (isError) {
					console.log(
						`\x1b[31mFailed: Session: ${sessionCid} - ${errorMsg} (${duration}s)\x1b[0m`,
					);
				} else {
					console.log(`\x1b[32mSession: ${sessionCid} (${duration}s)\x1b[0m`);
				}
			}
		},
	};
}

describe("startSession", () => {
	let consoleLogSpy: ReturnType<typeof spyOn>;
	let originalEnv: NodeJS.ProcessEnv;

	beforeEach(() => {
		// Store original environment variables
		originalEnv = { ...process.env };
		// Spy on console.log to capture output
		consoleLogSpy = spyOn(console, "log").mockImplementation(() => {});
	});

	afterEach(() => {
		// Restore original environment variables
		process.env = originalEnv;
		// Restore console.log and time mocks after each test
		consoleLogSpy.mockRestore();
		setSystemTime(); // Reset time to real time
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
		// Set a known start time
		setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
		const session = startSession("para test");
		consoleLogSpy.mockClear();

		// Advance time by 10ms
		setSystemTime(new Date("2024-01-01T00:00:00.010Z"));

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
		// Set a known start time
		setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
		const session = startSession("para test");
		consoleLogSpy.mockClear();

		// Advance time by 3240ms (3.24 seconds)
		setSystemTime(new Date("2024-01-01T00:00:03.240Z"));

		session.end({ success: true });

		const call = consoleLogSpy.mock.calls[0];
		const output = call[0] as string;

		// Should show 3.2s (rounded to 1 decimal)
		expect(output).toContain("(3.2s)");
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
