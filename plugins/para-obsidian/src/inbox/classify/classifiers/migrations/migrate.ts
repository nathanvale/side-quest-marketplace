/**
 * Migration Type Definitions
 *
 * Defines the interface for converter schema migrations.
 * Implementations transform converters from one schema version to the next.
 *
 * @module classify/classifiers/migrations/migrate
 */

import type { InboxConverter } from "../types";

/**
 * Migration function signature.
 * Transforms a converter from one version to the next.
 *
 * @param converter - Converter at the source version
 * @returns Converter at the target version
 */
export type MigrationFn = (converter: unknown) => InboxConverter;

/**
 * Migration definition with metadata.
 */
export interface Migration {
	/** Source schema version */
	readonly fromVersion: number;
	/** Target schema version */
	readonly toVersion: number;
	/** Human-readable description of changes */
	readonly description: string;
	/** Migration function */
	readonly migrate: MigrationFn;
}

/**
 * Result of running migrations on a converter.
 */
export interface MigrationResult {
	/** The migrated converter */
	readonly converter: InboxConverter;
	/** Whether any migrations were applied */
	readonly migrated: boolean;
	/** Versions that were migrated through */
	readonly migrationsApplied: readonly number[];
}
