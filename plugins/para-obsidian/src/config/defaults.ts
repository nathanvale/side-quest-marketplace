/**
 * Default configuration values.
 *
 * This module defines default values for:
 * - Frontmatter validation rules per note type
 * - Template version numbers
 *
 * These defaults are used when not overridden by user configuration.
 *
 * @module defaults
 */
import type { ParaObsidianConfig } from "./index";

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
		},
	},
	area: {
		required: {
			title: { type: "string" },
			created: { type: "date" },
			type: { type: "enum", enum: ["area"] },
			status: { type: "enum", enum: ["active", "inactive"] },
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
			energy_level: { type: "enum", enum: ["low", "medium", "high"] },
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
		},
	},
	session: {
		required: {
			title: { type: "string" },
			created: { type: "date" },
			type: { type: "enum", enum: ["session"] },
			session_date: { type: "date" },
			area: { type: "wikilink", optional: true },
			project: { type: "wikilink", optional: true },
			provider: { type: "string" },
			session_number: { type: "number", optional: true },
		},
		oneOfRequired: ["area", "project"],
	},
	invoice: {
		required: {
			title: { type: "string" },
			created: { type: "date" },
			type: { type: "enum", enum: ["invoice"] },
			invoice_date: { type: "date" },
			area: { type: "wikilink", optional: true },
			project: { type: "wikilink", optional: true },
			provider: { type: "string" },
			amount: { type: "number" },
			currency: {
				type: "enum",
				enum: ["AUD", "USD", "EUR", "GBP", "JPY", "NZD", "SGD"],
			},
			status: {
				type: "enum",
				enum: ["unpaid", "paid", "pending"],
			},
			due_date: { type: "date", optional: true },
			payment_date: { type: "date", optional: true },
			attachments: {
				type: "array",
				optional: true,
				description: "Wikilinks to invoice PDF in Attachments/ folder",
			},
		},
		oneOfRequired: ["area", "project"],
	},
	bookmark: {
		required: {
			type: { type: "enum", enum: ["bookmark"] },
			para: {
				type: "enum",
				enum: ["Projects", "Areas", "Resources", "Archives"],
				optional: true, // Optional for raw Web Clipper captures, added during classification
			},
			url: { type: "string", pattern: "^https?://" },
			title: { type: "string" },
			clipped: { type: "date" },
			template_version: { type: "number" },
			category: { type: "wikilink", optional: true },
			author: { type: "wikilink", optional: true },
			published: { type: "date", optional: true },
			tags: { type: "array", optional: true },
			notes: { type: "string", optional: true },
			enrichedAt: {
				type: "date",
				optional: true,
				description:
					"Timestamp when bookmark was enriched with metadata (ISO 8601). Presence indicates enrichment is complete.",
			},
		},
	},
	"medical-statement": {
		required: {
			title: { type: "string" },
			created: { type: "date" },
			type: { type: "enum", enum: ["medical-statement"] },
			statement_type: {
				type: "enum",
				enum: ["summary", "detailed", "single-appointment"],
				optional: true,
			},
			provider: { type: "string" },
			practitioner: { type: "string", optional: true },
			patient: { type: "string" },
			statement_date: { type: "date" },
			period_start: { type: "date", optional: true },
			period_end: { type: "date", optional: true },
			previous_balance: { type: "number", optional: true },
			total_invoiced: { type: "number", optional: true },
			total_payments: { type: "number", optional: true },
			statement_balance: { type: "number" },
			status: {
				type: "enum",
				enum: ["paid", "unpaid", "pending"],
			},
			area: { type: "wikilink" },
			attachments: {
				type: "array",
				optional: true,
				description: "Wikilinks to statement PDF in Attachments/ folder",
			},
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
	session: 1,
	invoice: 1,
	bookmark: 1,
	"medical-statement": 1,
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
	session: "00 Inbox",
	invoice: "00 Inbox",
	bookmark: "00 Inbox",
	"medical-statement": "00 Inbox",
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
 * - Projects get 🎯 prefix (has a target/goal)
 * - Areas get 🌱 prefix (cultivated over time)
 * - Specific types (research, booking, trip) get prefixes
 * - Resources follow Forte's style (no prefix)
 * - Tasks don't need prefixes (action-oriented by nature)
 * - Captures are temporary inbox items (no prefix)
 */
export const DEFAULT_TITLE_PREFIXES: Partial<Record<string, string>> = {
	project: "🎯 ",
	area: "🌱 ",
	research: "📊 ",
	booking: "🎫 ",
	trip: "✈️ ",
	itinerary: "🗓️ ",
	checklist: "✅ ",
	session: "🧠 ",
	invoice: "🧾 ",
	bookmark: "✂️ ",
	"medical-statement": "🏥 ",
	"employment-contract": "📄 ",
	document: "📄 ",
	letter: "📄 ",
	cv: "📄 ",
};
