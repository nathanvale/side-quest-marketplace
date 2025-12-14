/**
 * Migration Registry and Runner
 *
 * Manages schema migrations for InboxConverter configurations.
 * Automatically upgrades converters from older versions.
 *
 * @module classify/classifiers/migrations
 */

import type { InboxConverter } from "../../converters/types";
import { CURRENT_SCHEMA_VERSION } from "../registry";
import type { Migration, MigrationResult } from "./migrate";

// Re-export types
export type { Migration, MigrationFn, MigrationResult } from "./migrate";

/**
 * Registry of available migrations.
 * Add new migrations here when schema changes.
 *
 * Migrations are applied in order from lowest to highest version.
 */
const MIGRATIONS: readonly Migration[] = [
	// Future migrations will be added here:
	// { fromVersion: 1, toVersion: 2, description: "...", migrate: migrateV1ToV2 },
];

/**
 * Run all necessary migrations on a converter.
 *
 * @param converter - Converter to migrate (may be at any version)
 * @returns Migration result with upgraded converter
 * @throws Error if converter version is newer than supported
 *
 * @example
 * ```typescript
 * const oldConverter = loadFromConfig(); // might be v1
 * const result = runMigrations(oldConverter);
 * if (result.migrated) {
 *   console.log(`Migrated through versions: ${result.migrationsApplied}`);
 * }
 * registry.register(result.converter);
 * ```
 */
export function runMigrations(converter: unknown): MigrationResult {
	// Validate input is an object with schemaVersion
	if (
		typeof converter !== "object" ||
		converter === null ||
		!("schemaVersion" in converter)
	) {
		throw new Error(
			"Invalid converter: missing schemaVersion field. " +
				"Converters must have a numeric schemaVersion.",
		);
	}

	const typedConverter = converter as { schemaVersion: number };
	let currentVersion = typedConverter.schemaVersion;

	// Check for future versions we don't support
	if (currentVersion > CURRENT_SCHEMA_VERSION) {
		throw new Error(
			`Converter has schema version ${currentVersion} but ` +
				`this version of para-obsidian only supports up to version ${CURRENT_SCHEMA_VERSION}. ` +
				`Please update para-obsidian to use this converter.`,
		);
	}

	// Already at current version - no migration needed
	if (currentVersion === CURRENT_SCHEMA_VERSION) {
		return {
			converter: converter as InboxConverter,
			migrated: false,
			migrationsApplied: [],
		};
	}

	// Find and apply migrations in order
	const migrationsApplied: number[] = [];
	let current: unknown = converter;

	while (currentVersion < CURRENT_SCHEMA_VERSION) {
		const migration = MIGRATIONS.find((m) => m.fromVersion === currentVersion);

		if (!migration) {
			throw new Error(
				`No migration found from version ${currentVersion} to ${currentVersion + 1}. ` +
					`This is a bug in para-obsidian - please report it.`,
			);
		}

		current = migration.migrate(current);
		migrationsApplied.push(migration.toVersion);
		currentVersion = migration.toVersion;
	}

	return {
		converter: current as InboxConverter,
		migrated: true,
		migrationsApplied,
	};
}

/**
 * Check if a converter needs migration.
 *
 * @param converter - Converter to check
 * @returns true if migration is needed
 */
export function needsMigration(converter: { schemaVersion: number }): boolean {
	return converter.schemaVersion < CURRENT_SCHEMA_VERSION;
}

/**
 * Get list of available migrations for debugging.
 *
 * @returns Array of migration descriptions
 */
export function getAvailableMigrations(): readonly string[] {
	return MIGRATIONS.map(
		(m) => `v${m.fromVersion} → v${m.toVersion}: ${m.description}`,
	);
}
