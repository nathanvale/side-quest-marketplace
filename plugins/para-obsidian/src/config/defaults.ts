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

	// === UNIFIED CLIPPING TEMPLATE ===
	clipping: {
		required: {
			type: { type: "enum", enum: ["clipping"] },
			source: { type: "string" },
			clipped: { type: "date" },
			domain: {
				type: "string",
				optional: true,
				description: "Domain of the source URL (e.g. github.com)",
			},
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
			resource_type: {
				type: "string",
				optional: true,
				description:
					"Content type (article, youtube, recipe, etc.) — set during triage",
			},
			capture_reason: {
				type: "string",
				optional: true,
				description: "Why this was clipped — set during triage",
			},
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
		{
			heading: "Why This Matters",
			hasPrompt: false,
			comment: "What problem does this solve? Why now?",
		},
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
				'```dataview\nTABLE\n  resource_type as "Type",\n  domain as "Domain",\n  clipped as "Clipped"\nWHERE type = "clipping" AND (contains(project, this.file.link) OR contains(projects, this.file.link))\nSORT clipped DESC\n```',
		},
		{ heading: "Stakeholders", hasPrompt: false },
		{ heading: "Risks & Blockers", hasPrompt: false },
		{
			heading: "Notes",
			hasPrompt: false,
			comment: "Context, ideas, learnings",
		},
	],
	area: [
		{
			heading: "Overview",
			hasPrompt: false,
			content:
				"| Field | Value |\n|---|---|\n| **Status** | `= this.status` |\n| **Created** | `= this.created` |",
		},
		{
			heading: "Description",
			hasPrompt: false,
			comment: "What does this area encompass?",
		},
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
		{
			heading: "Notes",
			hasPrompt: false,
			comment: "Observations, ideas, improvements",
		},
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
		{
			heading: "Description",
			hasPrompt: false,
			comment: "What is this task? What's the desired outcome?",
		},
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
		{
			heading: "Notes",
			hasPrompt: false,
			comment: "Context, blockers, resources needed",
		},
	],
	daily: [
		{
			heading: "Today's Focus",
			hasPrompt: false,
			comment: "What is the ONE thing that would make today a success?",
		},
		{
			heading: "Tasks",
			hasPrompt: false,
			content:
				"> [!danger]- Overdue\n> ```dataview\n> TASK\n> WHERE !completed AND due < date(today)\n> SORT due ASC\n> ```\n\n> [!todo]+ Today\n> ```dataview\n> TASK\n> WHERE !completed AND (due = date(today) OR scheduled = date(today))\n> SORT file.name ASC\n> ```\n\n> [!warning]- Upcoming (7 days)\n> ```dataview\n> TASK\n> WHERE !completed AND due > date(today) AND due <= date(today) + dur(7 days)\n> SORT due ASC\n> ```\n\n> [!success]- Completed Today\n> ```dataview\n> TASK\n> WHERE completed AND completion = date(today)\n> SORT file.name ASC\n> ```",
		},
		{
			heading: "Dashboard",
			hasPrompt: false,
			comment: "Quick thoughts, ideas, observations throughout the day",
		},
		{
			heading: "End of Day",
			hasPrompt: false,
			comment: "What did you accomplish? What got in the way?",
		},
		{
			heading: "Gratitude",
			hasPrompt: false,
			content: "1.\n2.\n3.",
			comment: "Three things you're grateful for today",
		},
		{
			heading: "Tomorrow",
			hasPrompt: false,
			content: "- [ ]",
			comment: "Set yourself up for success",
		},
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
		{
			heading: "Brain Dump",
			hasPrompt: false,
			comment:
				"Get everything out of your head. Don't organize yet, just dump.",
		},
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
			comment: "What happened? Key events, meetings, commitments",
		},
		{
			heading: "Upcoming Week",
			hasPrompt: false,
			comment: "What's scheduled? Prepare for it.",
		},
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
			comment: "Celebrate wins, no matter how small",
		},
		{
			heading: "This Week's Challenges",
			hasPrompt: false,
			content: "1.\n2.",
			comment: "Learning opportunities, not failures",
		},
		{ heading: "Lessons Learned", hasPrompt: false },
		{
			heading: "Phase 6: Express & Create",
			hasPrompt: false,
			comment: "What can you produce from your captured knowledge?",
		},
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
		{
			heading: "Reflections",
			hasPrompt: false,
			comment: "Any additional reflections",
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
		{
			heading: "Notes",
			hasPrompt: false,
			comment: "Special considerations, reminders",
		},
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
		{
			heading: "Confirmation Details",
			hasPrompt: false,
			comment: "Paste or summarize confirmation details here",
		},
		{
			heading: "Important Notes",
			hasPrompt: false,
			comment: "Check-in times, requirements, restrictions",
		},
		{ heading: "Attachments", hasPrompt: false },
	],
	itinerary: [
		{
			heading: "Overview",
			hasPrompt: false,
			comment: "Driving times, transfers, logistics",
		},
		{ heading: "Morning", hasPrompt: false, content: "- [ ]" },
		{ heading: "Afternoon", hasPrompt: false, content: "- [ ]" },
		{ heading: "Evening", hasPrompt: false, content: "- [ ]" },
		{
			heading: "Meals",
			hasPrompt: false,
			content: "**Breakfast:**\n**Lunch:**\n**Dinner:**",
			comment: "Weather, reservations, timing",
		},
		{ heading: "Notes", hasPrompt: false },
	],
	research: [
		{
			heading: "Overview",
			hasPrompt: false,
			comment: "What is this research about? Why is it relevant?",
		},
		{ heading: "Considered Alternatives", hasPrompt: false },
		{
			heading: "Decision",
			hasPrompt: false,
			comment: "What did you decide?",
		},
		{ heading: "Consequences", hasPrompt: false },
		{
			heading: "Sources",
			hasPrompt: false,
			comment: "Where did this info come from?",
		},
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
		{
			heading: "Payment Details",
			hasPrompt: false,
			comment: "Bank details, payment method, reference number",
		},
		{
			heading: "Claim Details",
			hasPrompt: false,
			comment: "Medicare/health insurance claim info if applicable",
		},
		{
			heading: "Attachments",
			hasPrompt: false,
			comment: "Link to invoice PDF",
		},
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

	// === UNIFIED CLIPPING TEMPLATE ===
	clipping: [
		{
			heading: "Capture Reason",
			hasPrompt: false,
			content: "`= this.capture_reason`",
		},
		{ heading: "Content", hasPrompt: false },
	],
};

/**
 * Body configuration overrides for template generation.
 *
 * Templates with body config get custom H1 lines, preamble blocks,
 * and footer content instead of the standard `# {{title}}` heading.
 * Used to align vault templates with Web Clipper output format.
 */
export interface TemplateBodyConfig {
	/** Custom H1 line (replaces default `# {{title}}`). */
	readonly titleLine?: string;
	/** Content between H1 and first ## section. */
	readonly preamble?: string;
	/** Content after the last section (Web Clipper only, not emitted in vault template). */
	readonly footer?: string;
	/** Whether to skip template_version in frontmatter. */
	readonly skipTemplateVersion?: boolean;
}

/**
 * Default body configuration per template type.
 *
 * Templates listed here get custom body structure instead of the
 * standard `# {{title}}` heading. Currently only clipping uses this
 * to match Web Clipper output format.
 */
export const DEFAULT_TEMPLATE_BODY_CONFIG: Partial<
	Record<string, TemplateBodyConfig>
> = {
	clipping: {
		titleLine: "# `= this.file.name`",
		preamble:
			"**Source:** `= this.source`\n**Clipped:** `= this.clipped`\n\n---",
		footer: "<!-- highlights:{{highlights|length}} -->",
	},
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
	// Unified clipping template
	clipping: 2,
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
	// Unified clipping template
	clipping: "00 Inbox",
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
 * - Tasks are action-oriented (no prefix)
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
	// Unified clipping template — type-specific emojis added at runtime via CLIPPING_TYPE_EMOJI
	clipping: "✂️ ",
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
