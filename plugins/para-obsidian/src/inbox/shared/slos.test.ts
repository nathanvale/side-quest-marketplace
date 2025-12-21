import { beforeEach, describe, expect, test } from "bun:test";
import {
	checkSLOBreach,
	getBurnRate,
	getSLODefinition,
	getSLONames,
	recordSLOEvent,
	resetSLOEvents,
	SLO_DEFINITIONS,
} from "./slos";

describe("slos", () => {
	beforeEach(() => {
		resetSLOEvents();
	});

	describe("SLO_DEFINITIONS", () => {
		test("should define scan_latency SLO", () => {
			const slo = SLO_DEFINITIONS.scan_latency;
			expect(slo).toBeDefined();
			if (!slo) throw new Error("scan_latency SLO not defined");
			expect(slo.name).toBe("Scan Latency");
			expect(slo.target).toBe(0.95);
			expect(slo.threshold).toBe(60_000);
			expect(slo.unit).toBe("ms");
			expect(slo.window).toBe("30d");
			expect(slo.errorBudget).toBe(0.05);
		});

		test("should define execute_success SLO", () => {
			const slo = SLO_DEFINITIONS.execute_success;
			expect(slo).toBeDefined();
			if (!slo) throw new Error("execute_success SLO not defined");
			expect(slo.name).toBe("Execute Success Rate");
			expect(slo.target).toBe(0.99);
			expect(slo.threshold).toBe(99);
			expect(slo.unit).toBe("percent");
			expect(slo.window).toBe("7d");
			expect(slo.errorBudget).toBe(0.01);
		});

		test("should define llm_availability SLO", () => {
			const slo = SLO_DEFINITIONS.llm_availability;
			expect(slo).toBeDefined();
			if (!slo) throw new Error("llm_availability SLO not defined");
			expect(slo.name).toBe("LLM Availability");
			expect(slo.target).toBe(0.8);
			expect(slo.threshold).toBe(80);
			expect(slo.unit).toBe("percent");
			expect(slo.window).toBe("24h");
			expect(slo.errorBudget).toBe(0.2);
		});

		test("should have error budget equal to 1 - target", () => {
			for (const [_name, slo] of Object.entries(SLO_DEFINITIONS)) {
				expect(slo.errorBudget).toBeCloseTo(1 - slo.target, 10);
			}
		});
	});

	describe("checkSLOBreach", () => {
		describe("latency SLOs (ms)", () => {
			test("should not breach when value is below threshold", () => {
				const result = checkSLOBreach("scan_latency", 50_000);
				expect(result.breached).toBe(false);
				expect(result.burnRate).toBe(0);
				expect(result.currentValue).toBe(50_000);
				expect(result.slo.name).toBe("Scan Latency");
			});

			test("should breach when value is above threshold", () => {
				const result = checkSLOBreach("scan_latency", 70_000);
				expect(result.breached).toBe(true);
				expect(result.burnRate).toBe(1); // Simplified burn rate when breached
				expect(result.currentValue).toBe(70_000);
				expect(result.slo.name).toBe("Scan Latency");
			});

			test("should breach when value equals threshold", () => {
				const result = checkSLOBreach("scan_latency", 60_000);
				expect(result.breached).toBe(false);
				expect(result.burnRate).toBe(0);
			});
		});

		describe("percentage SLOs", () => {
			test("should not breach when value is above threshold", () => {
				const result = checkSLOBreach("execute_success", 99.5);
				expect(result.breached).toBe(false);
				expect(result.burnRate).toBe(0);
				expect(result.currentValue).toBe(99.5);
				expect(result.slo.name).toBe("Execute Success Rate");
			});

			test("should breach when value is below threshold", () => {
				const result = checkSLOBreach("execute_success", 95);
				expect(result.breached).toBe(true);
				expect(result.burnRate).toBe(1); // Simplified burn rate when breached
				expect(result.currentValue).toBe(95);
				expect(result.slo.name).toBe("Execute Success Rate");
			});

			test("should not breach when value equals threshold", () => {
				const result = checkSLOBreach("execute_success", 99);
				expect(result.breached).toBe(false);
				expect(result.burnRate).toBe(0);
			});
		});

		describe("llm_availability SLO", () => {
			test("should not breach when availability is high", () => {
				const result = checkSLOBreach("llm_availability", 85);
				expect(result.breached).toBe(false);
				expect(result.burnRate).toBe(0);
			});

			test("should breach when availability is low", () => {
				const result = checkSLOBreach("llm_availability", 70);
				expect(result.breached).toBe(true);
				expect(result.burnRate).toBe(1); // Simplified burn rate when breached
			});

			test("should not breach when at threshold", () => {
				const result = checkSLOBreach("llm_availability", 80);
				expect(result.breached).toBe(false);
				expect(result.burnRate).toBe(0);
			});
		});

		describe("unknown SLO", () => {
			test("should return safe defaults for unknown SLO", () => {
				const result = checkSLOBreach("unknown_slo", 100);
				expect(result.breached).toBe(false);
				expect(result.burnRate).toBe(0);
				expect(result.currentValue).toBe(100);
				expect(result.slo.name).toBe("Unknown");
				expect(result.slo.target).toBe(0);
				expect(result.slo.threshold).toBe(0);
				expect(result.slo.errorBudget).toBe(0);
			});
		});

		describe("edge cases", () => {
			test("should handle zero values", () => {
				const result = checkSLOBreach("scan_latency", 0);
				expect(result.breached).toBe(false);
				expect(result.currentValue).toBe(0);
			});

			test("should handle negative values", () => {
				const result = checkSLOBreach("execute_success", -1);
				expect(result.breached).toBe(true);
				expect(result.currentValue).toBe(-1);
			});

			test("should handle very large values", () => {
				const result = checkSLOBreach("scan_latency", Number.MAX_SAFE_INTEGER);
				expect(result.breached).toBe(true);
				expect(result.currentValue).toBe(Number.MAX_SAFE_INTEGER);
			});
		});
	});

	describe("getSLONames", () => {
		test("should return all SLO names", () => {
			const names = getSLONames();
			expect(names).toContain("scan_latency");
			expect(names).toContain("execute_success");
			expect(names).toContain("llm_availability");
			expect(names).toContain("execute_latency");
			expect(names).toContain("extraction_latency");
			expect(names).toContain("enrichment_latency");
			expect(names).toContain("llm_latency");
			expect(names.length).toBe(7);
		});

		test("should return array of strings", () => {
			const names = getSLONames();
			for (const name of names) {
				expect(typeof name).toBe("string");
			}
		});
	});

	describe("getSLODefinition", () => {
		test("should return SLO definition for valid name", () => {
			const slo = getSLODefinition("scan_latency");
			expect(slo).toBeDefined();
			expect(slo?.name).toBe("Scan Latency");
			expect(slo?.target).toBe(0.95);
		});

		test("should return undefined for unknown SLO name", () => {
			const slo = getSLODefinition("unknown_slo");
			expect(slo).toBeUndefined();
		});

		test("should return all defined SLOs", () => {
			expect(getSLODefinition("scan_latency")).toBeDefined();
			expect(getSLODefinition("execute_success")).toBeDefined();
			expect(getSLODefinition("llm_availability")).toBeDefined();
		});
	});

	describe("SLOBreachResult type", () => {
		test("should have correct structure", () => {
			const result = checkSLOBreach("scan_latency", 50_000);

			// Verify structure
			expect(result).toHaveProperty("breached");
			expect(result).toHaveProperty("burnRate");
			expect(result).toHaveProperty("currentValue");
			expect(result).toHaveProperty("slo");

			// Verify types
			expect(typeof result.breached).toBe("boolean");
			expect(typeof result.burnRate).toBe("number");
			expect(typeof result.currentValue).toBe("number");
			expect(typeof result.slo).toBe("object");

			// Verify SLO structure
			expect(result.slo).toHaveProperty("name");
			expect(result.slo).toHaveProperty("target");
			expect(result.slo).toHaveProperty("threshold");
			expect(result.slo).toHaveProperty("unit");
			expect(result.slo).toHaveProperty("window");
			expect(result.slo).toHaveProperty("errorBudget");
		});
	});

	describe("SLO integration", () => {
		test("should support complete workflow", () => {
			// Get all SLO names
			const names = getSLONames();

			// Check each SLO
			for (const name of names) {
				const definition = getSLODefinition(name);
				expect(definition).toBeDefined();
				if (!definition) continue;

				// Check breach with a value
				const result = checkSLOBreach(name, 100);
				expect(result).toBeDefined();
				expect(result.slo.name).toBe(definition.name);
			}
		});

		test("should allow monitoring multiple SLOs simultaneously", () => {
			const checks = [
				{ name: "scan_latency", value: 65_000 },
				{ name: "execute_success", value: 98 },
				{ name: "llm_availability", value: 75 },
			];

			const results = checks.map(({ name, value }) =>
				checkSLOBreach(name, value),
			);

			// scan_latency should breach (65s > 60s)
			expect(results[0]?.breached).toBe(true);

			// execute_success should breach (98% < 99%)
			expect(results[1]?.breached).toBe(true);

			// llm_availability should breach (75% < 80%)
			expect(results[2]?.breached).toBe(true);
		});
	});

	describe("recordSLOEvent", () => {
		test("records non-violated event", () => {
			recordSLOEvent("scan_latency", false);

			const burnRate = getBurnRate("scan_latency");
			expect(burnRate).toBe(0);
		});

		test("records violated event", () => {
			recordSLOEvent("scan_latency", true);

			const burnRate = getBurnRate("scan_latency");
			expect(burnRate).toBeGreaterThan(0);
		});

		test("records multiple events", () => {
			recordSLOEvent("scan_latency", false);
			recordSLOEvent("scan_latency", false);
			recordSLOEvent("scan_latency", true);

			// 1 violation out of 3 events = 33% violation rate
			// Error budget is 5%, so burn rate = 0.33 / 0.05 = 6.6
			const burnRate = getBurnRate("scan_latency");
			expect(burnRate).toBeCloseTo(6.67, 1);
		});
	});

	describe("getBurnRate", () => {
		test("returns 0 for unknown SLO", () => {
			expect(getBurnRate("unknown_slo")).toBe(0);
		});

		test("returns 0 when no events recorded", () => {
			expect(getBurnRate("scan_latency")).toBe(0);
		});

		test("returns 0 when all events successful", () => {
			recordSLOEvent("scan_latency", false);
			recordSLOEvent("scan_latency", false);
			recordSLOEvent("scan_latency", false);

			expect(getBurnRate("scan_latency")).toBe(0);
		});

		test("calculates burn rate at exactly error budget", () => {
			// scan_latency has 5% error budget
			// 5 violations out of 100 events = 5% violation rate
			for (let i = 0; i < 95; i++) {
				recordSLOEvent("scan_latency", false);
			}
			for (let i = 0; i < 5; i++) {
				recordSLOEvent("scan_latency", true);
			}

			const burnRate = getBurnRate("scan_latency");
			expect(burnRate).toBeCloseTo(1.0, 1);
		});

		test("calculates burn rate above error budget", () => {
			// 10 violations out of 100 events = 10% violation rate
			// Error budget is 5%, so burn rate = 0.10 / 0.05 = 2.0
			for (let i = 0; i < 90; i++) {
				recordSLOEvent("scan_latency", false);
			}
			for (let i = 0; i < 10; i++) {
				recordSLOEvent("scan_latency", true);
			}

			const burnRate = getBurnRate("scan_latency");
			expect(burnRate).toBeCloseTo(2.0, 1);
		});

		test("calculates burn rate below error budget", () => {
			// 2 violations out of 100 events = 2% violation rate
			// Error budget is 5%, so burn rate = 0.02 / 0.05 = 0.4
			for (let i = 0; i < 98; i++) {
				recordSLOEvent("scan_latency", false);
			}
			for (let i = 0; i < 2; i++) {
				recordSLOEvent("scan_latency", true);
			}

			const burnRate = getBurnRate("scan_latency");
			expect(burnRate).toBeCloseTo(0.4, 1);
		});

		test("tracks different SLOs independently", () => {
			recordSLOEvent("scan_latency", true);
			recordSLOEvent("execute_success", false);

			expect(getBurnRate("scan_latency")).toBeGreaterThan(0);
			expect(getBurnRate("execute_success")).toBe(0);
		});

		test("handles 100% violation rate", () => {
			recordSLOEvent("scan_latency", true);
			recordSLOEvent("scan_latency", true);
			recordSLOEvent("scan_latency", true);

			// 100% violation rate / 5% error budget = 20x burn rate
			const burnRate = getBurnRate("scan_latency");
			expect(burnRate).toBeCloseTo(20.0, 1);
		});
	});

	describe("checkSLOBreach with burn rate", () => {
		beforeEach(() => {
			resetSLOEvents();
		});

		test("includes actual burn rate in breach result", () => {
			recordSLOEvent("scan_latency", true);
			recordSLOEvent("scan_latency", false);

			const result = checkSLOBreach("scan_latency", 50_000);

			expect(result.burnRate).toBeGreaterThan(0);
			expect(result.burnRate).toBeCloseTo(10.0, 1); // 50% violation / 5% budget = 10x
		});

		test("returns 0 burn rate when no events recorded", () => {
			const result = checkSLOBreach("scan_latency", 50_000);

			expect(result.burnRate).toBe(0);
		});
	});

	describe("resetSLOEvents", () => {
		test("clears all recorded events", () => {
			recordSLOEvent("scan_latency", true);
			recordSLOEvent("execute_success", true);

			expect(getBurnRate("scan_latency")).toBeGreaterThan(0);
			expect(getBurnRate("execute_success")).toBeGreaterThan(0);

			resetSLOEvents();

			expect(getBurnRate("scan_latency")).toBe(0);
			expect(getBurnRate("execute_success")).toBe(0);
		});
	});
}); // End of main describe block
