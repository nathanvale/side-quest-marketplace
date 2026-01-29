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
			created: { type: "date" },
			type: { type: "enum", enum: ["area"] },
			status: { type: "enum", enum: ["active", "inactive"] },
		},
	},
	resource: {
		required: {
			created: { type: "date" },
			type: { type: "enum", enum: ["resource"] },
			resource_type: {
				type: "enum",
				enum: [
					"meeting",
					"tutorial",
					"reference",
					"issue",
					"conversation",
					"idea",
					"recipe",
					"how-to",
					"decision",
					"research",
					"article",
				],
				description:
					"Classification for Dataview queries (e.g., show all meetings)",
			},
			source: {
				type: "string",
				optional: true,
				description:
					"Link to origin - URL or [[note link]] (e.g., voice memo, clipping)",
			},
			summary: {
				type: "string",
				optional: true,
				description: "Brief summary of the resource content",
			},
			// PARA connections (multi-select arrays)
			areas: {
				type: "array",
				optional: true,
				description: "Wikilinks to related areas (multi-select)",
			},
			projects: {
				type: "array",
				optional: true,
				description: "Wikilinks to related projects (multi-select)",
			},
			source_format: {
				type: "enum",
				enum: [
					"article",
					"video",
					"audio",
					"document",
					"thread",
					"image",
					"book",
					"course",
					"podcast",
					"paper",
				],
				optional: true,
				description: "Format of the source material",
			},
			distilled: {
				type: "boolean",
				optional: true,
				description:
					"Whether the resource has been fully distilled through progressive summarization",
			},
		},
	},
	task: {
		required: {
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
			created: { type: "date" },
			type: { type: "enum", enum: ["weekly-review"] },
			week: { type: "string" },
			week_start: { type: "date", optional: true },
			focus_areas: { type: "string", optional: true },
		},
	},
	capture: {
		required: {
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
			areas: { type: "array", optional: true },
			projects: { type: "array", optional: true },
		},
	},
	checklist: {
		required: {
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
			created: { type: "date" },
			type: { type: "enum", enum: ["trip"] },
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
			clipped: { type: "date" },
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
	meeting: {
		required: {
			created: { type: "date" },
			type: { type: "enum", enum: ["meeting"] },
			meeting_type: {
				type: "enum",
				enum: [
					"1-on-1",
					"standup",
					"planning",
					"retro",
					"review",
					"interview",
					"stakeholder",
					"general",
				],
			},
			meeting_date: { type: "date" },
			attendees: {
				type: "array",
				optional: true,
				description: "List of meeting attendees",
			},
			area: { type: "wikilink", optional: true },
			project: { type: "wikilink", optional: true },
			company: { type: "string", optional: true },
			summary: { type: "string", optional: true },
			transcription: { type: "wikilink", optional: true },
		},
		oneOfRequired: ["area", "project"],
	},
	"medical-statement": {
		required: {
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

	// === CLIPPING TEMPLATES ===
	"clipping-article": {
		required: {
			type: { type: "enum", enum: ["clipping"] },
			clipping_type: { type: "enum", enum: ["article"] },
			source: { type: "string" },
			clipped: { type: "date" },
			author: { type: "string", optional: true },
			site_name: { type: "string", optional: true },
			published: { type: "date", optional: true },
			modified: { type: "date", optional: true },
			section: { type: "string", optional: true },
			word_count: { type: "number", optional: true },
			distill_status: {
				type: "enum",
				enum: ["raw", "in-progress", "distilled"],
				optional: true,
			},
			related: { type: "array", optional: true },
			project: { type: "array", optional: true },
			area: { type: "array", optional: true },
		},
	},
	"clipping-youtube": {
		required: {
			type: { type: "enum", enum: ["clipping"] },
			clipping_type: { type: "enum", enum: ["youtube"] },
			source: { type: "string" },
			clipped: { type: "date" },
			video_id: { type: "string", optional: true },
			channel: { type: "string", optional: true },
			published: { type: "date", optional: true },
			duration: { type: "string", optional: true },
			consumption_status: {
				type: "enum",
				enum: ["to-watch", "watching", "watched"],
				optional: true,
			},
			transcript_status: {
				type: "enum",
				enum: ["pending", "available", "unavailable"],
				optional: true,
			},
			distill_status: {
				type: "enum",
				enum: ["raw", "in-progress", "distilled"],
				optional: true,
			},
			related: { type: "array", optional: true },
			project: { type: "array", optional: true },
			area: { type: "array", optional: true },
		},
	},
	"clipping-book": {
		required: {
			type: { type: "enum", enum: ["clipping"] },
			clipping_type: { type: "enum", enum: ["book"] },
			source: { type: "string" },
			clipped: { type: "date" },
			author: { type: "string", optional: true },
			rating: { type: "number", optional: true },
			pages: { type: "number", optional: true },
			published: { type: "date", optional: true },
			consumption_status: {
				type: "enum",
				enum: ["to-read", "reading", "read"],
				optional: true,
			},
			distill_status: {
				type: "enum",
				enum: ["raw", "in-progress", "distilled"],
				optional: true,
			},
			related: { type: "array", optional: true },
			project: { type: "array", optional: true },
			area: { type: "array", optional: true },
		},
	},
	"clipping-recipe": {
		required: {
			type: { type: "enum", enum: ["clipping"] },
			clipping_type: { type: "enum", enum: ["recipe"] },
			source: { type: "string" },
			clipped: { type: "date" },
			author: { type: "string", optional: true },
			prep_time: { type: "string", optional: true },
			cook_time: { type: "string", optional: true },
			total_time: { type: "string", optional: true },
			servings: { type: "string", optional: true },
			distill_status: {
				type: "enum",
				enum: ["raw", "in-progress", "distilled"],
				optional: true,
			},
			related: { type: "array", optional: true },
			project: { type: "array", optional: true },
			area: { type: "array", optional: true },
		},
	},
	"clipping-restaurant": {
		required: {
			type: { type: "enum", enum: ["clipping"] },
			clipping_type: { type: "enum", enum: ["restaurant"] },
			source: { type: "string" },
			clipped: { type: "date" },
			name: { type: "string", optional: true },
			cuisine: { type: "string", optional: true },
			price_range: { type: "string", optional: true },
			address: { type: "string", optional: true },
			suburb: { type: "string", optional: true },
			distill_status: {
				type: "enum",
				enum: ["raw", "in-progress", "distilled"],
				optional: true,
			},
			related: { type: "array", optional: true },
			project: { type: "array", optional: true },
			area: { type: "array", optional: true },
		},
	},
	"clipping-accommodation": {
		required: {
			type: { type: "enum", enum: ["clipping"] },
			clipping_type: { type: "enum", enum: ["accommodation"] },
			source: { type: "string" },
			clipped: { type: "date" },
			platform: { type: "string", optional: true },
			property_type: { type: "string", optional: true },
			price: { type: "string", optional: true },
			currency: {
				type: "enum",
				enum: ["AUD", "USD", "EUR", "GBP"],
				optional: true,
			},
			address: { type: "string", optional: true },
			suburb: { type: "string", optional: true },
			distill_status: {
				type: "enum",
				enum: ["raw", "in-progress", "distilled"],
				optional: true,
			},
			related: { type: "array", optional: true },
			project: { type: "array", optional: true },
			area: { type: "array", optional: true },
		},
	},
	"clipping-place": {
		required: {
			type: { type: "enum", enum: ["clipping"] },
			clipping_type: { type: "enum", enum: ["place"] },
			source: { type: "string" },
			clipped: { type: "date" },
			name: { type: "string", optional: true },
			address: { type: "string", optional: true },
			suburb: { type: "string", optional: true },
			category: { type: "string", optional: true },
			distill_status: {
				type: "enum",
				enum: ["raw", "in-progress", "distilled"],
				optional: true,
			},
			related: { type: "array", optional: true },
			project: { type: "array", optional: true },
			area: { type: "array", optional: true },
		},
	},
	"clipping-github-repo": {
		required: {
			type: { type: "enum", enum: ["clipping"] },
			clipping_type: { type: "enum", enum: ["github-repo"] },
			source: { type: "string" },
			clipped: { type: "date" },
			owner: { type: "string", optional: true },
			language: { type: "string", optional: true },
			stars: { type: "number", optional: true },
			updated: { type: "date", optional: true },
			distill_status: {
				type: "enum",
				enum: ["raw", "in-progress", "distilled"],
				optional: true,
			},
			related: { type: "array", optional: true },
			project: { type: "array", optional: true },
			area: { type: "array", optional: true },
		},
	},
	"clipping-podcast-episode": {
		required: {
			type: { type: "enum", enum: ["clipping"] },
			clipping_type: { type: "enum", enum: ["podcast-episode"] },
			source: { type: "string" },
			clipped: { type: "date" },
			platform: { type: "string", optional: true },
			show: { type: "string", optional: true },
			host: { type: "string", optional: true },
			published: { type: "date", optional: true },
			consumption_status: {
				type: "enum",
				enum: ["to-listen", "listening", "listened"],
				optional: true,
			},
			distill_status: {
				type: "enum",
				enum: ["raw", "in-progress", "distilled"],
				optional: true,
			},
			related: { type: "array", optional: true },
			project: { type: "array", optional: true },
			area: { type: "array", optional: true },
		},
	},
	"clipping-movie": {
		required: {
			type: { type: "enum", enum: ["clipping"] },
			clipping_type: { type: "enum", enum: ["movie"] },
			source: { type: "string" },
			clipped: { type: "date" },
			year: { type: "string", optional: true },
			director: { type: "string", optional: true },
			rating: { type: "number", optional: true },
			consumption_status: {
				type: "enum",
				enum: ["to-watch", "watching", "watched"],
				optional: true,
			},
			distill_status: {
				type: "enum",
				enum: ["raw", "in-progress", "distilled"],
				optional: true,
			},
			related: { type: "array", optional: true },
			project: { type: "array", optional: true },
			area: { type: "array", optional: true },
		},
	},
	"clipping-event": {
		required: {
			type: { type: "enum", enum: ["clipping"] },
			clipping_type: { type: "enum", enum: ["event"] },
			source: { type: "string" },
			clipped: { type: "date" },
			event_date: { type: "string", optional: true },
			venue: { type: "string", optional: true },
			address: { type: "string", optional: true },
			city: { type: "string", optional: true },
			price: { type: "string", optional: true },
			distill_status: {
				type: "enum",
				enum: ["raw", "in-progress", "distilled"],
				optional: true,
			},
			related: { type: "array", optional: true },
			project: { type: "array", optional: true },
			area: { type: "array", optional: true },
		},
	},
	"clipping-documentation": {
		required: {
			type: { type: "enum", enum: ["clipping"] },
			clipping_type: { type: "enum", enum: ["documentation"] },
			source: { type: "string" },
			clipped: { type: "date" },
			domain: { type: "string", optional: true },
			technology: { type: "string", optional: true },
			section: { type: "string", optional: true },
			distill_status: {
				type: "enum",
				enum: ["raw", "in-progress", "distilled"],
				optional: true,
			},
			related: { type: "array", optional: true },
			project: { type: "array", optional: true },
			area: { type: "array", optional: true },
		},
	},
	"clipping-highlight-only": {
		required: {
			type: { type: "enum", enum: ["clipping"] },
			clipping_type: { type: "enum", enum: ["highlight-only"] },
			source: { type: "string" },
			clipped: { type: "date" },
			source_title: { type: "string", optional: true },
			distill_status: {
				type: "enum",
				enum: ["raw", "in-progress", "distilled"],
				optional: true,
			},
			related: { type: "array", optional: true },
			project: { type: "array", optional: true },
			area: { type: "array", optional: true },
		},
	},
	"clipping-job-posting": {
		required: {
			type: { type: "enum", enum: ["clipping"] },
			clipping_type: { type: "enum", enum: ["job-posting"] },
			source: { type: "string" },
			clipped: { type: "date" },
			platform: { type: "string", optional: true },
			company: { type: "string", optional: true },
			job_title: { type: "string", optional: true },
			location: { type: "string", optional: true },
			posted: { type: "date", optional: true },
			distill_status: {
				type: "enum",
				enum: ["raw", "in-progress", "distilled"],
				optional: true,
			},
			related: { type: "array", optional: true },
			project: { type: "array", optional: true },
			area: { type: "array", optional: true },
		},
	},
	"clipping-product": {
		required: {
			type: { type: "enum", enum: ["clipping"] },
			clipping_type: { type: "enum", enum: ["product---gift-idea"] },
			source: { type: "string" },
			clipped: { type: "date" },
			platform: { type: "string", optional: true },
			price: { type: "string", optional: true },
			currency: { type: "string", optional: true },
			brand: { type: "string", optional: true },
			rating: { type: "number", optional: true },
			distill_status: {
				type: "enum",
				enum: ["raw", "in-progress", "distilled"],
				optional: true,
			},
			related: { type: "array", optional: true },
			project: { type: "array", optional: true },
			area: { type: "array", optional: true },
		},
	},
	"clipping-reddit-post": {
		required: {
			type: { type: "enum", enum: ["clipping"] },
			clipping_type: { type: "enum", enum: ["reddit-post"] },
			source: { type: "string" },
			clipped: { type: "date" },
			subreddit: { type: "string", optional: true },
			author: { type: "string", optional: true },
			posted: { type: "date", optional: true },
			distill_status: {
				type: "enum",
				enum: ["raw", "in-progress", "distilled"],
				optional: true,
			},
			related: { type: "array", optional: true },
			project: { type: "array", optional: true },
			area: { type: "array", optional: true },
		},
	},
	"clipping-stack-overflow": {
		required: {
			type: { type: "enum", enum: ["clipping"] },
			clipping_type: { type: "enum", enum: ["stack-overflow"] },
			source: { type: "string" },
			clipped: { type: "date" },
			tags: { type: "array", optional: true },
			distill_status: {
				type: "enum",
				enum: ["raw", "in-progress", "distilled"],
				optional: true,
			},
			related: { type: "array", optional: true },
			project: { type: "array", optional: true },
			area: { type: "array", optional: true },
		},
	},
	"clipping-tweet": {
		required: {
			type: { type: "enum", enum: ["clipping"] },
			clipping_type: { type: "enum", enum: ["tweet---x-post"] },
			source: { type: "string" },
			clipped: { type: "date" },
			author: { type: "string", optional: true },
			handle: { type: "string", optional: true },
			posted: { type: "date", optional: true },
			distill_status: {
				type: "enum",
				enum: ["raw", "in-progress", "distilled"],
				optional: true,
			},
			related: { type: "array", optional: true },
			project: { type: "array", optional: true },
			area: { type: "array", optional: true },
		},
	},
	"clipping-wikipedia": {
		required: {
			type: { type: "enum", enum: ["clipping"] },
			clipping_type: { type: "enum", enum: ["wikipedia"] },
			source: { type: "string" },
			clipped: { type: "date" },
			category: { type: "string", optional: true },
			language: { type: "string", optional: true },
			modified: { type: "date", optional: true },
			distill_status: {
				type: "enum",
				enum: ["raw", "in-progress", "distilled"],
				optional: true,
			},
			related: { type: "array", optional: true },
			project: { type: "array", optional: true },
			area: { type: "array", optional: true },
		},
	},
	"clipping-chatgpt": {
		required: {
			type: { type: "enum", enum: ["clipping"] },
			clipping_type: { type: "enum", enum: ["chatgpt-conversation"] },
			source: { type: "string" },
			clipped: { type: "date" },
			ai_model: { type: "string", optional: true },
			distill_status: {
				type: "enum",
				enum: ["raw", "in-progress", "distilled"],
				optional: true,
			},
			related: { type: "array", optional: true },
			project: { type: "array", optional: true },
			area: { type: "array", optional: true },
		},
	},
	"clipping-claude": {
		required: {
			type: { type: "enum", enum: ["clipping"] },
			clipping_type: { type: "enum", enum: ["claude-conversation"] },
			source: { type: "string" },
			clipped: { type: "date" },
			ai_model: { type: "string", optional: true },
			distill_status: {
				type: "enum",
				enum: ["raw", "in-progress", "distilled"],
				optional: true,
			},
			related: { type: "array", optional: true },
			project: { type: "array", optional: true },
			area: { type: "array", optional: true },
		},
	},
	"clipping-course": {
		required: {
			type: { type: "enum", enum: ["clipping"] },
			clipping_type: { type: "enum", enum: ["course---tutorial"] },
			source: { type: "string" },
			clipped: { type: "date" },
			platform: { type: "string", optional: true },
			instructor: { type: "string", optional: true },
			price: { type: "string", optional: true },
			rating: { type: "number", optional: true },
			consumption_status: {
				type: "enum",
				enum: ["to-learn", "learning", "learned"],
				optional: true,
			},
			distill_status: {
				type: "enum",
				enum: ["raw", "in-progress", "distilled"],
				optional: true,
			},
			related: { type: "array", optional: true },
			project: { type: "array", optional: true },
			area: { type: "array", optional: true },
		},
	},
	"clipping-app": {
		required: {
			type: { type: "enum", enum: ["clipping"] },
			clipping_type: { type: "enum", enum: ["app---software"] },
			source: { type: "string" },
			clipped: { type: "date" },
			developer: { type: "string", optional: true },
			price: { type: "string", optional: true },
			rating: { type: "number", optional: true },
			category: { type: "string", optional: true },
			platform: { type: "string", optional: true },
			distill_status: {
				type: "enum",
				enum: ["raw", "in-progress", "distilled"],
				optional: true,
			},
			related: { type: "array", optional: true },
			project: { type: "array", optional: true },
			area: { type: "array", optional: true },
		},
	},

	// === PROCESSOR TEMPLATES ===
	"processor-article": {
		required: {
			type: { type: "enum", enum: ["clipping"] },
			clipping_type: { type: "enum", enum: ["article"] },
			source: { type: "string" },
			clipped: { type: "date" },
			author: { type: "string", optional: true },
			status: { type: "enum", enum: ["to-read", "read"], optional: true },
			summary: { type: "string", optional: true },
			project: { type: "array", optional: true },
			area: { type: "array", optional: true },
		},
	},
	"processor-youtube": {
		required: {
			type: { type: "enum", enum: ["clipping"] },
			clipping_type: { type: "enum", enum: ["youtube"] },
			source: { type: "string" },
			clipped: { type: "date" },
			author: { type: "string", optional: true },
			status: {
				type: "enum",
				enum: ["to-watch", "watched"],
				optional: true,
			},
			summary: { type: "string", optional: true },
			project: { type: "array", optional: true },
			area: { type: "array", optional: true },
		},
	},
	"processor-recipe": {
		required: {
			type: { type: "enum", enum: ["clipping"] },
			clipping_type: { type: "enum", enum: ["recipe"] },
			source: { type: "string" },
			clipped: { type: "date" },
			author: { type: "string", optional: true },
			status: { type: "enum", enum: ["to-cook", "cooked"], optional: true },
			summary: { type: "string", optional: true },
			project: { type: "array", optional: true },
			area: { type: "array", optional: true },
		},
	},
	"processor-restaurant": {
		required: {
			type: { type: "enum", enum: ["clipping"] },
			clipping_type: { type: "enum", enum: ["restaurant"] },
			source: { type: "string" },
			clipped: { type: "date" },
			summary: { type: "string", optional: true },
			name: { type: "string", optional: true },
			cuisine: { type: "string", optional: true },
			suburb: { type: "string", optional: true },
			project: { type: "array", optional: true },
			area: { type: "array", optional: true },
		},
	},
	"processor-accommodation": {
		required: {
			type: { type: "enum", enum: ["clipping"] },
			clipping_type: { type: "enum", enum: ["accommodation"] },
			source: { type: "string" },
			clipped: { type: "date" },
			platform: { type: "string", optional: true },
			status: {
				type: "enum",
				enum: ["to-review", "reviewed"],
				optional: true,
			},
			summary: { type: "string", optional: true },
			project: { type: "array", optional: true },
			area: { type: "array", optional: true },
		},
	},
	"processor-place": {
		required: {
			type: { type: "enum", enum: ["clipping"] },
			clipping_type: { type: "enum", enum: ["place"] },
			source: { type: "string" },
			clipped: { type: "date" },
			platform: { type: "string", optional: true },
			status: {
				type: "enum",
				enum: ["to-review", "reviewed"],
				optional: true,
			},
			summary: { type: "string", optional: true },
			project: { type: "array", optional: true },
			area: { type: "array", optional: true },
		},
	},
	"processor-github": {
		required: {
			type: { type: "enum", enum: ["clipping"] },
			clipping_type: { type: "enum", enum: ["github"] },
			source: { type: "string" },
			clipped: { type: "date" },
			summary: { type: "string", optional: true },
			github_username: { type: "string", optional: true },
			project: { type: "array", optional: true },
			area: { type: "array", optional: true },
		},
	},
	"processor-social": {
		required: {
			type: { type: "enum", enum: ["clipping"] },
			clipping_type: { type: "enum", enum: ["social"] },
			source: { type: "string" },
			clipped: { type: "date" },
			platform: { type: "string", optional: true },
			status: {
				type: "enum",
				enum: ["to-review", "reviewed"],
				optional: true,
			},
			summary: { type: "string", optional: true },
			project: { type: "array", optional: true },
			area: { type: "array", optional: true },
		},
	},
	"processor-generic": {
		required: {
			type: { type: "enum", enum: ["clipping"] },
			clipping_type: { type: "enum", enum: ["generic"] },
			source: { type: "string" },
			clipped: { type: "date" },
			author: { type: "string", optional: true },
			status: {
				type: "enum",
				enum: ["unprocessed", "processed"],
				optional: true,
			},
			summary: { type: "string", optional: true },
			project: { type: "array", optional: true },
			area: { type: "array", optional: true },
		},
	},
};

/**
 * Section definition for template body structure.
 *
 * Used to define the markdown headings that appear in each template's body.
 * Future: enables generating template `.md` files from `defaults.ts`.
 */
export interface TemplateSection {
	/** Heading text (without `##` prefix). */
	readonly heading: string;
	/** Whether this section includes a prompt/placeholder for content. */
	readonly hasPrompt: boolean;
	/** Prompt text to show user (if hasPrompt is true). */
	readonly promptText?: string;
	/** Raw markdown content to emit after the heading (e.g., Dataview queries, inline field tables, callouts). */
	readonly content?: string;
	/** HTML comment rendered below the heading as guidance (e.g., "Key points in 2-3 sentences"). */
	readonly comment?: string;
}

/**
 * Default body sections per template type.
 *
 * Defines the markdown heading structure for templates that have body sections.
 * Templates not listed here are frontmatter-only (e.g., booking, invoice).
 */
export const DEFAULT_TEMPLATE_SECTIONS: Partial<
	Record<string, TemplateSection[]>
> = {
	// === PARA TEMPLATES ===
	project: [
		{
			heading: "Project Overview",
			hasPrompt: false,
			content:
				"| Field | Value |\n| --- | --- |\n| **Status** | `= this.status` |\n| **Start Date** | `= this.start_date` |\n| **Target** | `= this.target_completion` |\n| **Area** | `= this.area` |\n| **Depends On** | `= this.depends_on` |\n| **Blocks** | `= this.blocks` |",
		},
		{ heading: "Why This Matters", hasPrompt: false },
		{ heading: "Tasks", hasPrompt: false, content: "- [ ]" },
		{
			heading: "Meetings",
			hasPrompt: false,
			content:
				'```dataview\nTABLE summary as "Summary", meeting_date as "Date"\nWHERE type = "meeting" AND contains(project, this.file.link)\nSORT meeting_date DESC\n```',
		},
		{
			heading: "Key Resources",
			hasPrompt: false,
			content:
				'```dataview\nTABLE\n  clipping_type as "Type",\n  summary as "Summary",\n  clipped as "Clipped"\nWHERE type = "clipping" AND (contains(project, this.file.link) OR contains(projects, this.file.link))\nSORT clipped DESC\n```',
		},
		{ heading: "Stakeholders", hasPrompt: false },
		{ heading: "Risks & Blockers", hasPrompt: false },
		{ heading: "Notes", hasPrompt: false },
	],
	area: [
		{
			heading: "Overview",
			hasPrompt: false,
			content:
				"| Field | Value |\n|---|---|\n| **Status** | `= this.status` |\n| **Created** | `= this.created` |",
		},
		{ heading: "Description", hasPrompt: false },
		{
			heading: "Standards to Maintain",
			hasPrompt: false,
			content: "- [ ]\n- [ ]\n- [ ]",
		},
		{
			heading: "Current Projects",
			hasPrompt: false,
			content:
				'```dataview\nTABLE status as "Status", target_completion as "Due Date"\nFROM "01 Projects"\nWHERE type = "project" AND (contains(area, this.file.link) OR contains(areas, this.file.link)) AND status != "completed"\nSORT target_completion ASC\n```',
		},
		{ heading: "Tasks", hasPrompt: false, content: "- [ ]" },
		{
			heading: "Key Metrics",
			hasPrompt: false,
			content: "| Metric | Target | Current |\n|---|---|---|\n| | | |",
		},
		{
			heading: "Related Resources",
			hasPrompt: false,
			content:
				'```dataview\nTABLE source_type as "Type", author as "Author", rating as "Rating"\nFROM "03 Resources"\nWHERE contains(area, this.file.link) OR contains(areas, this.file.link)\nSORT rating DESC\n```',
		},
		{
			heading: "Routines & Habits",
			hasPrompt: false,
			content: "- **Daily**:\n- **Weekly**:\n- **Monthly**:",
		},
		{
			heading: "Review Questions",
			hasPrompt: false,
			content:
				"- Am I giving this area enough attention?\n- What's working well?\n- What's one thing I could improve?\n- Are there any projects that should emerge from this area?",
		},
		{ heading: "Notes", hasPrompt: false },
	],
	resource: [
		{
			heading: "Summary",
			hasPrompt: false,
			content: "`= this.summary`",
			comment: "Key points in 2-3 sentences. What is the core message?",
		},
		{
			heading: "Key Insights",
			hasPrompt: false,
			comment: "The most valuable ideas from this resource",
		},
		{ heading: "Progressive Summary", hasPrompt: false },
		{
			heading: "Layer 1: Captured Notes",
			hasPrompt: false,
			comment: "Raw notes and highlights",
		},
		{
			heading: "Layer 2: Bold Passages",
			hasPrompt: false,
			comment: "Bold the most important 10-20%",
		},
		{
			heading: "Layer 3: Highlighted Core",
			hasPrompt: false,
			comment: "Highlight the top 10% of bold passages",
		},
		{
			heading: "Layer 4: Executive Summary",
			hasPrompt: false,
			content: "1.\n2.\n3.",
			comment: "Your own words: the essence in 1-2 paragraphs",
		},
		{
			heading: "Connections",
			hasPrompt: false,
			content:
				"**Related Notes:**\n-\n\n**Projects:**\n`= this.projects`\n\n**Areas:**\n`= this.areas`",
			comment: "How does this relate to your existing knowledge?",
		},
		{
			heading: "Action Items",
			hasPrompt: false,
			content: "- [ ]",
			comment: "What will you DO with this knowledge?",
		},
	],
	meeting: [
		{ heading: "Attendees", hasPrompt: false, content: "`= this.attendees`" },
		{ heading: "Agenda / Questions", hasPrompt: false },
		{ heading: "Notes", hasPrompt: false },
		{ heading: "Decisions Made", hasPrompt: false },
		{
			heading: "Action Items",
			hasPrompt: false,
			content: "- [ ] @person - Task description (due: YYYY-MM-DD)",
		},
		{
			heading: "Meeting Details",
			hasPrompt: false,
			content:
				"| Field | Value |\n| --- | --- |\n| **Date** | `= this.meeting_date` |\n| **Type** | `= this.meeting_type` |\n| **Area** | `= this.area` |\n| **Project** | `= this.project` |\n| **Transcription** | `= this.transcription` |",
		},
		{ heading: "Follow-up", hasPrompt: false },
	],
	task: [
		{
			heading: "Quick Info",
			hasPrompt: false,
			content:
				"| Field | Value |\n|---|---|\n| **Type** | `= this.task_type` |\n| **Status** | `= this.status` |\n| **Due Date** | `= this.due_date` |\n| **Priority** | `= this.priority` |\n| **Effort** | `= this.effort` |\n| **Project** | `= this.project` |\n| **Area** | `= this.area` |",
		},
		{ heading: "Description", hasPrompt: false },
		{
			heading: "Success Criteria",
			hasPrompt: false,
			content: "- [ ]\n- [ ]",
		},
		{
			heading: "Dependencies",
			hasPrompt: false,
			content:
				"| Field | Value |\n|---|---|\n| **Depends On** | `= this.depends_on` |\n| **Blocks** | `= this.blocks` |",
		},
		{ heading: "Notes", hasPrompt: false },
	],
	daily: [
		{ heading: "Today's Focus", hasPrompt: false },
		{
			heading: "Tasks",
			hasPrompt: false,
			content:
				"> [!danger]- Overdue\n> ```dataview\n> TASK\n> WHERE !completed AND due < date(today)\n> SORT due ASC\n> ```\n\n> [!todo]+ Today\n> ```dataview\n> TASK\n> WHERE !completed AND (due = date(today) OR scheduled = date(today))\n> SORT file.name ASC\n> ```\n\n> [!warning]- Upcoming (7 days)\n> ```dataview\n> TASK\n> WHERE !completed AND due > date(today) AND due <= date(today) + dur(7 days)\n> SORT due ASC\n> ```\n\n> [!success]- Completed Today\n> ```dataview\n> TASK\n> WHERE completed AND completion = date(today)\n> SORT file.name ASC\n> ```",
		},
		{ heading: "Dashboard", hasPrompt: false },
		{ heading: "End of Day", hasPrompt: false },
		{ heading: "Gratitude", hasPrompt: false, content: "1.\n2.\n3." },
		{ heading: "Tomorrow", hasPrompt: false, content: "- [ ]" },
		{ heading: "Log", hasPrompt: false },
	],
	"weekly-review": [
		{
			heading: "Overview",
			hasPrompt: false,
			content:
				"| Field | Value |\n|---|---|\n| **Week** | `= this.week` |\n| **Created** | `= this.created` |\n| **Focus Areas** | `= this.focus_areas` |",
		},
		{ heading: "Phase 1: Clear the Mind", hasPrompt: false },
		{ heading: "Brain Dump", hasPrompt: false },
		{
			heading: "Inbox Status",
			hasPrompt: false,
			content:
				"- [ ] Email inbox processed\n- [ ] Physical inbox cleared\n- [ ] Obsidian 00_Inbox empty\n- [ ] Notes app cleared\n- [ ] Voice memos processed",
		},
		{ heading: "Phase 2: Review Calendar", hasPrompt: false },
		{
			heading: "Past Week",
			hasPrompt: false,
			content:
				"| Day | Key Events |\n|---|---|\n| Mon | |\n| Tue | |\n| Wed | |\n| Thu | |\n| Fri | |\n| Sat | |\n| Sun | |",
		},
		{ heading: "Upcoming Week", hasPrompt: false },
		{ heading: "Phase 3: Review Projects", hasPrompt: false },
		{
			heading: "Active Projects",
			hasPrompt: false,
			content:
				'```dataview\nTABLE status, target_completion as "Due", area\nFROM "01 Projects"\nWHERE status = "active"\nSORT target_completion ASC\n```',
		},
		{ heading: "Phase 4: Review Areas", hasPrompt: false },
		{
			heading: "Area Check-In",
			hasPrompt: false,
			content:
				'```dataview\nTABLE status\nFROM "02 Areas"\nWHERE status = "active"\n```',
		},
		{ heading: "Phase 5: Review Goals & Achievements", hasPrompt: false },
		{
			heading: "This Week's Wins",
			hasPrompt: false,
			content: "1.\n2.\n3.",
		},
		{
			heading: "This Week's Challenges",
			hasPrompt: false,
			content: "1.\n2.",
		},
		{ heading: "Lessons Learned", hasPrompt: false },
		{ heading: "Phase 6: Express & Create", hasPrompt: false },
		{ heading: "Phase 7: Plan Next Week", hasPrompt: false },
		{
			heading: "Top 3 Priorities",
			hasPrompt: false,
			content: "1. [ ]\n2. [ ]\n3. [ ]",
		},
		{
			heading: "Weekly Statistics",
			hasPrompt: false,
			content:
				"| Metric | Count |\n|---|---|\n| Inbox items processed | |\n| Notes created | |\n| Projects completed | |\n| Projects started | |\n| Resources added | |",
		},
		{ heading: "Reflections", hasPrompt: false },
	],
	capture: [
		{ heading: "Capture", hasPrompt: false },
		{
			heading: "Why I Saved This",
			hasPrompt: false,
			content:
				"| Field | Value |\n|---|---|\n| **Source** | `= this.source` |\n| **Resonance** | `= this.resonance` |\n| **Urgency** | `= this.urgency` |\n| **Captured** | `= this.created` |",
		},
		{ heading: "Processing Notes", hasPrompt: false },
		{
			heading: "Connections",
			hasPrompt: false,
			content: "**Projects:**\n`= this.projects`\n\n**Areas:**\n`= this.areas`",
		},
		{
			heading: "Next Actions",
			hasPrompt: false,
			content: "- [ ] Process within 48 hours",
		},
	],
	checklist: [
		{
			heading: "Status",
			hasPrompt: false,
			content:
				"| Field | Value |\n|---|---|\n| **Type** | `= this.checklist_type` |\n| **Status** | `= this.status` |\n| **Last Updated** | `= this.created` |",
		},
		{
			heading: "Checklist",
			hasPrompt: false,
			content: "- [ ]\n- [ ]\n- [ ]",
		},
		{
			heading: "Timeline",
			hasPrompt: false,
			content:
				"| When | Action |\n|---|---|\n| 2 weeks before | |\n| 1 week before | |\n| Day before | |\n| Day of | |",
		},
		{ heading: "Notes", hasPrompt: false },
	],
	booking: [
		{ heading: "Booking Details", hasPrompt: false },
		{
			heading: "Cost & Payment",
			hasPrompt: false,
			content:
				"| Field | Value |\n|---|---|\n| **Cost** | `= this.cost` `= this.currency` |\n| **Payment Status** | `= this.payment_status` |\n| **Booking Type** | `= this.booking_type` |",
		},
		{ heading: "Contact & Reference", hasPrompt: false },
		{ heading: "Confirmation Details", hasPrompt: false },
		{ heading: "Important Notes", hasPrompt: false },
		{ heading: "Attachments", hasPrompt: false },
	],
	itinerary: [
		{ heading: "Overview", hasPrompt: false },
		{ heading: "Morning", hasPrompt: false, content: "- [ ]" },
		{ heading: "Afternoon", hasPrompt: false, content: "- [ ]" },
		{ heading: "Evening", hasPrompt: false, content: "- [ ]" },
		{
			heading: "Meals",
			hasPrompt: false,
			content: "**Breakfast:**\n**Lunch:**\n**Dinner:**",
		},
		{ heading: "Notes", hasPrompt: false },
	],
	research: [
		{ heading: "Overview", hasPrompt: false },
		{ heading: "Considered Alternatives", hasPrompt: false },
		{ heading: "Decision", hasPrompt: false },
		{ heading: "Consequences", hasPrompt: false },
		{ heading: "Sources", hasPrompt: false },
	],
	session: [
		{
			heading: "Session Info",
			hasPrompt: false,
			content:
				"| Field | Value |\n|---|---|\n| **Date** | `= this.session_date` |\n| **Provider** | `= this.provider` |\n| **Session #** | `= this.session_number` |\n| **Area** | `= this.area` |\n| **Project** | `= this.project` |",
		},
		{ heading: "Goals for Today", hasPrompt: false },
		{ heading: "Notes", hasPrompt: false },
		{ heading: "Key Takeaways", hasPrompt: false },
		{
			heading: "Action Items",
			hasPrompt: false,
			content: "- [ ]",
		},
		{ heading: "Follow-up", hasPrompt: false },
	],
	trip: [
		{
			heading: "Trip Details",
			hasPrompt: false,
			content:
				"| Field | Value |\n|---|---|\n| **Trip Dates** | TBD |\n| **Duration** | TBD |\n| **Travelers** | TBD |\n| **Route** | TBD |\n| **Status** | `= this.status` |\n| **Area** | `= this.area` |",
		},
		{
			heading: "Project Overview",
			hasPrompt: false,
			content:
				"| Field | Value |\n|---|---|\n| **Start Date** | `= this.start_date` |\n| **Target** | `= this.target_completion` |\n| **Depends On** | `= this.depends_on` |\n| **Blocks** | `= this.blocks` |",
		},
		{ heading: "Why This Matters", hasPrompt: false },
		{
			heading: "Success Criteria",
			hasPrompt: false,
			content: "- [ ]\n- [ ]\n- [ ]",
		},
		{
			heading: "All Bookings",
			hasPrompt: false,
			content:
				'```dataview\nTABLE booking_type as "Type", date as "Date", cost as "Cost", currency as "Currency", status as "Status"\nWHERE type = "booking" AND contains(project, this.file.link)\nSORT date ASC\n```',
		},
		{
			heading: "Daily Itinerary",
			hasPrompt: false,
			content:
				'```dataview\nLIST file.link\nWHERE type = "itinerary" AND contains(project, this.file.link)\nSORT file.name ASC\n```',
		},
		{
			heading: "Research & Reference",
			hasPrompt: false,
			content:
				'```dataview\nTABLE location as "Location", status as "Status"\nWHERE type = "research" AND contains(project, this.file.link)\nSORT file.name ASC\n```',
		},
		{
			heading: "Key Resources",
			hasPrompt: false,
			content:
				'```dataview\nTABLE WITHOUT ID\n  file.link as "Resource",\n  source as "Type",\n  source_url as "Link"\nFROM "03 Resources"\nWHERE contains(projects, this.file.link) OR contains(file.outlinks, this.file.link)\nSORT source ASC, file.name ASC\n```',
		},
		{ heading: "Stakeholders", hasPrompt: false },
		{ heading: "Next Actions", hasPrompt: false, content: "- [ ]" },
		{ heading: "Risks & Blockers", hasPrompt: false },
		{ heading: "Notes", hasPrompt: false },
	],
	invoice: [
		{
			heading: "Invoice Details",
			hasPrompt: false,
			content:
				"| Field | Value |\n|---|---|\n| **Invoice Date** | `= this.invoice_date` |\n| **Due Date** | `= this.due_date` |\n| **Amount** | `= this.amount` `= this.currency` |\n| **Status** | `= this.status` |\n| **Provider** | `= this.provider` |",
		},
		{ heading: "Payment Details", hasPrompt: false },
		{ heading: "Claim Details", hasPrompt: false },
		{ heading: "Attachments", hasPrompt: false },
		{ heading: "Notes", hasPrompt: false },
	],
	"medical-statement": [
		{
			heading: "Statement Summary",
			hasPrompt: false,
			content:
				"| Field | Value |\n|---|---|\n| **Provider** | `= this.provider` |\n| **Practitioner** | `= this.practitioner` |\n| **Patient** | `= this.patient` |\n| **Statement Date** | `= this.statement_date` |\n| **Period** | `= this.period_start` to `= this.period_end` |",
		},
		{
			heading: "Financial Summary",
			hasPrompt: false,
			content:
				"| Field | Value |\n|---|---|\n| **Previous Balance** | $`= this.previous_balance` |\n| **Total Invoiced** | $`= this.total_invoiced` |\n| **Total Payments** | $`= this.total_payments` |\n| **Statement Balance** | $`= this.statement_balance` |\n| **Status** | `= this.status` |",
		},
		{ heading: "Consultations", hasPrompt: false },
		{ heading: "Payment Details", hasPrompt: false },
		{ heading: "Medicare/Health Fund Claims", hasPrompt: false },
		{ heading: "Attachments", hasPrompt: false },
		{ heading: "Notes", hasPrompt: false },
	],
	cv: [{ heading: "Content", hasPrompt: false, content: "{{content}}" }],
	document: [
		{ heading: "Attachments", hasPrompt: false },
		{ heading: "Notes", hasPrompt: false },
	],
	"employment-contract": [
		{
			heading: "Contract Details",
			hasPrompt: false,
			content:
				"| Field | Value |\n| --- | --- |\n| **Employer** | `= this.employer` |\n| **Contractor** | `= this.contractor` |\n| **Role** | `= this.role` |\n| **Start Date** | `= this.start_date` |\n| **End Date** | `= this.end_date` |\n| **Rate** | `= this.rate` |\n| **Status** | `= this.status` |",
		},
		{ heading: "Attachments", hasPrompt: false },
		{
			heading: "Key Terms",
			hasPrompt: false,
			content:
				"- **Notice Period**:\n- **IP Assignment**:\n- **Confidentiality**:\n- **Non-Compete**:",
		},
		{ heading: "Notes", hasPrompt: false },
	],
	letter: [{ heading: "Content", hasPrompt: false, content: "{{content}}" }],

	// === CLIPPING TEMPLATES ===
	"clipping-article": [
		{ heading: "AI Summary", hasPrompt: false },
		{
			heading: "Article Info",
			hasPrompt: false,
			content:
				"| | |\n|---|---|\n| **Author** | `= this.author` |\n| **Site** | `= this.site_name` |\n| **Section** | `= this.section` |\n| **Published** | `= this.published` |\n| **Modified** | `= this.modified` |\n| **Reading Time** | `= this.word_count` words |",
		},
		{ heading: "Why I Saved This", hasPrompt: false },
		{ heading: "Key Takeaways", hasPrompt: false },
		{ heading: "Content", hasPrompt: false },
	],
	"clipping-youtube": [
		{ heading: "AI Summary", hasPrompt: false },
		{
			heading: "Video Info",
			hasPrompt: false,
			content:
				"| | |\n|---|---|\n| **Channel** | `= this.channel` |\n| **Published** | `= this.published` |\n| **Duration** | `= this.duration` |\n| **Views** | `= this.view_count` |",
		},
		{ heading: "Why I Saved This", hasPrompt: false },
		{ heading: "Description", hasPrompt: false },
		{ heading: "Key Timestamps", hasPrompt: false },
		{ heading: "Notes", hasPrompt: false },
		{ heading: "Transcript", hasPrompt: false },
	],
	"clipping-book": [
		{ heading: "AI Summary", hasPrompt: false },
		{
			heading: "Book Details",
			hasPrompt: false,
			content:
				"| | |\n|---|---|\n| **Author** | `= this.author` |\n| **Rating** | `= this.rating`/5 (`= this.ratings_count` ratings) |\n| **Pages** | `= this.pages` |\n| **Genre** | `= this.genres` |\n| **Publisher** | `= this.publisher` |\n| **Published** | `= this.published` |\n| **Series** | `= this.series` #`= this.series_position` |\n| **Format** | `= this.format` |\n| **ISBN** | `= this.isbn` |",
		},
		{ heading: "Why I Want to Read This", hasPrompt: false },
		{ heading: "Description", hasPrompt: false },
		{ heading: "Notes", hasPrompt: false },
	],
	"clipping-recipe": [
		{ heading: "AI Summary", hasPrompt: false },
		{
			heading: "Quick Info",
			hasPrompt: false,
			content:
				"| | |\n|---|---|\n| **Author** | `= this.author` |\n| **Prep Time** | `= this.prep_time` |\n| **Cook Time** | `= this.cook_time` |\n| **Total Time** | `= this.total_time` |\n| **Servings** | `= this.servings` |\n| **Cuisine** | `= this.cuisine` |\n| **Category** | `= this.category` |\n| **Diet** | `= this.diet` |\n| **Rating** | `= this.rating`/5 (`= this.rating_count` ratings) |",
		},
		{
			heading: "Nutrition (per serving)",
			hasPrompt: false,
			content:
				"| Calories | Protein | Carbs | Fat | Fiber |\n|---|---|---|---|---|\n| `= this.calories` | `= this.protein` | `= this.carbs` | `= this.fat` | `= this.fiber` |",
		},
		{ heading: "Why I Want to Make This", hasPrompt: false },
		{ heading: "Ingredients", hasPrompt: false },
		{ heading: "Instructions", hasPrompt: false },
		{ heading: "Notes", hasPrompt: false },
	],
	"clipping-restaurant": [
		{
			heading: "At a Glance",
			hasPrompt: false,
			content:
				"| | |\n|---|---|\n| **Cuisine** | `= this.cuisine` |\n| **Price Range** | `= this.price_range` |\n| **Rating** | `= this.rating` |\n| **Address** | `= this.address` |\n| **Suburb** | `= this.suburb` |\n| **State** | `= this.state` |\n| **Phone** | `= this.phone` |",
		},
		{ heading: "Hours", hasPrompt: false, content: "`= this.hours`" },
		{ heading: "Why I Want to Try This", hasPrompt: false },
		{ heading: "Notes", hasPrompt: false },
	],
	"clipping-accommodation": [
		{
			heading: "At a Glance",
			hasPrompt: false,
			content:
				"| | |\n|---|---|\n| **Platform** | `= this.platform` |\n| **Type** | `= this.property_type` |\n| **Price** | `= this.price` `= this.currency` |\n| **Rating** | `= this.rating` (`= this.review_count` reviews) |\n| **Address** | `= this.address` |\n| **Suburb** | `= this.suburb` |\n| **Region** | `= this.region` |\n| **Check-in** | `= this.check_in` |\n| **Check-out** | `= this.check_out` |\n| **Pets** | `= this.pets_allowed` |",
		},
		{ heading: "Amenities", hasPrompt: false, content: "`= this.amenities`" },
		{ heading: "Why I'm Interested", hasPrompt: false },
		{ heading: "Notes", hasPrompt: false },
	],
	"clipping-place": [
		{
			heading: "At a Glance",
			hasPrompt: false,
			content:
				"| | |\n|---|---|\n| **Category** | `= this.category` |\n| **Address** | `= this.address` |\n| **Suburb** | `= this.suburb` |\n| **State** | `= this.state` |\n| **Country** | `= this.country` |\n| **Rating** | `= this.rating` |",
		},
		{ heading: "Why I Saved This", hasPrompt: false },
		{ heading: "Notes", hasPrompt: false },
	],
	"clipping-github-repo": [
		{ heading: "AI Summary", hasPrompt: false },
		{
			heading: "At a Glance",
			hasPrompt: false,
			content:
				"| | |\n|---|---|\n| **Owner** | `= this.owner` |\n| **Language** | `= this.language` |\n| **License** | `= this.license` |\n| **Stars** | `= this.stars` |\n| **Forks** | `= this.forks` |\n| **Last Updated** | `= this.updated` |\n| **Topics** | `= this.topics` |",
		},
		{ heading: "Why I'm Interested", hasPrompt: false },
		{ heading: "README", hasPrompt: false },
	],
	"clipping-podcast-episode": [
		{ heading: "AI Summary", hasPrompt: false },
		{
			heading: "Episode Info",
			hasPrompt: false,
			content:
				"| | |\n|---|---|\n| **Show** | `= this.show` |\n| **Episode** | `= this.episode_number` |\n| **Season** | `= this.season` |\n| **Host** | `= this.host` |\n| **Duration** | `= this.duration` |\n| **Published** | `= this.published` |\n| **Platform** | `= this.platform` |",
		},
		{ heading: "Why I Want to Listen", hasPrompt: false },
		{ heading: "Description", hasPrompt: false },
		{ heading: "Notes", hasPrompt: false },
	],
	"clipping-movie": [
		{ heading: "AI Summary", hasPrompt: false },
		{
			heading: "Movie Info",
			hasPrompt: false,
			content:
				"| | |\n|---|---|\n| **Year** | `= this.year` |\n| **Director** | `= this.director` |\n| **Cast** | `= this.cast` |\n| **Rating** | `= this.rating`/10 (`= this.rating_count` ratings) |\n| **Runtime** | `= this.runtime` |\n| **Genre** | `= this.genre` |\n| **Content Rating** | `= this.content_rating` |\n| **Production** | `= this.production` |",
		},
		{ heading: "Why I Want to Watch This", hasPrompt: false },
		{ heading: "Description", hasPrompt: false },
		{ heading: "Notes", hasPrompt: false },
	],
	"clipping-event": [
		{ heading: "AI Summary", hasPrompt: false },
		{
			heading: "Event Details",
			hasPrompt: false,
			content:
				"| | |\n|---|---|\n| **Date** | `= this.event_date` |\n| **End** | `= this.event_end` |\n| **Door Time** | `= this.door_time` |\n| **Status** | `= this.event_status` |\n| **Mode** | `= this.attendance_mode` |\n| **Venue** | `= this.venue` |\n| **Address** | `= this.address` |\n| **City** | `= this.city`, `= this.state` |\n| **Price** | `= this.price` |\n| **Organizer** | `= this.organizer` |\n| **Performer** | `= this.performer` |",
		},
		{ heading: "Why I Want to Attend", hasPrompt: false },
		{ heading: "Description", hasPrompt: false },
	],
	"clipping-documentation": [
		{
			heading: "Info",
			hasPrompt: false,
			content:
				"| | |\n|---|---|\n| **Domain** | `= this.domain` |\n| **Technology** | `= this.technology` |\n| **Version** | `= this.version` |\n| **Section** | `= this.section` |\n| **Clipped** | `= this.clipped` |",
		},
		{ heading: "AI Summary", hasPrompt: false },
		{ heading: "Why I Saved This", hasPrompt: false },
		{ heading: "Key Snippets", hasPrompt: false },
	],
	"clipping-highlight-only": [{ heading: "Highlights", hasPrompt: false }],
	"clipping-job-posting": [
		{ heading: "AI Summary", hasPrompt: false },
		{
			heading: "Job Details",
			hasPrompt: false,
			content:
				"| | |\n|---|---|\n| **Company** | `= this.company` |\n| **Location** | `= this.location` |\n| **Region** | `= this.region` |\n| **Remote** | `= this.remote` |\n| **Type** | `= this.employment_type` |\n| **Salary** | `= this.salary` |\n| **Experience** | `= this.experience` |\n| **Posted** | `= this.posted` |\n| **Expires** | `= this.expires` |\n| **Platform** | `= this.platform` |",
		},
		{ heading: "Why I'm Interested", hasPrompt: false },
		{ heading: "Description", hasPrompt: false },
		{ heading: "Requirements", hasPrompt: false },
		{ heading: "Benefits", hasPrompt: false },
		{ heading: "Notes", hasPrompt: false },
	],
	"clipping-product": [
		{ heading: "AI Summary", hasPrompt: false },
		{
			heading: "Details",
			hasPrompt: false,
			content:
				"| | |\n|---|---|\n| **Price** | `= this.price` `= this.currency` |\n| **Brand** | `= this.brand` |\n| **Rating** | `= this.rating`/5 (`= this.rating_count` reviews) |\n| **Availability** | `= this.availability` |\n| **SKU** | `= this.sku` |\n| **Platform** | `= this.platform` |\n| **Gift For** | `= this.gift_for` |",
		},
		{ heading: "Why I Clipped This", hasPrompt: false },
		{ heading: "Description", hasPrompt: false },
		{ heading: "Notes", hasPrompt: false },
	],
	"clipping-reddit-post": [
		{ heading: "AI Summary", hasPrompt: false },
		{
			heading: "Post Info",
			hasPrompt: false,
			content:
				"| | |\n|---|---|\n| **Subreddit** | `= this.subreddit` |\n| **Author** | `= this.author` |\n| **Posted** | `= this.posted` |\n| **Score** | `= this.score` |\n| **Comments** | `= this.comment_count` |",
		},
		{ heading: "Why I Saved This", hasPrompt: false },
		{ heading: "Key Comments", hasPrompt: false },
	],
	"clipping-stack-overflow": [
		{ heading: "AI Summary", hasPrompt: false },
		{ heading: "Problem", hasPrompt: false },
		{ heading: "Top Answer", hasPrompt: false },
	],
	"clipping-tweet": [
		{
			heading: "Tweet Info",
			hasPrompt: false,
			content:
				"| | |\n|---|---|\n| **Author** | `= this.author` |\n| **Handle** | `= this.handle` |\n| **Posted** | `= this.posted` |\n| **Likes** | `= this.likes` |\n| **Retweets** | `= this.retweets` |\n| **Clipped** | `= this.clipped` |",
		},
		{ heading: "Why I Saved This", hasPrompt: false },
		{ heading: "Thread / Replies", hasPrompt: false },
	],
	"clipping-wikipedia": [
		{
			heading: "Info",
			hasPrompt: false,
			content:
				"| | |\n|---|---|\n| **Category** | `= this.category` |\n| **Language** | `= this.language` |\n| **Last Modified** | `= this.modified` |\n| **Clipped** | `= this.clipped` |",
		},
		{ heading: "AI Summary", hasPrompt: false },
		{ heading: "Summary", hasPrompt: false, content: "`= this.summary`" },
		{ heading: "Why I Saved This", hasPrompt: false },
		{ heading: "Key Points", hasPrompt: false },
	],
	"clipping-chatgpt": [
		{ heading: "Why I Saved This", hasPrompt: false },
		{ heading: "Conversation", hasPrompt: false },
	],
	"clipping-claude": [
		{ heading: "Why I Saved This", hasPrompt: false },
		{ heading: "Conversation", hasPrompt: false },
	],
	"clipping-course": [
		{ heading: "AI Summary", hasPrompt: false },
		{
			heading: "At a Glance",
			hasPrompt: false,
			content:
				"| | |\n|---|---|\n| **Instructor** | `= this.instructor` |\n| **Provider** | `= this.provider` |\n| **Price** | `= this.price` `= this.currency` |\n| **Rating** | `= this.rating`/5 (`= this.rating_count` ratings) |\n| **Duration** | `= this.duration` |\n| **Level** | `= this.level` |\n| **Language** | `= this.language` |\n| **Platform** | `= this.platform` |",
		},
		{ heading: "Why I Want to Take This", hasPrompt: false },
		{ heading: "Description", hasPrompt: false },
		{ heading: "Syllabus", hasPrompt: false },
		{ heading: "Notes", hasPrompt: false },
	],
	"clipping-app": [
		{ heading: "AI Summary", hasPrompt: false },
		{
			heading: "At a Glance",
			hasPrompt: false,
			content:
				"| | |\n|---|---|\n| **Developer** | `= this.developer` |\n| **Price** | `= this.price` `= this.currency` |\n| **Rating** | `= this.rating`/5 (`= this.rating_count` ratings) |\n| **Category** | `= this.category` |\n| **Platform** | `= this.platform` |\n| **Version** | `= this.version` |\n| **Size** | `= this.size` |",
		},
		{ heading: "Why I'm Interested", hasPrompt: false },
		{ heading: "Description", hasPrompt: false },
		{ heading: "Notes", hasPrompt: false },
	],

	// === PROCESSOR TEMPLATES ===
	"processor-article": [
		{ heading: "Content", hasPrompt: false, content: "{{scraped_content}}" },
	],
	"processor-youtube": [
		{ heading: "Why I Saved This", hasPrompt: false },
		{ heading: "Transcript", hasPrompt: false, content: "{{transcript}}" },
	],
	"processor-recipe": [
		{ heading: "Ingredients", hasPrompt: false, content: "{{ingredients}}" },
		{ heading: "Instructions", hasPrompt: false, content: "{{instructions}}" },
		{ heading: "Notes", hasPrompt: false },
	],
	"processor-restaurant": [
		{
			heading: "At a Glance",
			hasPrompt: false,
			content:
				"| | |\n|---|---|\n| **Cuisine** | `= this.cuisine` |\n| **Price Range** | `= this.price_range` |\n| **Location** | `= this.suburb`, `= this.city` |\n| **Address** | `= this.address` |\n| **Phone** | `= this.phone` |\n| **Chef** | `= this.chef` |",
		},
		{ heading: "Specialties", hasPrompt: false, content: "{{specialties}}" },
		{ heading: "Notes", hasPrompt: false, content: "{{content}}" },
	],
	"processor-accommodation": [
		{ heading: "Booking Details", hasPrompt: false, content: "{{content}}" },
	],
	"processor-place": [
		{ heading: "Notes", hasPrompt: false, content: "{{content}}" },
	],
	"processor-github": [
		{ heading: "Notes", hasPrompt: false, content: "{{content}}" },
	],
	"processor-social": [
		{ heading: "Content", hasPrompt: false, content: "{{content}}" },
	],
	"processor-generic": [
		{ heading: "Why I Saved This", hasPrompt: false },
		{ heading: "Content", hasPrompt: false, content: "{{content}}" },
	],
};

export const DEFAULT_TEMPLATE_VERSIONS: Record<string, number> = {
	// PARA templates
	project: 1,
	trip: 1,
	area: 1,
	resource: 3,
	task: 1,
	daily: 1,
	"weekly-review": 1,
	capture: 1,
	checklist: 1,
	booking: 1,
	itinerary: 1,
	"itinerary-day": 1,
	research: 1,
	session: 1,
	invoice: 1,
	bookmark: 1,
	"medical-statement": 1,
	cv: 1,
	letter: 1,
	"employment-contract": 1,
	document: 1,
	meeting: 1,
	// Clipping templates
	"clipping-article": 2,
	"clipping-youtube": 3,
	"clipping-book": 2,
	"clipping-recipe": 2,
	"clipping-restaurant": 1,
	"clipping-accommodation": 2,
	"clipping-place": 1,
	"clipping-github-repo": 2,
	"clipping-podcast-episode": 2,
	"clipping-movie": 2,
	"clipping-event": 2,
	"clipping-documentation": 2,
	"clipping-highlight-only": 1,
	"clipping-job-posting": 2,
	"clipping-product": 2,
	"clipping-reddit-post": 2,
	"clipping-stack-overflow": 1,
	"clipping-tweet": 2,
	"clipping-wikipedia": 2,
	"clipping-chatgpt": 1,
	"clipping-claude": 1,
	"clipping-course": 2,
	"clipping-app": 2,
	// Processor templates
	"processor-article": 4,
	"processor-youtube": 4,
	"processor-recipe": 4,
	"processor-restaurant": 1,
	"processor-accommodation": 4,
	"processor-place": 4,
	"processor-github": 1,
	"processor-social": 4,
	"processor-generic": 4,
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
	resource: "03 Resources",
	task: "00 Inbox",
	daily: "00 Inbox",
	"weekly-review": "00 Inbox",
	capture: "00 Inbox",
	booking: "04 Archives/Bookings",
	checklist: "00 Inbox",
	itinerary: "00 Inbox",
	"itinerary-day": "00 Inbox",
	research: "00 Inbox",
	session: "00 Inbox",
	invoice: "04 Archives/Invoices",
	bookmark: "00 Inbox",
	"medical-statement": "00 Inbox",
	meeting: "03 Resources/Meetings",
	// Clipping templates - all to inbox for processing
	"clipping-article": "00 Inbox",
	"clipping-youtube": "00 Inbox",
	"clipping-book": "00 Inbox",
	"clipping-recipe": "00 Inbox",
	"clipping-restaurant": "00 Inbox",
	"clipping-accommodation": "00 Inbox",
	"clipping-place": "00 Inbox",
	"clipping-github-repo": "00 Inbox",
	"clipping-podcast-episode": "00 Inbox",
	"clipping-movie": "00 Inbox",
	"clipping-event": "00 Inbox",
	"clipping-documentation": "00 Inbox",
	"clipping-highlight-only": "00 Inbox",
	"clipping-job-posting": "00 Inbox",
	"clipping-product": "00 Inbox",
	"clipping-reddit-post": "00 Inbox",
	"clipping-stack-overflow": "00 Inbox",
	"clipping-tweet": "00 Inbox",
	"clipping-wikipedia": "00 Inbox",
	"clipping-chatgpt": "00 Inbox",
	"clipping-claude": "00 Inbox",
	"clipping-course": "00 Inbox",
	"clipping-app": "00 Inbox",
	// Processor templates - all to inbox for processing
	"processor-article": "00 Inbox",
	"processor-youtube": "00 Inbox",
	"processor-recipe": "00 Inbox",
	"processor-restaurant": "00 Inbox",
	"processor-accommodation": "00 Inbox",
	"processor-place": "00 Inbox",
	"processor-github": "00 Inbox",
	"processor-social": "00 Inbox",
	"processor-generic": "00 Inbox",
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
 * - Clippings use ✂️ plus type-specific emoji
 */
export const DEFAULT_TITLE_PREFIXES: Partial<Record<string, string>> = {
	project: "🎯 ",
	area: "🌱 ",
	resource: "📚 ",
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
	meeting: "🗣️ ",
	// Clipping templates
	"clipping-article": "✂️📰 ",
	"clipping-youtube": "✂️📺 ",
	"clipping-book": "✂️📚 ",
	"clipping-recipe": "✂️🍳 ",
	"clipping-restaurant": "✂️🍽️ ",
	"clipping-accommodation": "✂️🏨 ",
	"clipping-place": "✂️📍 ",
	"clipping-github-repo": "✂️💻 ",
	"clipping-podcast-episode": "✂️🎙️ ",
	"clipping-movie": "✂️🎬 ",
	"clipping-event": "✂️🎫 ",
	"clipping-documentation": "✂️📖 ",
	"clipping-highlight-only": "✂️ ",
	"clipping-job-posting": "✂️💼 ",
	"clipping-product": "✂️🎁 ",
	"clipping-reddit-post": "✂️🔶 ",
	"clipping-stack-overflow": "✂️💬 ",
	"clipping-tweet": "✂️🐦 ",
	"clipping-wikipedia": "✂️📖 ",
	"clipping-chatgpt": "✂️🤖 ",
	"clipping-claude": "✂️🤖 ",
	"clipping-course": "✂️🎓 ",
	"clipping-app": "✂️📱 ",
	// Processor templates - no prefixes (programmatic creation)
};

/**
 * Emoji mapping for resource source_format field.
 * Provides visual discoverability for different content types.
 *
 * Resources use a two-emoji pattern: base (📚) + format-specific emoji.
 * For example: "📚🎬 TypeScript Deep Dive" (resource + video format)
 *
 * See @../skills/para-classifier/references/emoji-mapping.md for full guidelines.
 */
export const SOURCE_FORMAT_EMOJIS: Record<string, string> = {
	article: "📰",
	video: "🎬",
	audio: "🎧",
	document: "📄",
	thread: "🧵",
	image: "🖼️",
	book: "📖",
	course: "🎓",
	podcast: "🎙️",
	paper: "📑",
};
