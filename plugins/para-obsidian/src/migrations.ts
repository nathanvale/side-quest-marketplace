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
} from "./frontmatter";

/**
 * Ensures required tags are present in the tags array.
 * Adds missing tags without duplicating existing ones.
 *
 * @param attributes - Current frontmatter attributes
 * @param required - Tags that must be present
 * @returns Updated attributes and list of changes made
 */
function ensureTags(
	attributes: Record<string, unknown>,
	required: ReadonlyArray<string>,
): { attributes: Record<string, unknown>; changes: string[] } {
	const next = { ...attributes };
	const changes: string[] = [];
	const tags = Array.isArray(next.tags) ? [...(next.tags as unknown[])] : [];
	let modified = false;
	for (const tag of required) {
		if (!tags.includes(tag)) {
			tags.push(tag);
			modified = true;
			changes.push(`tags: added ${tag}`);
		}
	}
	if (modified) next.tags = tags;
	return { attributes: next, changes };
}

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
 * - Ensures "project" tag is present
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
	const tagged = ensureTags(review.attributes, ["project"]);

	return {
		attributes: tagged.attributes,
		body: ctx.body,
		changes: [
			...changes,
			...tagged.changes,
			...review.changes,
			...renamedTarget.changes,
			...renamedStart.changes,
		],
	};
};

/** Migrates area notes v1→v2: adds review_period, ensures "area" tag. */
const areaV1To2: MigrationFn = (ctx): MigrationResult => {
	const review = ensureField(
		ctx.attributes,
		"review_period",
		"7d",
		"review_period: 7d",
	);
	const tagged = ensureTags(review.attributes, ["area"]);
	return {
		attributes: tagged.attributes,
		body: ctx.body,
		changes: [...tagged.changes, ...review.changes],
	};
};

/** Migrates resource notes v1→v2: renames origin→source, ensures "resource" tag. */
const resourceV1To2: MigrationFn = (ctx): MigrationResult => {
	const source = renameField(
		ctx.attributes,
		"origin",
		"source",
		"origin → source",
	);
	const tagged = ensureTags(source.attributes, ["resource"]);
	return {
		attributes: tagged.attributes,
		body: ctx.body,
		changes: [...source.changes, ...tagged.changes],
	};
};

/** Migrates task notes v1→v2: adds status, effort, task_type defaults; ensures "task" tag. */
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
	const tagged = ensureTags(taskType.attributes, ["task"]);
	return {
		attributes: tagged.attributes,
		body: ctx.body,
		changes: [
			...status.changes,
			...effort.changes,
			...taskType.changes,
			...tagged.changes,
		],
	};
};

/** Migrates daily notes v1→v2: ensures "daily" and "journal" tags. */
const dailyV1To2: MigrationFn = (ctx): MigrationResult => {
	const tagged = ensureTags(ctx.attributes, ["daily", "journal"]);
	return {
		attributes: tagged.attributes,
		body: ctx.body,
		changes: tagged.changes,
	};
};

/** Migrates weekly-review notes v1→v2: adds week placeholder; ensures "weekly" and "review" tags. */
const weeklyReviewV1To2: MigrationFn = (ctx): MigrationResult => {
	const week = ensureField(
		ctx.attributes,
		"week",
		"TODO-week",
		"week: placeholder",
	);
	const tagged = ensureTags(week.attributes, ["weekly", "review"]);
	return {
		attributes: tagged.attributes,
		body: ctx.body,
		changes: [...week.changes, ...tagged.changes],
	};
};

/** Migrates capture notes v1→v2: adds status/resonance defaults; ensures "capture" and "inbox" tags. */
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
	const tagged = ensureTags(resonance.attributes, ["capture", "inbox"]);
	return {
		attributes: tagged.attributes,
		body: ctx.body,
		changes: [...status.changes, ...resonance.changes, ...tagged.changes],
	};
};

/** Migrates checklist notes v1→v2: adds status default; ensures "checklist" tag. */
const checklistV1To2: MigrationFn = (ctx): MigrationResult => {
	const status = ensureField(
		ctx.attributes,
		"status",
		"draft",
		"status: draft",
	);
	const tagged = ensureTags(status.attributes, ["checklist"]);
	return {
		attributes: tagged.attributes,
		body: ctx.body,
		changes: [...status.changes, ...tagged.changes],
	};
};

/** Migrates booking notes v1→v2: adds payment_status default; ensures "booking" tag. */
const bookingV1To2: MigrationFn = (ctx): MigrationResult => {
	const payment = ensureField(
		ctx.attributes,
		"payment_status",
		"unpaid",
		"payment_status: unpaid",
	);
	const tagged = ensureTags(payment.attributes, ["booking"]);
	return {
		attributes: tagged.attributes,
		body: ctx.body,
		changes: [...payment.changes, ...tagged.changes],
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

/** Migrates itinerary notes v1→v2: adds energy_level default; ensures "itinerary" tag. */
const itineraryV1To2: MigrationFn = (ctx): MigrationResult => {
	const energy = ensureField(
		ctx.attributes,
		"energy_level",
		"medium",
		"energy_level: medium",
	);
	const tagged = ensureTags(energy.attributes, ["itinerary"]);
	return {
		attributes: tagged.attributes,
		body: ctx.body,
		changes: [...energy.changes, ...tagged.changes],
	};
};

/** Migrates research notes v1→v2: adds status default; ensures "research" tag. */
const researchV1To2: MigrationFn = (ctx): MigrationResult => {
	const status = ensureField(ctx.attributes, "status", "open", "status: open");
	const tagged = ensureTags(status.attributes, ["research"]);
	return {
		attributes: tagged.attributes,
		body: ctx.body,
		changes: [...status.changes, ...tagged.changes],
	};
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
		1: {
			2: projectV1To2,
			3: projectV1To2,
		},
	},
	resource: {
		1: { 2: resourceV1To2 },
	},
	daily: {
		1: { 2: dailyV1To2 },
	},
	area: {
		1: { 2: areaV1To2 },
	},
	task: {
		1: { 2: taskV1To2 },
	},
	"weekly-review": {
		1: { 2: weeklyReviewV1To2 },
	},
	capture: {
		1: { 2: captureV1To2 },
	},
	checklist: {
		1: { 2: checklistV1To2 },
	},
	booking: {
		1: { 2: bookingV1To2 },
		2: { 3: bookingV2To3 },
	},
	itinerary: {
		1: { 2: itineraryV1To2 },
	},
	research: {
		1: { 2: researchV1To2 },
	},
};
