import { describe, expect, test } from "bun:test";
import {
	consoleEnabled,
	createCorrelationId,
	executeLogger,
	getSubsystemLogger,
	inboxLogger,
	llmLogger,
	logLevel,
	pdfLogger,
} from "./logger";

describe("logger", () => {
	describe("subsystem loggers", () => {
		test("should export inbox logger", () => {
			expect(inboxLogger).toBeDefined();
		});

		test("should export pdf logger", () => {
			expect(pdfLogger).toBeDefined();
		});

		test("should export llm logger", () => {
			expect(llmLogger).toBeDefined();
		});

		test("should export execute logger", () => {
			expect(executeLogger).toBeDefined();
		});
	});

	describe("getSubsystemLogger", () => {
		test("should return inbox logger", () => {
			const logger = getSubsystemLogger("inbox");
			expect(logger).toBe(inboxLogger);
		});

		test("should return pdf logger", () => {
			const logger = getSubsystemLogger("pdf");
			expect(logger).toBe(pdfLogger);
		});

		test("should return llm logger", () => {
			const logger = getSubsystemLogger("llm");
			expect(logger).toBe(llmLogger);
		});

		test("should return execute logger", () => {
			const logger = getSubsystemLogger("execute");
			expect(logger).toBe(executeLogger);
		});
	});

	describe("createCorrelationId", () => {
		test("should generate unique IDs", () => {
			const id1 = createCorrelationId();
			const id2 = createCorrelationId();

			expect(id1).not.toBe(id2);
		});

		test("should generate string IDs", () => {
			const id = createCorrelationId();

			expect(typeof id).toBe("string");
			expect(id.length).toBeGreaterThan(0);
		});

		test("should generate IDs with consistent format", () => {
			const id = createCorrelationId();

			// Should be a valid nanoid-style string (alphanumeric + _-)
			expect(id).toMatch(/^[a-zA-Z0-9_-]+$/);
		});
	});

	describe("environment configuration", () => {
		test("logLevel should be a valid log level", () => {
			expect(logLevel).toMatch(/^(debug|info|warning|error)$/);
		});

		test("consoleEnabled should be a boolean", () => {
			expect(typeof consoleEnabled).toBe("boolean");
		});

		test("logLevel defaults to debug when PARA_LOG_LEVEL not set", () => {
			// This test verifies current behavior based on env at import time
			// If PARA_LOG_LEVEL is not set, logLevel should be "debug"
			if (!process.env.PARA_LOG_LEVEL) {
				expect(logLevel).toBe("debug");
			}
		});

		test("consoleEnabled defaults to false when PARA_LOG_CONSOLE not set", () => {
			// This test verifies current behavior based on env at import time
			// If PARA_LOG_CONSOLE is not set, consoleEnabled should be false
			if (!process.env.PARA_LOG_CONSOLE) {
				expect(consoleEnabled).toBe(false);
			}
		});
	});

	describe("log directory configuration", () => {
		test("should never use PARA_VAULT for log directory", async () => {
			// IMPORTANT: Logs should ALWAYS go to ~/.claude/logs (user directory)
			// NOT to the vault directory, to keep logs centralized
			const { logDir } = await import("./logger");

			// If PARA_OBSIDIAN_LOG_DIR is not set, logDir should be undefined
			// (which causes core to use the default ~/.claude/logs)
			if (!process.env.PARA_OBSIDIAN_LOG_DIR) {
				expect(logDir).toBeUndefined();
			}

			// logDir should never contain the vault path
			if (logDir && process.env.PARA_VAULT) {
				expect(logDir).not.toContain(process.env.PARA_VAULT);
			}
		});
	});
});
