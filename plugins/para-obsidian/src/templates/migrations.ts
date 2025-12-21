/**
 * Template version migration hooks.
 *
 * This module defines the actual migration logic for upgrading notes
 * from one template version to another. Each migration function
 * transforms frontmatter and body content as needed.
 *
 * Migrations are organized by note type and version transitions:
 * - `MIGRATIONS.project[1][2]` migrates projects from v1 to v2
 *
 * @module migrations
 */
import type {
	MigrationFn,
	MigrationHooks,
	MigrationResult,
} from "../frontmatter/index";

/**
 * Ensures a field exists, setting a default value if missing.
 *
 * @param attributes - Current frontmatter attributes
 * @param key - Field name to check/set
 * @param value - Default value if field is missing
 * @param message - Change description if value was set
 * @returns Updated attributes and list of changes made
 */
function ensureField<T>(
	attributes: Record<string, unknown>,
	key: string,
	value: T,
	message: string,
): { attributes: Record<string, unknown>; changes: string[] } {
	if (attributes[key] !== undefined) return { attributes, changes: [] };
	const next = { ...attributes, [key]: value };
	return { attributes: next, changes: [message] };
}

/**
 * Renames a field from one key to another.
 *
 * @param attributes - Current frontmatter attributes
 * @param from - Original field name
 * @param to - New field name
 * @param message - Change description if rename occurred
 * @returns Updated attributes and list of changes made
 */
function renameField(
	attributes: Record<string, unknown>,
	from: string,
	to: string,
	message: string,
): { attributes: Record<string, unknown>; changes: string[] } {
	if (!(from in attributes)) return { attributes, changes: [] };
	const next = { ...attributes };
	next[to] = next[from];
	delete next[from];
	return { attributes: next, changes: [message] };
}

/**
 * Migrates project notes from template version 1 to 2.
 *
 * Changes:
 * - Renames "on-hold" status to "paused"
 * - Adds review_period field (default: "7d")
 * - Renames "target" to "target_completion"
 * - Renames "start" to "start_date"
 */
const projectV1To2: MigrationFn = (ctx): MigrationResult => {
	const next = { ...ctx.attributes };
	const changes: string[] = [];

	// Rename status value
	if (next.status === "on-hold") {
		next.status = "paused";
		changes.push('status: "on-hold" → "paused"');
	}

	// Add/rename fields
	const review = ensureField(next, "review_period", "7d", "review_period: 7d");
	const renamedTarget = renameField(
		review.attributes,
		"target",
		"target_completion",
		"target → target_completion",
	);
	const renamedStart = renameField(
		renamedTarget.attributes,
		"start",
		"start_date",
		"start → start_date",
	);

	return {
		attributes: renamedStart.attributes,
		body: ctx.body,
		changes: [
			...changes,
			...review.changes,
			...renamedTarget.changes,
			...renamedStart.changes,
		],
	};
};

/** Migrates area notes v1→v2: adds review_period. */
const areaV1To2: MigrationFn = (ctx): MigrationResult => {
	const review = ensureField(
		ctx.attributes,
		"review_period",
		"7d",
		"review_period: 7d",
	);
	return {
		attributes: review.attributes,
		body: ctx.body,
		changes: [...review.changes],
	};
};

/** Migrates resource notes v1→v2: renames origin→source. */
const resourceV1To2: MigrationFn = (ctx): MigrationResult => {
	const source = renameField(
		ctx.attributes,
		"origin",
		"source",
		"origin → source",
	);
	return {
		attributes: source.attributes,
		body: ctx.body,
		changes: [...source.changes],
	};
};

/** Migrates task notes v1→v2: adds status, effort, task_type defaults. */
const taskV1To2: MigrationFn = (ctx): MigrationResult => {
	const status = ensureField(
		ctx.attributes,
		"status",
		"not-started",
		"status: not-started",
	);
	const effort = ensureField(
		status.attributes,
		"effort",
		"medium",
		"effort: medium",
	);
	const taskType = ensureField(
		effort.attributes,
		"task_type",
		"task",
		"task_type: task",
	);
	return {
		attributes: taskType.attributes,
		body: ctx.body,
		changes: [...status.changes, ...effort.changes, ...taskType.changes],
	};
};

/** Migrates daily notes v1→v2: no changes needed. */
const dailyV1To2: MigrationFn = (ctx): MigrationResult => {
	return {
		attributes: ctx.attributes,
		body: ctx.body,
		changes: [],
	};
};

/** Migrates weekly-review notes v1→v2: adds week placeholder. */
const weeklyReviewV1To2: MigrationFn = (ctx): MigrationResult => {
	const week = ensureField(
		ctx.attributes,
		"week",
		"TODO-week",
		"week: placeholder",
	);
	return {
		attributes: week.attributes,
		body: ctx.body,
		changes: [...week.changes],
	};
};

/** Migrates capture notes v1→v2: adds status/resonance defaults. */
const captureV1To2: MigrationFn = (ctx): MigrationResult => {
	const status = ensureField(
		ctx.attributes,
		"status",
		"inbox",
		"status: inbox",
	);
	const resonance = ensureField(
		status.attributes,
		"resonance",
		"useful",
		"resonance: useful",
	);
	return {
		attributes: resonance.attributes,
		body: ctx.body,
		changes: [...status.changes, ...resonance.changes],
	};
};

/** Migrates checklist notes v1→v2: adds status default. */
const checklistV1To2: MigrationFn = (ctx): MigrationResult => {
	const status = ensureField(
		ctx.attributes,
		"status",
		"draft",
		"status: draft",
	);
	return {
		attributes: status.attributes,
		body: ctx.body,
		changes: [...status.changes],
	};
};

/** Migrates booking notes v1→v2: adds payment_status default. */
const bookingV1To2: MigrationFn = (ctx): MigrationResult => {
	const payment = ensureField(
		ctx.attributes,
		"payment_status",
		"unpaid",
		"payment_status: unpaid",
	);
	return {
		attributes: payment.attributes,
		body: ctx.body,
		changes: [...payment.changes],
	};
};

/** Migrates booking notes v2→v3: normalizes booking_type enum, payment_status "unpaid"→"pending", ensures cost is string. */
const bookingV2To3: MigrationFn = (ctx): MigrationResult => {
	const next = { ...ctx.attributes };
	const changes: string[] = [];

	// Normalize old booking types to new enum
	if (next.booking_type === "hotel") {
		next.booking_type = "accommodation";
		changes.push('booking_type: "hotel" → "accommodation"');
	} else if (next.booking_type === "restaurant") {
		next.booking_type = "dining";
		changes.push('booking_type: "restaurant" → "dining"');
	} else if (next.booking_type === "event") {
		next.booking_type = "activity";
		changes.push('booking_type: "event" → "activity"');
	} else if (next.booking_type === "appointment") {
		next.booking_type = "activity";
		changes.push('booking_type: "appointment" → "activity"');
	}

	// Normalize payment_status: unpaid → pending
	if (next.payment_status === "unpaid") {
		next.payment_status = "pending";
		changes.push('payment_status: "unpaid" → "pending"');
	}

	// Ensure cost is string
	if (typeof next.cost === "number") {
		next.cost = next.cost.toString();
		changes.push("cost: converted number to string");
	}

	return {
		attributes: next,
		body: ctx.body,
		changes,
	};
};

/** Migrates itinerary notes v1→v2: adds energy_level default. */
const itineraryV1To2: MigrationFn = (ctx): MigrationResult => {
	const energy = ensureField(
		ctx.attributes,
		"energy_level",
		"medium",
		"energy_level: medium",
	);
	return {
		attributes: energy.attributes,
		body: ctx.body,
		changes: [...energy.changes],
	};
};

/** Migrates research notes v1→v2: adds status default. */
const researchV1To2: MigrationFn = (ctx): MigrationResult => {
	const status = ensureField(ctx.attributes, "status", "open", "status: open");
	return {
		attributes: status.attributes,
		body: ctx.body,
		changes: [...status.changes],
	};
};

// ============================================================================
// V2 → V3 MIGRATIONS
// ============================================================================

/** project v2→v3: removes reviewed/review_period, adds new optional fields */
const projectV2To3: MigrationFn = (ctx): MigrationResult => {
	const next = { ...ctx.attributes };
	const changes: string[] = [];

	// Remove obsolete fields
	if ("reviewed" in next) {
		delete next.reviewed;
		changes.push("removed: reviewed");
	}
	if ("review_period" in next) {
		delete next.review_period;
		changes.push("removed: review_period");
	}

	// Add new optional fields with defaults
	if (!next.depends_on) {
		next.depends_on = [];
	}
	if (!next.blocks) {
		next.blocks = [];
	}
	if (!next.completion_date) {
		next.completion_date = "";
	}

	return { attributes: next, body: ctx.body, changes };
};

/** area v2→v3: removes reviewed/review_period */
const areaV2To3: MigrationFn = (ctx): MigrationResult => {
	const next = { ...ctx.attributes };
	const changes: string[] = [];
	if ("reviewed" in next) {
		delete next.reviewed;
		changes.push("removed: reviewed");
	}
	if ("review_period" in next) {
		delete next.review_period;
		changes.push("removed: review_period");
	}
	return { attributes: next, body: ctx.body, changes };
};

/** resource v2→v3: renames source→source_type, removes areas/reviewed */
const resourceV2To3: MigrationFn = (ctx): MigrationResult => {
	const next = { ...ctx.attributes };
	const changes: string[] = [];

	// Rename source → source_type
	if ("source" in next && !("source_type" in next)) {
		next.source_type = next.source;
		delete next.source;
		changes.push("renamed: source → source_type");
	}

	// Remove obsolete fields
	if ("areas" in next) {
		delete next.areas;
		changes.push("removed: areas");
	}
	if ("reviewed" in next) {
		delete next.reviewed;
		changes.push("removed: reviewed");
	}

	return { attributes: next, body: ctx.body, changes };
};

/** task v2→v3: removes reviewed, adds new optional fields */
const taskV2To3: MigrationFn = (ctx): MigrationResult => {
	const next = { ...ctx.attributes };
	const changes: string[] = [];
	if ("reviewed" in next) {
		delete next.reviewed;
		changes.push("removed: reviewed");
	}
	if (!next.depends_on) {
		next.depends_on = [];
	}
	if (!next.blocks) {
		next.blocks = [];
	}
	return { attributes: next, body: ctx.body, changes };
};

/** daily v2→v3: adds week field */
const dailyV2To3: MigrationFn = (ctx): MigrationResult => {
	const next = { ...ctx.attributes };
	const changes: string[] = [];
	if (!next.week) {
		next.week = "";
		changes.push("added: week");
	}
	return { attributes: next, body: ctx.body, changes };
};

/** weekly-review v2→v3: adds week_start, focus_areas */
const weeklyReviewV2To3: MigrationFn = (ctx): MigrationResult => {
	const next = { ...ctx.attributes };
	const changes: string[] = [];
	if (!next.week_start) {
		next.week_start = "";
		changes.push("added: week_start");
	}
	if (!next.focus_areas) {
		next.focus_areas = "";
		changes.push("added: focus_areas");
	}
	return { attributes: next, body: ctx.body, changes };
};

/** capture v2→v3: renames captured_from → source */
const captureV2To3: MigrationFn = (ctx): MigrationResult => {
	const next = { ...ctx.attributes };
	const changes: string[] = [];
	if ("captured_from" in next && !("source" in next)) {
		next.source = next.captured_from;
		delete next.captured_from;
		changes.push("renamed: captured_from → source");
	}
	return { attributes: next, body: ctx.body, changes };
};

/** checklist v2→v3: no structural changes, just version bump */
const checklistV2To3: MigrationFn = (ctx): MigrationResult => {
	return { attributes: ctx.attributes, body: ctx.body, changes: [] };
};

/** itinerary v2→v3: adds location field */
const itineraryV2To3: MigrationFn = (ctx): MigrationResult => {
	const next = { ...ctx.attributes };
	const changes: string[] = [];
	if (!next.location) {
		next.location = "";
		changes.push("added: location");
	}
	return { attributes: next, body: ctx.body, changes };
};

/** research v2→v3: adds location field */
const researchV2To3: MigrationFn = (ctx): MigrationResult => {
	const next = { ...ctx.attributes };
	const changes: string[] = [];
	if (!next.location) {
		next.location = "";
		changes.push("added: location");
	}
	return { attributes: next, body: ctx.body, changes };
};

/**
 * Registry of all migration functions indexed by template type and version transitions.
 *
 * Structure: `{ [templateType]: { [fromVersion]: { [toVersion]: MigrationFn } } }`
 *
 * This allows the frontmatter migration system to look up the appropriate migration
 * function when upgrading a note from one template version to another.
 *
 * @example
 * ```typescript
 * // Get migration function for project v1→v2
 * const migrateFn = MIGRATIONS['project']?.[1]?.[2];
 * if (migrateFn) {
 *   const result = migrateFn({ attributes, body });
 * }
 * ```
 */
export const MIGRATIONS: MigrationHooks = {
	project: {
		1: { 2: projectV1To2, 3: projectV1To2 },
		2: { 3: projectV2To3 },
	},
	area: {
		1: { 2: areaV1To2, 3: areaV1To2 },
		2: { 3: areaV2To3 },
	},
	resource: {
		1: { 2: resourceV1To2, 3: resourceV1To2 },
		2: { 3: resourceV2To3 },
	},
	task: {
		1: { 2: taskV1To2, 3: taskV1To2 },
		2: { 3: taskV2To3 },
	},
	daily: {
		1: { 2: dailyV1To2, 3: dailyV1To2 },
		2: { 3: dailyV2To3 },
	},
	"weekly-review": {
		1: { 2: weeklyReviewV1To2, 3: weeklyReviewV1To2 },
		2: { 3: weeklyReviewV2To3 },
	},
	capture: {
		1: { 2: captureV1To2, 3: captureV1To2 },
		2: { 3: captureV2To3 },
	},
	checklist: {
		1: { 2: checklistV1To2, 3: checklistV1To2 },
		2: { 3: checklistV2To3 },
	},
	booking: {
		1: { 2: bookingV1To2 },
		2: { 3: bookingV2To3 },
	},
	itinerary: {
		1: { 2: itineraryV1To2, 3: itineraryV1To2 },
		2: { 3: itineraryV2To3 },
	},
	research: {
		1: { 2: researchV1To2, 3: researchV1To2 },
		2: { 3: researchV2To3 },
	},
};
