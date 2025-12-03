import { describe, expect, test } from "bun:test";
import { createPluginLogger } from "./factory";

describe("createPluginLogger", () => {
	test("creates logger with required functions and paths", () => {
		const logger = createPluginLogger({
			name: "test-plugin",
			subsystems: ["api", "cache"],
		});

		expect(typeof logger.initLogger).toBe("function");
		expect(typeof logger.createCorrelationId).toBe("function");
		expect(typeof logger.getSubsystemLogger).toBe("function");
		expect(typeof logger.rootLogger).toBe("object");
		expect(typeof logger.logDir).toBe("string");
		expect(typeof logger.logFile).toBe("string");
	});

	test("creates correlation IDs with correct format", () => {
		const logger = createPluginLogger({
			name: "test-plugin",
			subsystems: [],
		});

		const cid = logger.createCorrelationId();
		// Format: 8 hex chars
		expect(cid).toMatch(/^[a-f0-9]{8}$/);
	});

	test("generates unique correlation IDs", () => {
		const logger = createPluginLogger({
			name: "test-plugin",
			subsystems: [],
		});

		const ids = new Set<string>();
		for (let i = 0; i < 100; i++) {
			ids.add(logger.createCorrelationId());
		}

		// All 100 should be unique
		expect(ids.size).toBe(100);
	});

	test("returns centralized log directory path", () => {
		const logger = createPluginLogger({
			name: "my-plugin",
			subsystems: [],
		});

		expect(logger.logDir).toContain(".claude");
		expect(logger.logDir).toEndWith("logs");
	});

	test("returns log file path with correct extension", () => {
		const logger = createPluginLogger({
			name: "my-plugin",
			subsystems: [],
		});

		expect(logger.logFile).toContain("my-plugin.jsonl");
	});

	test("pre-creates subsystem loggers", () => {
		const logger = createPluginLogger({
			name: "test-plugin",
			subsystems: ["api", "cache"],
		});

		expect(logger.subsystemLoggers.api).toBeDefined();
		expect(logger.subsystemLoggers.cache).toBeDefined();
	});

	test("getSubsystemLogger returns logger for any subsystem", () => {
		const logger = createPluginLogger({
			name: "test-plugin",
			subsystems: ["api"],
		});

		// Can get any subsystem, not just pre-created ones
		const unknownLogger = logger.getSubsystemLogger("unknown");
		expect(unknownLogger).toBeDefined();
		expect(typeof unknownLogger.info).toBe("function");
	});
});
