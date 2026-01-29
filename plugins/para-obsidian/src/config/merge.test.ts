import { describe, expect, test } from "bun:test";
import type { TemplateSection } from "./defaults";
import type { FieldRule, FrontmatterRules } from "./index";
import {
	mergeFrontmatterRules,
	mergePerTemplate,
	mergeTemplateSections,
} from "./merge";

describe("mergeFrontmatterRules", () => {
	const defaults: Record<string, FrontmatterRules> = {
		meeting: {
			required: {
				type: { type: "enum", enum: ["meeting"] },
				meeting_type: {
					type: "enum",
					enum: ["1-on-1", "standup", "retro"],
				},
				attendees: { type: "array", optional: true },
			},
			oneOfRequired: ["area", "project"],
		},
		project: {
			required: {
				type: { type: "enum", enum: ["project"] },
				status: {
					type: "enum",
					enum: ["active", "on-hold", "completed"],
				},
			},
		},
	};

	test("returns defaults when no overrides", () => {
		const result = mergeFrontmatterRules(defaults, {});
		expect(result).toEqual(defaults);
	});

	test("user adds a new field to existing template", () => {
		const result = mergeFrontmatterRules(defaults, {
			meeting: {
				required: {
					location: { type: "string", optional: true },
				},
			},
		});

		const meetingRequired = result.meeting?.required as Record<string, unknown>;
		// Original fields preserved
		expect(meetingRequired.type).toEqual({ type: "enum", enum: ["meeting"] });
		expect(meetingRequired.attendees).toEqual({
			type: "array",
			optional: true,
		});
		// New field added
		expect(meetingRequired.location).toEqual({
			type: "string",
			optional: true,
		});
	});

	test("user overrides an enum's values", () => {
		const result = mergeFrontmatterRules(defaults, {
			meeting: {
				required: {
					meeting_type: {
						type: "enum",
						enum: ["1-on-1", "standup", "retro", "workshop"],
					},
				},
			},
		});

		const meetingRequired = result.meeting?.required as Record<string, unknown>;
		expect(meetingRequired.meeting_type).toEqual({
			type: "enum",
			enum: ["1-on-1", "standup", "retro", "workshop"],
		});
		// Other fields untouched
		expect(meetingRequired.type).toEqual({ type: "enum", enum: ["meeting"] });
	});

	test("user removes a field with null", () => {
		const result = mergeFrontmatterRules(defaults, {
			meeting: {
				required: {
					attendees: null,
				} as unknown as Record<string, FieldRule>,
			},
		});

		const meetingRequired = result.meeting?.required as Record<string, unknown>;
		expect(meetingRequired.attendees).toBeUndefined();
		// Other fields preserved
		expect(meetingRequired.type).toEqual({ type: "enum", enum: ["meeting"] });
		expect(meetingRequired.meeting_type).toBeDefined();
	});

	test("user adds entirely new template type", () => {
		const result = mergeFrontmatterRules(defaults, {
			custom: {
				required: {
					type: { type: "enum", enum: ["custom"] },
					name: { type: "string" },
				},
			},
		});

		expect(result.custom).toEqual({
			required: {
				type: { type: "enum", enum: ["custom"] },
				name: { type: "string" },
			},
		});
		// Existing templates untouched
		expect(result.meeting).toBeDefined();
		expect(result.project).toBeDefined();
	});

	test("override forbidden replaces default forbidden", () => {
		const withForbidden: Record<string, FrontmatterRules> = {
			checklist: {
				required: {
					type: { type: "enum", enum: ["checklist"] },
				},
				forbidden: ["area"],
			},
		};

		const result = mergeFrontmatterRules(withForbidden, {
			checklist: {
				required: {},
				forbidden: ["area", "project"],
			},
		});

		expect(result.checklist?.forbidden).toEqual(["area", "project"]);
	});

	test("override oneOfRequired replaces default", () => {
		const result = mergeFrontmatterRules(defaults, {
			meeting: {
				required: {},
				oneOfRequired: ["area"],
			},
		});

		expect(result.meeting?.oneOfRequired).toEqual(["area"]);
	});

	test("unmodified templates pass through unchanged", () => {
		const result = mergeFrontmatterRules(defaults, {
			meeting: {
				required: {
					location: { type: "string" },
				},
			},
		});

		// project was not in overrides — should be identical
		expect(result.project).toEqual(defaults.project);
	});
});

describe("mergePerTemplate", () => {
	test("returns defaults when no overrides", () => {
		const defaults = { project: 1, area: 2 };
		const result = mergePerTemplate(defaults, {});
		expect(result).toEqual(defaults);
	});

	test("user overrides version for one template", () => {
		const defaults = { project: 1, area: 2, meeting: 1 };
		const result = mergePerTemplate(defaults, { meeting: 2 });
		expect(result).toEqual({ project: 1, area: 2, meeting: 2 });
	});

	test("user adds new template key", () => {
		const defaults = { project: 1 };
		const result = mergePerTemplate(defaults, { custom: 1 });
		expect(result).toEqual({ project: 1, custom: 1 });
	});

	test("works for string values (destinations/prefixes)", () => {
		const defaults = { project: "00 Inbox", area: "00 Inbox" };
		const result = mergePerTemplate(defaults, {
			project: "01 Projects",
		});
		expect(result).toEqual({
			project: "01 Projects",
			area: "00 Inbox",
		});
	});
});

describe("mergeTemplateSections", () => {
	const defaults: Partial<Record<string, ReadonlyArray<TemplateSection>>> = {
		meeting: [
			{ heading: "Attendees", hasPrompt: false },
			{ heading: "Notes", hasPrompt: false },
			{ heading: "Action Items", hasPrompt: false },
		],
		project: [
			{ heading: "Overview", hasPrompt: false },
			{ heading: "Tasks", hasPrompt: false },
		],
	};

	test("returns defaults when no overrides", () => {
		const result = mergeTemplateSections(defaults, {});
		expect(result).toEqual(defaults);
	});

	test("user replaces sections for one template, others unchanged", () => {
		const result = mergeTemplateSections(defaults, {
			meeting: [{ heading: "Custom Section", hasPrompt: false }],
		});

		expect(result.meeting).toEqual([
			{ heading: "Custom Section", hasPrompt: false },
		]);
		// project unchanged
		expect(result.project).toEqual(defaults.project);
	});

	test("user adds sections for new template type", () => {
		const result = mergeTemplateSections(defaults, {
			custom: [{ heading: "My Section", hasPrompt: true, promptText: "Enter" }],
		});

		expect(result.custom).toEqual([
			{ heading: "My Section", hasPrompt: true, promptText: "Enter" },
		]);
		expect(result.meeting).toEqual(defaults.meeting);
	});
});
