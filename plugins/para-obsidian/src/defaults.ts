/**
 * Default configuration values.
 *
 * This module defines default values for:
 * - Suggested tags for autocompletion
 * - Frontmatter validation rules per note type
 * - Template version numbers
 *
 * These defaults are used when not overridden by user configuration.
 *
 * @module defaults
 */
import type { ParaObsidianConfig } from "./config";

/**
 * Default suggested tags for autocompletion and validation.
 * Covers common PARA categories and organizational concepts.
 */
export const DEFAULT_SUGGESTED_TAGS = [
	"project",
	"area",
	"resource",
	"task",
	"daily",
	"journal",
	"review",
	"weekly",
	"checklist",
	"booking",
	"itinerary",
	"research",
	"capture",
	"inbox",
	"travel",
	"work",
	"family",
	"health",
	"learning",
	"finance",
	"home",
	"career",
] as const;

export const DEFAULT_FRONTMATTER_RULES: NonNullable<
	ParaObsidianConfig["frontmatterRules"]
> = {
	project: {
		required: {
			title: { type: "string" },
			created: { type: "date" },
			type: { type: "enum", enum: ["project"] },
			status: {
				type: "enum",
				enum: ["active", "on-hold", "completed", "archived"],
			},
			start_date: { type: "date" },
			target_completion: { type: "date" },
			area: { type: "wikilink" },
			reviewed: { type: "date" },
			review_period: { type: "string" },
			tags: { type: "array", includes: ["project"] },
		},
	},
	area: {
		required: {
			title: { type: "string" },
			created: { type: "date" },
			type: { type: "enum", enum: ["area"] },
			status: { type: "enum", enum: ["active"] },
			reviewed: { type: "date" },
			review_period: { type: "string" },
			tags: { type: "array", includes: ["area"] },
		},
	},
	resource: {
		required: {
			title: { type: "string" },
			created: { type: "date" },
			type: { type: "enum", enum: ["resource"] },
			source: {
				type: "enum",
				enum: ["book", "article", "video", "course", "podcast", "paper", "web"],
			},
			areas: { type: "array" },
			reviewed: { type: "date" },
			tags: { type: "array", includes: ["resource"] },
		},
	},
	task: {
		required: {
			title: { type: "string" },
			created: { type: "date" },
			type: { type: "enum", enum: ["task"] },
			task_type: {
				type: "enum",
				enum: ["task", "reminder", "habit", "chore"],
			},
			status: {
				type: "enum",
				enum: ["not-started", "in-progress", "blocked", "done", "cancelled"],
			},
			priority: { type: "enum", enum: ["low", "medium", "high", "urgent"] },
			effort: { type: "enum", enum: ["small", "medium", "large"] },
			reviewed: { type: "date" },
			tags: { type: "array", includes: ["task"] },
		},
	},
	daily: {
		required: {
			title: { type: "string" },
			created: { type: "date" },
			type: { type: "enum", enum: ["daily"] },
			tags: { type: "array", includes: ["daily", "journal"] },
		},
	},
	"weekly-review": {
		required: {
			title: { type: "string" },
			created: { type: "date" },
			type: { type: "enum", enum: ["weekly-review"] },
			week: { type: "string" },
			tags: { type: "array", includes: ["review", "weekly"] },
		},
	},
	capture: {
		required: {
			title: { type: "string" },
			created: { type: "date" },
			type: { type: "enum", enum: ["capture"] },
			status: { type: "enum", enum: ["inbox"] },
			captured_from: { type: "string" },
			resonance: {
				type: "enum",
				enum: ["inspiring", "useful", "personal", "surprising"],
			},
			urgency: { type: "enum", enum: ["high", "medium", "low"] },
			tags: { type: "array", includes: ["inbox"] },
		},
	},
	checklist: {
		required: {
			title: { type: "string" },
			created: { type: "date" },
			type: { type: "enum", enum: ["checklist"] },
			checklist_type: { type: "string" },
			project: { type: "wikilink" },
			status: { type: "string" },
			tags: { type: "array", includes: ["checklist"] },
		},
	},
	booking: {
		required: {
			title: { type: "string" },
			created: { type: "date" },
			type: { type: "enum", enum: ["booking"] },
			booking_type: { type: "string" },
			status: { type: "string" },
			project: { type: "wikilink" },
			date: { type: "date" },
			cost: { type: "string" },
			currency: { type: "string" },
			payment_status: { type: "string" },
			tags: { type: "array", includes: ["booking"] },
		},
	},
	itinerary: {
		required: {
			title: { type: "string" },
			created: { type: "date" },
			type: { type: "enum", enum: ["itinerary"] },
			project: { type: "wikilink" },
			trip_date: { type: "date" },
			day_number: { type: "string" },
			energy_level: { type: "string" },
			tags: { type: "array", includes: ["itinerary"] },
		},
	},
	research: {
		required: {
			title: { type: "string" },
			created: { type: "date" },
			type: { type: "enum", enum: ["research"] },
			research_type: { type: "string" },
			project: { type: "wikilink" },
			status: { type: "string" },
			tags: { type: "array", includes: ["research"] },
		},
	},
};

export const DEFAULT_TEMPLATE_VERSIONS: Record<string, number> = {
	project: 2,
	area: 2,
	resource: 2,
	task: 2,
	daily: 2,
	"weekly-review": 2,
	capture: 2,
	checklist: 2,
	booking: 2,
	itinerary: 2,
	research: 2,
};
