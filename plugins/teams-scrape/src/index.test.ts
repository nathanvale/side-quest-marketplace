import { describe, expect, test } from "bun:test";
import {
	CONFIG_DIR,
	generateMessageId,
	PLUGIN_NAME,
	parseAUDateToISO,
	parseTeamsClipboard,
	targetToSlug,
} from "./index.js";

describe("teams-scrape", () => {
	test("exports plugin name", () => {
		expect(PLUGIN_NAME).toBe("teams-scrape");
	});

	test("exports parser functions", () => {
		expect(typeof parseTeamsClipboard).toBe("function");
		expect(typeof parseAUDateToISO).toBe("function");
		expect(typeof generateMessageId).toBe("function");
	});

	test("exports storage functions", () => {
		expect(typeof targetToSlug).toBe("function");
		expect(typeof CONFIG_DIR).toBe("string");
	});
});
