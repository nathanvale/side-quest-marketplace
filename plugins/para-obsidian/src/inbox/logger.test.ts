import { describe, expect, test } from "bun:test";
import {
	createCorrelationId,
	executeLogger,
	getSubsystemLogger,
	inboxLogger,
	llmLogger,
	pdfLogger,
} from "../shared/logger";

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
});
