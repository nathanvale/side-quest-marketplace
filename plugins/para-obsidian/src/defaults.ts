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
	"trip",
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
			completion_date: { type: "date", optional: true },
			area: { type: "wikilink" },
			depends_on: { type: "array", optional: true },
			blocks: { type: "array", optional: true },
			attachments: {
				type: "array",
				optional: true,
				description: "Wikilinks to files in flat Attachments/ folder",
			},
			tags: { type: "array", includes: ["project"] },
		},
	},
	area: {
		required: {
			title: { type: "string" },
			created: { type: "date" },
			type: { type: "enum", enum: ["area"] },
			status: { type: "enum", enum: ["active", "inactive"] },
			tags: { type: "array", includes: ["area"] },
		},
	},
	resource: {
		required: {
			title: { type: "string" },
			created: { type: "date" },
			type: { type: "enum", enum: ["resource"] },
			source_type: {
				type: "enum",
				enum: ["book", "article", "video", "course", "podcast", "paper", "web"],
			},
			source_url: { type: "string", optional: true },
			author: { type: "string", optional: true },
			status: {
				type: "enum",
				enum: ["to-read", "reading", "completed"],
				optional: true,
			},
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
			due_date: { type: "date", optional: true },
			priority: { type: "enum", enum: ["low", "medium", "high", "urgent"] },
			effort: { type: "enum", enum: ["small", "medium", "large"] },
			project: { type: "wikilink", optional: true },
			area: { type: "wikilink", optional: true },
			depends_on: { type: "array", optional: true },
			blocks: { type: "array", optional: true },
			tags: { type: "array", includes: ["task"] },
		},
	},
	daily: {
		required: {
			title: { type: "string" },
			created: { type: "date" },
			type: { type: "enum", enum: ["daily"] },
			week: { type: "string" },
			energy_level: {
				type: "enum",
				enum: ["low", "medium", "high"],
				optional: true,
			},
			mood: { type: "string", optional: true },
			focus: { type: "string", optional: true },
			tags: { type: "array", includes: ["daily", "journal"] },
		},
	},
	"weekly-review": {
		required: {
			title: { type: "string" },
			created: { type: "date" },
			type: { type: "enum", enum: ["weekly-review"] },
			week: { type: "string" },
			week_start: { type: "date", optional: true },
			focus_areas: { type: "string", optional: true },
			tags: { type: "array", includes: ["review", "weekly"] },
		},
	},
	capture: {
		required: {
			title: { type: "string" },
			created: { type: "date" },
			type: { type: "enum", enum: ["capture"] },
			status: { type: "enum", enum: ["inbox"] },
			source: {
				type: "enum",
				enum: ["thought", "article", "conversation", "meeting", "email"],
			},
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
			checklist_type: {
				type: "enum",
				enum: ["packing", "groceries", "shopping", "prep", "tasks"],
			},
			project: { type: "wikilink" },
			status: { type: "enum", enum: ["draft", "in-progress", "complete"] },
			tags: { type: "array", includes: ["checklist"] },
		},
		forbidden: ["area"],
	},
	booking: {
		required: {
			title: { type: "string" },
			created: { type: "date" },
			type: { type: "enum", enum: ["booking"] },
			booking_type: {
				type: "enum",
				enum: ["accommodation", "flight", "activity", "transport", "dining"],
			},
			status: {
				type: "enum",
				enum: ["pending", "confirmed", "cancelled"],
			},
			project: { type: "wikilink", optional: true },
			booking_ref: { type: "string", optional: true },
			provider: { type: "string", optional: true },
			date: { type: "date" },
			time: { type: "string", optional: true },
			end_date: { type: "date", optional: true },
			cost: { type: "number" },
			currency: {
				type: "enum",
				enum: ["AUD", "USD", "EUR", "GBP", "JPY", "NZD", "SGD"],
			},
			payment_status: {
				type: "enum",
				enum: ["pending", "partial", "paid", "refunded", "cancelled"],
			},
			cancellation_deadline: { type: "date", optional: true },
			contact_phone: { type: "string", optional: true },
			contact_email: { type: "string", optional: true },
			contact_url: { type: "string", optional: true },
			attachments: {
				type: "array",
				optional: true,
				description: "Wikilinks to files in flat Attachments/ folder",
			},
			tags: { type: "array", includes: ["booking"] },
		},
		forbidden: ["area"],
	},
	itinerary: {
		required: {
			title: { type: "string" },
			created: { type: "date" },
			type: { type: "enum", enum: ["itinerary"] },
			project: { type: "wikilink" },
			trip_date: { type: "date" },
			day_number: { type: "string" },
			location: { type: "string", optional: true },
			accommodation: { type: "wikilink", optional: true },
			energy_level: { type: "enum", enum: ["low", "medium", "high"] },
			tags: { type: "array", includes: ["itinerary"] },
		},
		forbidden: ["area"],
	},
	research: {
		required: {
			title: { type: "string" },
			created: { type: "date" },
			type: { type: "enum", enum: ["research"] },
			project: { type: "wikilink" },
			status: {
				type: "enum",
				enum: ["researching", "decided", "superseded"],
			},
			tags: { type: "array", includes: ["research"] },
		},
		forbidden: ["area"],
	},
	trip: {
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
			completion_date: { type: "date", optional: true },
			area: { type: "wikilink" },
			depends_on: { type: "array", optional: true },
			blocks: { type: "array", optional: true },
			tags: { type: "array", includes: ["project", "trip"] },
		},
	},
};

export const DEFAULT_TEMPLATE_VERSIONS: Record<string, number> = {
	project: 4,
	trip: 3,
	area: 3,
	resource: 3,
	task: 4,
	daily: 3,
	"weekly-review": 3,
	capture: 3,
	checklist: 3,
	booking: 3,
	itinerary: 3,
	"itinerary-day": 3,
	research: 3,
};

/**
 * Default destination directories for each template type.
 * These map to the PARA folder structure.
 */
export const DEFAULT_DESTINATIONS: Record<string, string> = {
	// Following PARA method: ALL notes go to inbox by default for organizing later
	// Only explicit --dest flag should override this rule
	project: "00 Inbox",
	trip: "00 Inbox",
	area: "00 Inbox",
	resource: "00 Inbox",
	task: "00 Inbox",
	daily: "00 Inbox",
	"weekly-review": "00 Inbox",
	capture: "00 Inbox",
	booking: "00 Inbox",
	checklist: "00 Inbox",
	itinerary: "00 Inbox",
	"itinerary-day": "00 Inbox",
	research: "00 Inbox",
	// Attachments folder (for git operations, not template destination)
	attachments: "Attachments",
};

/**
 * Default available LLM models for AI-powered features.
 * Includes Claude models (via headless) and Ollama models (via HTTP API).
 */
export const DEFAULT_AVAILABLE_MODELS = [
	"sonnet",
	"haiku",
	"qwen:7b",
	"qwen:14b",
	"qwen2.5:14b",
	"qwen-coder:17b",
	"qwen-coder:14b",
] as const;

/**
 * Default LLM model for AI-powered operations.
 * Claude Haiku is fast, cheap, and reliable for JSON extraction.
 */
export const DEFAULT_MODEL = "haiku";

/**
 * Default PARA folder mappings for semantic search shortcuts.
 * Maps short names to actual vault folder names.
 *
 * Usage:
 *   para-obsidian semantic "query" --para projects
 *   para-obsidian semantic "query" --para projects,areas
 */
export const DEFAULT_PARA_FOLDERS: Record<string, string> = {
	inbox: "00 Inbox",
	projects: "01 Projects",
	areas: "02 Areas",
	resources: "03 Resources",
	archives: "04 Archives",
};

/**
 * Default PARA folders to search when --para flag is not specified.
 * Includes all PARA folders: inbox, projects, areas, resources, archives.
 */
export const DEFAULT_PARA_SEARCH_FOLDERS = [
	"inbox",
	"projects",
	"areas",
	"resources",
	"archives",
] as const;

/**
 * Default title prefixes for specific template types.
 * Following Tiago Forte's PARA naming conventions with adaptations for specific note types.
 *
 * Prefixes are applied automatically during note creation to improve:
 * - Scanning and filtering in file lists
 * - Visual grouping of related notes
 * - Clarity about note purpose
 *
 * Convention:
 * - Specific types (research, booking, trip) get prefixes
 * - PARA core (project, area, resource) follow Forte's style (emoji/capitalized/lowercase)
 * - Tasks don't need prefixes (action-oriented by nature)
 * - Captures are temporary inbox items (no prefix)
 */
export const DEFAULT_TITLE_PREFIXES: Partial<Record<string, string>> = {
	research: "📊 ",
	booking: "🎫 ",
	trip: "✈️ ",
	itinerary: "🗓️ ",
	checklist: "✅ ",
};
