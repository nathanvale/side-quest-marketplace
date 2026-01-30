import { describe, expect, it } from "bun:test";

import type { ParaObsidianConfig } from "../config/index";
import { filterFieldsForWrite } from "./validate";

/**
 * Creates a minimal config with frontmatter rules for testing.
 */
function makeConfig(
	rules: ParaObsidianConfig["frontmatterRules"] = {},
): ParaObsidianConfig {
	return {
		vault: "/tmp/test-vault",
		frontmatterRules: rules,
	};
}

describe("filterFieldsForWrite", () => {
	const projectRules: ParaObsidianConfig["frontmatterRules"] = {
		project: {
			required: {
				created: { type: "date" },
				type: { type: "enum", enum: ["project"] },
				status: {
					type: "enum",
					enum: ["active", "on-hold", "completed", "archived"],
				},
				start_date: { type: "date" },
				area: { type: "wikilink" },
				depends_on: { type: "array", optional: true },
			},
			forbidden: ["legacy_field", "old_status"],
		},
	};

	it("accepts all valid fields", () => {
		const config = makeConfig(projectRules);
		const result = filterFieldsForWrite(
			{
				status: "active",
				start_date: "2025-01-15",
				area: "[[Development]]",
			},
			"project",
			config,
		);

		expect(result.allAccepted).toBe(true);
		expect(result.accepted).toEqual({
			status: "active",
			start_date: "2025-01-15",
			area: "[[Development]]",
		});
		expect(result.skippedUnknown).toEqual([]);
		expect(result.skippedInvalid).toEqual([]);
		expect(result.skippedForbidden).toEqual([]);
		expect(result.noteType).toBe("project");
	});

	it("skips unknown fields", () => {
		const config = makeConfig(projectRules);
		const result = filterFieldsForWrite(
			{ status: "active", foobar: "oops" },
			"project",
			config,
		);

		expect(result.allAccepted).toBe(false);
		expect(result.accepted).toEqual({ status: "active" });
		expect(result.skippedUnknown).toEqual([
			{ field: "foobar", reason: "not a valid field for type 'project'" },
		]);
	});

	it("skips forbidden fields", () => {
		const config = makeConfig(projectRules);
		const result = filterFieldsForWrite(
			{ status: "active", legacy_field: "bad" },
			"project",
			config,
		);

		expect(result.allAccepted).toBe(false);
		expect(result.accepted).toEqual({ status: "active" });
		expect(result.skippedForbidden).toEqual([
			{
				field: "legacy_field",
				reason: "field not allowed for type 'project'",
			},
		]);
	});

	it("skips known enum field with invalid value", () => {
		const config = makeConfig(projectRules);
		const result = filterFieldsForWrite({ status: "mega" }, "project", config);

		expect(result.allAccepted).toBe(false);
		expect(result.accepted).toEqual({});
		expect(result.skippedInvalid).toHaveLength(1);
		expect(result.skippedInvalid[0]?.field).toBe("status");
		expect(result.skippedInvalid[0]?.reason).toContain(
			"expected one of [active, on-hold, completed, archived]",
		);
	});

	it("skips known field with wrong type", () => {
		const config = makeConfig(projectRules);
		const result = filterFieldsForWrite(
			{ start_date: 12345 },
			"project",
			config,
		);

		expect(result.allAccepted).toBe(false);
		expect(result.accepted).toEqual({});
		expect(result.skippedInvalid).toHaveLength(1);
		expect(result.skippedInvalid[0]?.field).toBe("start_date");
		expect(result.skippedInvalid[0]?.reason).toContain("expected date");
	});

	it("accepts all fields when no rules exist for note type", () => {
		const config = makeConfig(projectRules);
		const result = filterFieldsForWrite(
			{ anything: "goes", random: 42 },
			"unknown_type",
			config,
		);

		expect(result.allAccepted).toBe(true);
		expect(result.accepted).toEqual({ anything: "goes", random: 42 });
	});

	it("accepts all fields when noteType is undefined", () => {
		const config = makeConfig(projectRules);
		const result = filterFieldsForWrite(
			{ anything: "goes" },
			undefined,
			config,
		);

		expect(result.allAccepted).toBe(true);
		expect(result.accepted).toEqual({ anything: "goes" });
		expect(result.noteType).toBeUndefined();
	});

	it("always accepts system-managed fields", () => {
		const config = makeConfig(projectRules);
		const result = filterFieldsForWrite(
			{
				title: "My Note",
				type: "project",
				created: "2025-01-15",
				template_version: 4,
			},
			"project",
			config,
		);

		expect(result.allAccepted).toBe(true);
		expect(result.accepted).toEqual({
			title: "My Note",
			type: "project",
			created: "2025-01-15",
			template_version: 4,
		});
	});

	it("handles mix of valid, unknown, invalid, and forbidden fields", () => {
		const config = makeConfig(projectRules);
		const result = filterFieldsForWrite(
			{
				status: "active",
				start_date: "not-a-date",
				foobar: "unknown",
				legacy_field: "forbidden",
				type: "project",
			},
			"project",
			config,
		);

		expect(result.allAccepted).toBe(false);
		expect(result.accepted).toEqual({
			status: "active",
			type: "project",
		});
		expect(result.skippedUnknown).toHaveLength(1);
		expect(result.skippedInvalid).toHaveLength(1);
		expect(result.skippedForbidden).toHaveLength(1);
	});

	it("accepts null value for known field (means clear field)", () => {
		const config = makeConfig(projectRules);
		const result = filterFieldsForWrite({ status: null }, "project", config);

		expect(result.allAccepted).toBe(true);
		expect(result.accepted).toEqual({ status: null });
	});

	it("accepts undefined value for known field (means clear field)", () => {
		const config = makeConfig(projectRules);
		const result = filterFieldsForWrite(
			{ status: undefined },
			"project",
			config,
		);

		expect(result.allAccepted).toBe(true);
		expect(result.accepted).toEqual({ status: undefined });
	});

	it("accepts optional array field with valid array value", () => {
		const config = makeConfig(projectRules);
		const result = filterFieldsForWrite(
			{ depends_on: ["[[Task A]]", "[[Task B]]"] },
			"project",
			config,
		);

		expect(result.allAccepted).toBe(true);
		expect(result.accepted).toEqual({
			depends_on: ["[[Task A]]", "[[Task B]]"],
		});
	});

	it("accepts all fields when config has no frontmatterRules at all", () => {
		const config = makeConfig(undefined);
		const result = filterFieldsForWrite(
			{ anything: "goes" },
			"project",
			config,
		);

		expect(result.allAccepted).toBe(true);
		expect(result.accepted).toEqual({ anything: "goes" });
	});
});
