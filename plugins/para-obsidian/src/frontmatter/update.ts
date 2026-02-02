/**
 * Frontmatter update utilities.
 *
 * @module frontmatter/update
 */

import { writeTextFileSync } from "@side-quest/core/fs";

import type { ParaObsidianConfig } from "../config/index";
import { resolveVaultPath } from "../shared/fs";
import { serializeFrontmatter } from "./parse";
import type {
	PreWriteFilterResult,
	UpdateFrontmatterOptions,
	UpdateFrontmatterResult,
} from "./types";
import { filterFieldsForWrite, readFrontmatterFile } from "./validate";

/**
 * Updates frontmatter fields in a file.
 *
 * Supports setting new values, updating existing values, and removing fields.
 * Provides before/after comparison and dry-run capability.
 *
 * @param config - Para-obsidian configuration with vault path
 * @param filePath - Path to file (relative to vault or absolute)
 * @param options - Update options (set, unset, dryRun)
 * @returns Update result with change details and before/after snapshots
 * @throws Error if file doesn't exist or path escapes vault
 *
 * @example
 * ```typescript
 * // Set and unset fields
 * const result = updateFrontmatterFile(config, 'Note.md', {
 *   set: { status: 'completed', reviewed: '2024-01-15' },
 *   unset: ['draft'],
 *   dryRun: true
 * });
 * console.log(result.changes); // ['set status ("active" → "completed")', 'unset draft ("true")']
 * ```
 */
export function updateFrontmatterFile(
	config: ParaObsidianConfig,
	filePath: string,
	options: UpdateFrontmatterOptions,
): UpdateFrontmatterResult {
	const { attributes, body, relative } = readFrontmatterFile(config, filePath);
	const before = { ...attributes };
	const changes: string[] = [];
	const next = { ...before };

	// Apply pre-write filtering when configured
	let filtered: PreWriteFilterResult | undefined;
	let effectiveSet = options.set ?? {};
	if (options.preWriteFilter && options.set) {
		filtered = filterFieldsForWrite(
			options.set,
			options.preWriteFilter.noteType,
			options.preWriteFilter.config,
		);
		effectiveSet = filtered.accepted;
	}

	// Apply set operations
	for (const [key, value] of Object.entries(effectiveSet)) {
		const previous = next[key];
		const same =
			typeof previous === "object" && typeof value === "object"
				? JSON.stringify(previous) === JSON.stringify(value)
				: previous === value;
		if (same) continue;
		next[key] = value;
		changes.push(
			previous === undefined
				? `set ${key}`
				: `set ${key} (${JSON.stringify(previous)} → ${JSON.stringify(value)})`,
		);
	}

	// Apply unset operations
	for (const key of options.unset ?? []) {
		if (!(key in next)) continue;
		const previous = next[key];
		delete next[key];
		changes.push(`unset ${key} (${JSON.stringify(previous)})`);
	}

	const dryRun = options.dryRun ?? false;
	const wouldChange = changes.length > 0;
	const updated = wouldChange && !dryRun;

	// Write changes to disk if not dry-run
	if (updated) {
		const content = serializeFrontmatter(next, body);
		const { absolute } = resolveVaultPath(config.vault, relative);
		writeTextFileSync(absolute, content);
	}

	return {
		relative,
		dryRun,
		wouldChange,
		updated,
		changes,
		attributes: {
			before,
			after: next,
		},
		...(filtered ? { filtered } : {}),
	};
}
