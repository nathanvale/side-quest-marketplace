import { describe, expect, it } from "bun:test";
import { computeFrontmatterHints, suggestFieldsForType } from "./cli";
import type { ParaObsidianConfig } from "./config";

describe("frontmatter suggestions", () => {
	it("returns allowed fields and enums for known type", () => {
		const config = {
			vault: "/tmp",
			frontmatterRules: {
				project: {
					required: {
						title: { type: "string" },
						status: { type: "enum", enum: ["active", "paused"] },
					},
				},
			},
		} as unknown as ParaObsidianConfig;

		const suggestions = suggestFieldsForType(config, "project");
		expect(suggestions.allowed).toContain("title");
		expect(suggestions.enums.status).toEqual(["active", "paused"]);
	});

	it("provides warnings and enum hints for invalid values", () => {
		const config = {
			vault: "/tmp",
			frontmatterRules: {
				project: {
					required: {
						status: { type: "enum", enum: ["active", "paused"] },
					},
				},
			},
		} as unknown as ParaObsidianConfig;

		const { warnings, fixHints } = computeFrontmatterHints(
			config,
			"project",
			{ status: "wrong" },
			{ status: "wrong" },
		);

		expect(warnings.some((w) => w.includes("allowed"))).toBe(true);
		expect(fixHints.some((h) => h.includes("allowed values"))).toBe(true);
	});
});
