/**
 * Classifier System
 *
 * Provides registry and migration support for inbox document classifiers.
 *
 * @module classify/classifiers
 */

export type { Migration, MigrationFn, MigrationResult } from "./migrations";

// Migrations
export {
	getAvailableMigrations,
	needsMigration,
	runMigrations,
} from "./migrations";
// Registry
export { ClassifierRegistry, CURRENT_SCHEMA_VERSION } from "./registry";
