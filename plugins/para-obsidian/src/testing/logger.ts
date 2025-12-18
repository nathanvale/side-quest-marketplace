import { configure } from "@logtape/logtape";

/**
 * Configures LogTape to suppress all logs during tests.
 * Call in beforeEach() or test setup files.
 * Uses reset: true to allow reconfiguration between tests.
 *
 * Suppresses:
 * - para-obsidian category (plugin logs)
 * - All other categories via catch-all (core logs, meta logs)
 */
export async function setupTestLogging(): Promise<void> {
	await configure({
		reset: true,
		sinks: {},
		loggers: [
			{ category: "para-obsidian", sinks: [] },
			{ category: [], sinks: [] }, // Catch-all: suppress ALL loggers
		],
	});
}
